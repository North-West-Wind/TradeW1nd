import * as dotenv from "dotenv";
import { Handler } from "./handler.js";
import { NorthClient, ClientStorage, ISlash } from "./classes/index.js";
import { GatewayIntentBits, Options, Partials } from "discord.js";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import { removeUsing } from "./helpers/music.js";
import { downloading } from "./commands/music/download.js";
dotenv.config();

for (const file of fs.readdirSync(process.env.CACHE_DIR)) {
    if (fs.statSync(`${process.env.CACHE_DIR}/${file}`).isDirectory()) fs.rmSync(`${process.env.CACHE_DIR}/${file}`, { recursive: true });
    removeUsing(file);
}

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
    
    client.prefix = process.env.PREFIX;
    client.id = ii;
    Handler.setup(client, token);
    clients.push(client);
}

const app = express();
app.use(cors());

app.get("/", (_req, res) => {
    const data = [];
    for (const client of clients)
        data.push({ id: client.user.id, version: client.version, size: client.guilds.cache.size, lastReady: client.readyAt.getTime(), uptime: client.uptime });
    res.json(data);
});

app.get("/checkGuild/:guild", async (req, res) => {
    let isInGuild = false;
    let id = null;
    let bot = null;
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

app.get("/download/:guild", (req, res) => {
    if (!downloading.has(req.params.guild)) {
        if (fs.existsSync(`${process.env.CACHE_DIR}/${req.params.guild}.zip`)) res.json({ downloading: false, finished: true, percentage: 1 });
        else res.json({ downloading: false, finished: false, percentage: 0 });
    } else res.json({ downloading: true, finished: false, percentage: downloading.get(req.params.guild) });
});

app.get("/download/file/:guild", (req, res) => {
    if (fs.existsSync(`${process.env.CACHE_DIR}/${req.params.guild}.zip`)) res.download(`${process.env.CACHE_DIR}/${req.params.guild}.zip`);
    else res.sendStatus(404);
});

var registering = false;
app.get("/reg-slash", async (req, res) => {
    if (req.query.token !== process.env.DB_TOKEN) return res.sendStatus(403);
    if (registering) return res.sendStatus(429);
    console.log("Received slash register request")
    res.sendStatus(200);
    registering = true;
    for (const client of clients) {
        for (const command of NorthClient.storage.commands.values()) {
            try {
                const options = {
                    name: command.name,
                    description: command.description,
                    options: (<ISlash><unknown>command).options
                };
                await client.application.commands.create(options);
            } catch (err: any) {
                console.log("Failed to create slash command " + command.name);
                console.error(err);
            }
        }
    }
    registering = false;
});

app.listen(process.env.PORT || 3000);