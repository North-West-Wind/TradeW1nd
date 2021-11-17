import { Snowflake } from "discord-api-types";
import { RowDataPacket } from "mysql2";
import { RadioChannel } from "../classes/NorthClient";
import { globalClient as client } from "../common";
export const players: RadioChannel[] = [];
export const playing: Set<Snowflake> = new Set();

export async function makePlayers() {
    const [results] = <RowDataPacket[][]> await client.pool.query("SELECT * FROM radio");
    for (let i = 0; i < 10; i++) {
        var tracks = [];
        if (results[i]) tracks = JSON.parse(unescape(results[i].queue));
        console.log(`Radio Channel #${i + 1} has ${tracks.length} tracks.`);
        players[i] = new RadioChannel(i + 1, tracks);
    }
}