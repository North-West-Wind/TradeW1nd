import { Snowflake } from "discord-api-types";
import { RowDataPacket } from "mysql2";
import { RadioChannel } from "../classes/NorthClient";
import { globalClient as client } from "../common";
export const players: RadioChannel[] = [];

export async function makePlayers() {
    const [results] = <RowDataPacket[][]> await client.pool.query("SELECT * FROM radio");
    for (let i = 0; i < 10; i++) {
        var tracks = [];
        if (results[i]) tracks = JSON.parse(unescape(results[i].queue));
        players[i] = new RadioChannel(i + 1, tracks, results[i].seek, results[i].guilds.split(","));
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
    await client.pool.query(`UPDATE radio SET guilds = "${[...players[channel - 1].guilds].join()}" WHERE id = ${channel}`);
}

export async function removePlaying(guildId: Snowflake) {
    const index = findPlaying(guildId);
    if (!index) return;
    players[index].guilds.delete(guildId);
    await client.pool.query(`UPDATE radio SET guilds = "${[...players[index].guilds].join()}" WHERE id = ${index + 1}`);
}