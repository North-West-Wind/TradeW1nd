import { AudioPlayer, AudioPlayerStatus, AudioResource, VoiceConnection } from "@discordjs/voice";
import { Client, ClientOptions, Collection, CommandInteraction, Message, Snowflake, TextChannel, VoiceChannel } from "discord.js";
import { Pool, RowDataPacket } from "mysql2/promise";

export class NorthClient extends Client {
    constructor(options: ClientOptions) {
        super(options);
    }

    id: number;
    prefix: string;
    pool: Pool;
    log: Snowflake;
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
    init?(): Promise<any> | any;
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

    getPlaybackDuration() {
        if (this.player?.state?.status != AudioPlayerStatus.Playing) return 0;
        return this.player.state.playbackDuration;
    }

    destroy() {
        try {
            this.player?.stop();
            this.connection?.destroy();
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
}

export class SoundTrack {
    title: string;
    url: string;
    type: number;
    time: string;
    volume: number;
    thumbnail: string;
    isLive: boolean;
    isPastLive?: boolean;
    spot?: string;
}