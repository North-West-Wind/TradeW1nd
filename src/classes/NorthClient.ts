import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, getVoiceConnection, NoSubscriberBehavior, VoiceConnection } from "@discordjs/voice";
import { Client, ClientOptions, Collection, ChatInputCommandInteraction, Snowflake, TextChannel, VoiceChannel, ApplicationCommandOption } from "discord.js";
import { probeAndCreateResource } from "../commands/music/play.js";
import { getStream } from "../helpers/addTrack.js";
import { addUsing, removeUsing } from "../helpers/music.js";
import * as Stream from "stream";
import { query } from "../function.js";
import Ffmpeg from "fluent-ffmpeg";
import { Handler } from "../handler.js";

export class NorthClient extends Client {
    constructor(options: ClientOptions) {
        super(options);
    }

    id: number;
    prefix: string;
    version: string;
    handler: Handler;
    static storage: ClientStorage;

    setVersion(version: string) { this.version = version; }
}

export abstract class ISlash {
    options?: ApplicationCommandOption[];
    
    abstract execute(interaction: ChatInputCommandInteraction): Promise<any> | any;
}

export abstract class Command {
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
}

export abstract class SlashCommand extends Command implements ISlash {
    options?: any[];

    abstract execute(interaction: ChatInputCommandInteraction): Promise<any> | any;
}

export interface GuildConfigs {
    [key: Snowflake]: GuildConfig;
}

export class GuildConfig {
    prefix?: string;
    exit?: boolean;

    constructor(data: any = (<any>{})) {
        if (data) {
            this.prefix = data.prefix;
        }
    }
}

export class ClientStorage {
    guilds: GuildConfigs = {};
    commands: Collection<string, Command> = new Collection();
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
        }).on(AudioPlayerStatus.Playing, async () => {
            this.interval = setInterval(() => {
                this.seek = this.player.state.status == AudioPlayerStatus.Playing ? Math.floor(this.player.state.playbackDuration / 1000) : 0;
                this.updateSeek();
            }, 30000);
        }).on(AudioPlayerStatus.Idle, this.next).on("error", this.next);
        for (const guild of guilds) {
            const connection = getVoiceConnection(guild);
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
                const command = Ffmpeg(stream);
                const passthru = new Stream.PassThrough({ highWaterMark: 1 << 19 });
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
            await query(`UPDATE radio SET queue = "${escape(JSON.stringify(this.tracks))}" WHERE id = ${this.id}`);
        } catch (err) { }
    }

    async updateSeek() {
        try {
            await query(`UPDATE radio SET seek = "${this.seek || 0}" WHERE id = ${this.id}`);
        } catch (err) { }
    }
    async next() {
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
    }
}