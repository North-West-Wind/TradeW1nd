import { Client, ClientOptions, Collection, Snowflake } from "discord.js";
import { Handler } from "../handler.js";
import { SlashCommand } from "./command.js";

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
    commands: Collection<string, SlashCommand> = new Collection();
    migrating: any[] = [];
}