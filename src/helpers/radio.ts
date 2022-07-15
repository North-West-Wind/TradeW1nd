import { Snowflake } from "discord.js";
import { RadioChannel } from "../classes/NorthClient.js";
import { query } from "../function.js";
export const players: RadioChannel[] = [];

export async function makePlayers() {
    if (players.length) return;
    const results = await query("SELECT * FROM radio");
    for (let i = 0; i < 10; i++) {
        var tracks = [];
        if (results[i]) tracks = JSON.parse(unescape(results[i].queue));
        players[i] = new RadioChannel(i + 1, tracks, results[i].seek, results[i].guilds.split(",").filter(x => !!x));
    }
}

function findPlaying(guildId: Snowflake) {
    for (let i = 0; i < 10; i++) { if (players[i].guilds.has(guildId)) return i; }
    return -1;
}

export function isPlaying(guildId: Snowflake) {
    return !!(findPlaying(guildId) + 1);
}

export async function addPlaying(channel: number, guildId: Snowflake) {
    players[channel - 1].guilds.add(guildId);
    await query(`UPDATE radio SET guilds = "${[...players[channel - 1].guilds].join()}" WHERE id = ${channel}`);
}

export async function removePlaying(guildId: Snowflake) {
    const index = findPlaying(guildId);
    if (index < 0) return;
    players[index].guilds.delete(guildId);
    await query(`UPDATE radio SET guilds = "${[...players[index].guilds].join()}" WHERE id = ${index + 1}`);
}