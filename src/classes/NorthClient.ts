import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, VoiceConnection } from "@discordjs/voice";
import { Client, ClientOptions, Collection, CommandInteraction, GuildMember, Message, Snowflake, TextChannel, VoiceChannel } from "discord.js";
import { Pool, RowDataPacket } from "mysql2/promise";
import { probeAndCreateResource } from "../commands/music/play";
import { globalClient } from "../common";
import { getStream } from "../helpers/addTrack";
import { addUsing, createDiscordJSAdapter, removeUsing } from "../helpers/music";
import * as Stream from "stream";
import { msgOrRes } from "../function";
const ffmpeg = require("fluent-ffmpeg");

export class NorthClient extends Client {
    constructor(options: ClientOptions) {
        super(options);
    }

    id: number;
    prefix: string;
    pool: Pool;
    version: string;
    static storage: ClientStorage;

    setPool(pool: Pool) { this.pool = pool; }
    setVersion(version: string) { this.version = version; }
}

export interface Command {
    name: string;
    description: string;
    args?: number;
    usage?: string;
    category?: number;
    aliases?: string[];
    subcommands?: string[];
    subaliases?: string[];
    subdesc?: string[];
    subusage?: (string | number)[];
    permissions?: { guild?: { user?: number, me?: number }, channel?: { user?: number, me?: number } };

    run(message: Message, args: string[]): Promise<any> | any;
}

export interface SlashCommand extends Command {
    options?: any[];

    execute(interaction: CommandInteraction): Promise<any> | any;
}

export interface GuildConfigs {
    [key: Snowflake]: GuildConfig;
}

export class GuildConfig {
    prefix?: string;
    exit?: boolean;

    constructor(data: RowDataPacket = (<RowDataPacket> {})) {
        if (data) {
            this.prefix = data.prefix;
        }
    }
}

export class ClientStorage {
    guilds: GuildConfigs = {};
    commands: Collection<string, SlashCommand> = new Collection();
    migrating: any[] = [];
}

export class ServerQueue {
    constructor(songs: SoundTrack[], loopStatus: boolean, repeatStatus: boolean) {
        this.textChannel = null;
        this.voiceChannel = null;
        this.connection = null;
        this.player = null;
        this.songs = songs;
        this.volume = 1;
        this.playing = false;
        this.paused = false;
        this.looping = loopStatus;
        this.repeating = repeatStatus;
        this.random = false;
        this.callers = new Set();
        this.callRoles = new Set();
    }

    textChannel: TextChannel;
    voiceChannel: VoiceChannel;
    connection: VoiceConnection;
    player: AudioPlayer;
    resource?: AudioResource;
    songs: SoundTrack[];
    volume: number;
    playing: boolean;
    paused: boolean;
    looping: boolean;
    repeating: boolean;
    random: boolean;
    startTime?: number;
    errorCounter?: number;
    isSkipping?: boolean;
    seek?: number;
    callers: Set<Snowflake>;
    callRoles: Set<Snowflake>;

    getPlaybackDuration() {
        if (this.player?.state?.status != AudioPlayerStatus.Playing) return 0;
        return this.player.state.playbackDuration;
    }

    destroy() {
        try {
            this.player?.stop();
            this.connection?.destroy();
            removeUsing(this.songs[0].id);
        } catch (err: any) { }
        this.player = null;
        this.connection = null;
    }

    stop() {
        try {
            this.player?.stop();
        } catch (err: any) { }
        this.player = null;
    }

    clean() {
        this.callers.clear();
        this.callRoles.clear();
    }
}

export class SoundTrack {
    id?: string;
    title: string;
    url: string;
    type: number;
    time: number;
    volume: number;
    thumbnail: string;
    isLive: boolean;
    isPastLive?: boolean;
    spot?: string;
}

class RadioSoundTrack extends SoundTrack {
    looped?: number;
}

export class RadioChannel {
    id: number;
    player: AudioPlayer;
    tracks: RadioSoundTrack[];
    guilds: Set<Snowflake> = new Set();
    startTime?: number;
    seek: number;
    private interval: NodeJS.Timer;

    constructor(id: number, tracks: RadioSoundTrack[], seek: number, guilds: Snowflake[]) {
        this.id = id;
        this.tracks = tracks;
        this.seek = seek;
        this.guilds = new Set(guilds);
        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        }).on(AudioPlayerStatus.Playing, async (_oldState, newState) => {
            this.startTime = newState.playbackDuration;
            this.interval = setInterval(() => {
                this.seek = Math.floor(((this.player.state.status == AudioPlayerStatus.Playing ? this.player.state.playbackDuration : this.startTime) - this.startTime) / 1000);
                this.updateSeek();
            }, 30000);
        }).on(AudioPlayerStatus.Idle || "error", async () => {
            clearInterval(this.interval);
            this.seek = 0;
            const finished = this.tracks.shift();
            if (!finished.looped) finished.looped = 1;
            else finished.looped++;
            if (finished.looped <= 10 || this.tracks.length <= 10) this.tracks.push(finished);
            else removeUsing(finished.id, true);
            this.update();
            this.updateSeek();
            await this.start();
        });
        for (const guild of guilds) {
            var connection = getVoiceConnection(guild);
            if (!connection) continue;
            connection.subscribe(this.player);
        }
        this.start();
    }

    async start() {
        if (this.tracks[0]) {
            const stream = await getStream(this.tracks[0], { type: "radio", tracks: this.tracks });
            if (this.seek) {
                console.log(`Fast-forwarding radio channel #${this.id} to where we left off (${this.seek}s)`)
                const command = ffmpeg(stream);
                const passthru = new Stream.PassThrough({ highWaterMark: 1 << 25 });
                command.on("error", err => console.error(err.message)).seekInput(this.seek).format("wav").output(passthru, { end: true }).run();
                this.player.play(await probeAndCreateResource(passthru));
            } else this.player.play(await probeAndCreateResource(stream));
            addUsing(this.tracks[0].id);
        }
    }

    async add(tracks: RadioSoundTrack[]) {
        this.tracks.push(...tracks);
        this.update();
        if (this.player.state.status == AudioPlayerStatus.Idle) await this.start();
    }

    async update() {
        try {
            await globalClient.pool.query(`UPDATE radio SET queue = "${escape(JSON.stringify(this.tracks))}" WHERE id = ${this.id}`);
        } catch (err) {}
    }

    async updateSeek() {
        try {
            await globalClient.pool.query(`UPDATE radio SET seek = "${this.seek || 0}" WHERE id = ${this.id}`);
        } catch (err) {}
    }
}