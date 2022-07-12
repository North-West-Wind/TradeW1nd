import * as dotenv from "dotenv";
import { Handler } from "./handler.js";
import { NorthClient, ClientStorage } from "./classes/NorthClient.js";
import { Intents, Options, TextChannel } from "discord.js";
import express from "express";
import * as fs from "fs";
dotenv.config();

const config = JSON.parse(fs.readFileSync("config.json", { encoding: "utf8" }))

const client = new NorthClient({
    restRequestTimeout: 60000,
    makeCache: Options.cacheWithLimits({
        MessageManager: 50,
        PresenceManager: 0
    }),
    partials: ['MESSAGE'],
    intents: [
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_VOICE_STATES
    ]
});
NorthClient.storage = new ClientStorage();

client.prefix = process.env.PREFIX || config.prefix0;
client.id = 0;
Handler.setup(client, process.env.TOKEN0);

const app = express();

app.get("/", (_req, res) => {
    res.json({ version: client.version, size: client.guilds.cache.size, lastReady: client.readyAt.getTime(), uptime: client.uptime });
});

app.get("/checkGuild/:guild", async (req, res) => {
    var isInGuild = false;
    var id = null;
    try {
        const guild = await client.guilds.fetch(req.params.guild);
        if (guild) {
            isInGuild = true;
            id = guild.id;
        }
    } catch (err) { }
    res.json({ guildId: id, isIn: isInGuild });
});

app.post("/update/:guild", (req, res) => {
    NorthClient.storage.guilds[req.params.guild] = req.body;
    res.sendStatus(200);
});

app.get("/checkChannel/:channel", async (req, res) => {
    var canUseChannel = false;
    var id = null;
    try {
        const channel = <TextChannel> await client.channels.fetch(req.params.channel);
        if (channel) {
            id = channel.id;
            if (channel.permissionsFor(channel.guild.me).has(BigInt(67584))) canUseChannel = true;
        }
    } catch (err) { }
    res.json({ channelId: id, canUse: canUseChannel });
});

app.listen(process.env.PORT || 3000);