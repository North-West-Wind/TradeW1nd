import { CommandInteraction, Guild, Interaction, Message, VoiceState } from "discord.js";
import * as moment from "moment";
import formatSetup from "moment-duration-format";
formatSetup(moment);
import { RowDataPacket } from "mysql2";
import { fixGuildRecord } from "./function";
import { setQueue, stop } from "./helpers/music";
import { NorthClient, GuildConfig } from "./classes/NorthClient";
import { Connection } from "mysql2/promise";
import * as filter from "./helpers/filter";
import common from "./common";
import { init } from "./helpers/addTrack";

const error = "There was an error trying to execute that command!\nIf it still doesn't work after a few tries, please contact NorthWestWind or report it on the [support server](<https://discord.gg/n67DUfQ>) or [GitHub](<https://github.com/North-West-Wind/NWWbot/issues>).\nPlease **DO NOT just** sit there and ignore this error. If you are not reporting it, it is **NEVER getting fixed**.";
var inited = false;
export class Handler {
    static async setup(client: NorthClient, token: string) {
        await common(client);
        new Handler(client);
        client.login(token);
    }

    constructor(client: NorthClient) {
        client.once("ready", () => this.ready(client));
        client.on("guildCreate", guild => this.guildCreate(guild));
        client.on("guildDelete", guild => this.guildDelete(guild));
        client.on("voiceStateUpdate", (oldState, newState) => this.voiceStateUpdate(oldState, newState));
        client.on("messageCreate", message => this.message(message));
        client.on("interactionCreate", interaction => this.interactionCreate(interaction));
    }

    async interactionCreate(interaction: Interaction) {
        if (!interaction.isCommand()) return;
        const command = NorthClient.storage.commands.get(interaction.commandName);
        if (!command) return;
        try {
            if(await filter.all(command, interaction) && await filter.music(command, interaction)) await command.execute(interaction);
        } catch (err: any) {
            try {
                if (interaction.replied || interaction.deferred) await interaction.editReply(error);
                else await interaction.reply(error);
            } catch (err: any) { }
            console.error(command.name + ": " + err);
        }
    }

    async setPresence(client: NorthClient) {
        client.user.setPresence({ activities: [{ name: "AFK", type: "PLAYING" }], status: "idle", afk: true });
    }

    async readServers(client: NorthClient) {
        const con = await client.pool.getConnection();
        const [results] = <RowDataPacket[][]><unknown>await con.query("SELECT * FROM servers WHERE id <> '622311594654695434'");
        for (const result of results) {
            if (!inited && (result.queue || result.looping || result.repeating)) {
                var queue = [];
                try { if (result.queue) queue = JSON.parse(unescape(result.queue)); }
                catch (err: any) { console.error(`Error parsing queue of ${result.id}`); }
                setQueue(result.id, queue, !!result.looping, !!result.repeating);
            }
            if (!inited) NorthClient.storage.guilds[result.id] = new GuildConfig(result);
            else NorthClient.storage.guilds[result.id].prefix = result.prefix;
        }
        inited = true;
        console.log(`[${client.id}] Set ${results.length} configurations`);
        con.release();
        setTimeout(async () => this.readServers(client), 3600000);
    }

    async ready(client: NorthClient) {
        const id = client.id;
        console.log(`[${id}] Ready!`);
        this.setPresence(client);
        try {
            init();
            await this.readServers(client);
        } catch (err: any) { console.error(err); };
    }

    async guildCreate(guild: Guild) {
        try {
            await fixGuildRecord(guild.id);
        } catch (err: any) {
            console.error(err);
        }
    }

    async guildDelete(guild: Guild) {
        if (await guild.members.fetch("649611982428962819")) return;
        const client = <NorthClient>guild.client;
        delete NorthClient.storage.guilds[guild.id];
        try {
            await client.pool.query("DELETE FROM servers WHERE id=" + guild.id);
        } catch (err: any) {
            console.error(err);
        }
    }

    async voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = oldState.guild || newState.guild;
        const exit = NorthClient.storage.guilds[guild.id]?.exit;
        if ((oldState.id == guild.me.id || newState.id == guild.me.id) && (!guild.me.voice?.channel)) return stop(guild);
        if (!guild.me.voice?.channel || (newState.channelId !== guild.me.voice.channelId && oldState.channelId !== guild.me.voice.channelId)) return;
        if (!NorthClient.storage.guilds[guild.id]) await fixGuildRecord(guild.id);
        if (guild.me.voice.channel?.members.size <= 1) {
            if (exit) return;
            NorthClient.storage.guilds[guild.id].exit = true;
            setTimeout(() => NorthClient.storage.guilds[guild.id]?.exit ? stop(guild) : 0, 30000);
        } else NorthClient.storage.guilds[guild.id].exit = false;
    }

    messagePrefix(message: Message, client: NorthClient): string {
        return NorthClient.storage.guilds[message.guildId]?.prefix || client.prefix;
    }

    async message(message: Message) {
        const client = <NorthClient>message.client;
        const prefix = this.messagePrefix(message, client);
        if (!message.content.startsWith(prefix)) return;
        const args = message.content.slice(prefix.length).split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = NorthClient.storage.commands.get(commandName) || NorthClient.storage.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (!command) return;
        try {
            if (await filter.all(command, message, args) && await filter.music(command, message)) await command.run(message, args);
        } catch (err: any) {
            console.error(command.name + ": " + err);
            try {
                await message.reply(error);
            } catch (err: any) { }
        }
    }
}