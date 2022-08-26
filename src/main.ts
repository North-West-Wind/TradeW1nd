import * as dotenv from "dotenv";
import { Handler } from "./handler.js";
import { NorthClient, ClientStorage } from "./classes/NorthClient.js";
import { GatewayIntentBits, Options, Partials } from "discord.js";
import express from "express";
import * as fs from "fs";
dotenv.config();

const config = JSON.parse(fs.readFileSync("config.json", { encoding: "utf8" }));
const clients: NorthClient[] = [];
NorthClient.storage = new ClientStorage();

export function getClients() {
    return clients;
}

export function setClient(index: number, client: NorthClient) {
    clients[index] = client;
}

let ii = 0;
while (process.env[`TOKEN${ii}`]) {
    initBot(process.env[`TOKEN${ii}`]);
    ii++;
}

export function addBot(token: string) {
    fs.appendFileSync(".env", `TOKEN${ii++}=${token}`);
    initBot(token);
}

function initBot(token: string) {
    const client = new NorthClient({
        closeTimeout: 60000,
        makeCache: Options.cacheWithLimits({
            MessageManager: 50,
            PresenceManager: 0
        }),
        partials: [Partials.Message],
        intents: [
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageReactions,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates
        ]
    });
    
    client.prefix = process.env.PREFIX || config.prefix0;
    client.id = ii;
    Handler.setup(client, token);
    clients.push(client);
}

const app = express();

app.get("/", (_req, res) => {
    const [client] = clients;
    res.json({ version: client.version, size: client.guilds.cache.size, lastReady: client.readyAt.getTime(), uptime: client.uptime });
});

app.get("/checkGuild/:guild", async (req, res) => {
    var isInGuild = false;
    var id = null;
    var bot = null;
    for (const client of clients) {
        try {
            const guild = await client.guilds.fetch(req.params.guild);
            if (guild) {
                isInGuild = true;
                id = guild.id;
                bot = client.user.id;
                break;
            }
        } catch (err) { }
    }
    res.json({ guildId: id, isIn: isInGuild, botId: bot });
});

app.post("/update/:guild", (req, res) => {
    NorthClient.storage.guilds[req.params.guild] = req.body;
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000);