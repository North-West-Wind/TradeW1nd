import * as dotenv from "dotenv";
import { Handler } from "./handler";
import { NorthClient, ClientStorage } from "./classes/NorthClient";
import { Intents, Options } from "discord.js";
import express from "express";
dotenv.config();

const { prefix0 } = require("../config.json");
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

client.prefix = prefix0;
client.id = 0;
Handler.setup(client, process.env.TOKEN0);

const app = express();

app.get("/", (_req, res) => {
    res.json({ size: client.guilds.cache.size, lastReady: client.readyAt.getTime(), uptime: client.uptime });
});

app.listen(process.env.PORT || 3000);