import { ActivityType, ChatInputCommandInteraction, Guild, Interaction, InteractionType, VoiceState } from "discord.js";
import { checkN0rthWestW1nd, fixGuildRecord, query } from "./function.js";
import { getQueue, setQueue, stop } from "./helpers/music.js";
import { NorthClient, GuildConfig, ISlash } from "./classes/index.js";
import * as filter from "./helpers/filter.js";
import common from "./common.js";
import { init } from "./helpers/addTrack.js";
import { categories } from "./commands/information/help.js";
import { makePlayers, isPlaying } from "./helpers/radio.js";
import { getClients } from "./main.js";

const error = "There was an error trying to execute that command!\nIf it still doesn't work after a few tries, please contact NorthWestWind or report it on the [support server](<https://discord.gg/n67DUfQ>) or [GitHub](<https://github.com/North-West-Wind/NWWbot/issues>).\nPlease **DO NOT just** sit there and ignore this error. If you are not reporting it, it is **NEVER getting fixed**.";
let inited = false;
export class Handler {
    protected readonly client: NorthClient;

    static async setup(client: NorthClient, token: string) {
        await common(client);
        client.handler = new Handler(client);
        client.login(token);
    }

    constructor(client: NorthClient) {
        this.client = client;
        client.once("ready", () => this.ready());
        client.on("guildCreate", guild => this.guildCreate(guild));
        client.on("guildDelete", guild => this.guildDelete(guild));
        client.on("voiceStateUpdate", (oldState, newState) => this.voiceStateUpdate(<VoiceState>oldState, <VoiceState>newState));
        client.on("interactionCreate", interaction => this.interactionCreate(interaction));

        setInterval(async () => {
            if (filter.canReset()) await this.setPresence().catch(() => { });
        }, 300000);
    }

    async interactionCreate(interaction: Interaction) {
        if (interaction.type !== InteractionType.ApplicationCommand) return;
        const int = <ChatInputCommandInteraction>interaction;
        const command = NorthClient.storage.commands.get(int.commandName);
        if (!command || !(typeof command["execute"] === "function")) return;
        try {
            const catFilter = filter[categories.map(x => x.toLowerCase())[(command.category)]];
            if (await filter.all(command, int) && (catFilter ? await catFilter(command, interaction) : true)) await (<ISlash><unknown>command).execute(int);
        } catch (err: any) {
            try {
                if (interaction.replied || interaction.deferred) await interaction.editReply(error);
                else await interaction.reply(error);
            } catch (err: any) { }
            console.error(command.name + ": " + err);
        }
    }

    async setPresence() {
        this.client.user.setPresence({ activities: [{ name: `AFK | ${this.client.prefix}help`, type: ActivityType.Playing }], status: "idle", afk: true });
    }

    async readServers() {
        const results = await query("SELECT servers.*, configs.prefix FROM servers LEFT JOIN configs ON configs.id = servers.id");
        for (const result of results) {
            if (!this.client.id) {
                if (!inited && (result.queue || result.looping || result.repeating)) {
                    let queue = [];
                    try { if (result.queue) queue = JSON.parse(unescape(result.queue)); }
                    catch (err: any) { console.error(`Error parsing queue of ${result.id}`); }
                    setQueue(result.id, queue, !!result.looping, !!result.repeating);
                }
                if (!inited || !NorthClient.storage.guilds[result.id]) NorthClient.storage.guilds[result.id] = new GuildConfig(result);
                else if (NorthClient.storage.guilds[result.id]) NorthClient.storage.guilds[result.id].prefix = result.prefix;
            } else {
                var guild: Guild;
                try {
                    guild = await this.client.guilds.fetch(result.id);
                } catch (err) { }
                if (guild) {
                    const clients = getClients();
                    for (let ii = 0; ii < this.client.id; ii++) {
                        const client = clients[ii];
                        let clientInGuild = false;
                        try {
                            await client.guilds.fetch(result.id);
                            clientInGuild = true;
                        } catch (err) { }
                        if (clientInGuild) {
                            await guild.leave();
                            break;
                        }
                    }
                }
            }
        }
        inited = true;
        setTimeout(async () => this.readServers(), 3600000);
    }

    async ready() {
        console.log(`[${this.client.id}] Ready!`);
        this.setPresence();
        try {
            init();
            await this.readServers();
            await makePlayers();
        } catch (err: any) { console.error(err); }
    }

    async guildCreate(guild: Guild) {
        const clients = getClients();
        for (let ii = 0; ii < this.client.id; ii++) {
            const client = clients[ii];
            let clientInGuild = false;
            try {
                await client.guilds.fetch(guild.id);
                clientInGuild = true;
            } catch (err) { }
            if (clientInGuild) {
                await guild.leave();
                return;
            }
        }
        try {
            await fixGuildRecord(guild.id);
        } catch (err: any) {
            console.error(err);
        }
    }

    async guildDelete(guild: Guild) {
        try {
            if (await checkN0rthWestW1nd(guild.id)) return;
            delete NorthClient.storage.guilds[guild.id];
            try {
                await query("DELETE FROM servers WHERE id = " + guild.id);
            } catch (err: any) {
                console.error(err);
            }
        } catch (err: any) { }
    }

    async voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = oldState.guild || newState.guild;
        if (isPlaying(guild.id)) return;
        const exit = NorthClient.storage.guilds[guild.id]?.exit;
        if ((oldState.id == guild.members.me.id || newState.id == guild.members.me.id) && (!guild.members.me.voice?.channel)) return stop(guild);
        if (!guild.members.me.voice?.channel || (newState.channelId !== guild.members.me.voice.channelId && oldState.channelId !== guild.members.me.voice.channelId)) return;
        if (!NorthClient.storage.guilds[guild.id]) await fixGuildRecord(guild.id);
        const serverQueue = getQueue(guild.id);
        if (guild.members.me.voice.channel.members.filter(member => !member.user.bot && (member.permissions.any(BigInt(56)) || serverQueue.callers.has(member.id) || !!Array.from(serverQueue.callRoles).find(role => member.roles.cache.has(role)))).size < 1) {
            if (exit) return;
            NorthClient.storage.guilds[guild.id].exit = true;
            setTimeout(() => NorthClient.storage.guilds[guild.id]?.exit ? stop(guild) : 0, 30000);
        } else NorthClient.storage.guilds[guild.id].exit = false;
    }
}