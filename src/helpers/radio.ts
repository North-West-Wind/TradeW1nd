import { RowDataPacket } from "mysql2";
import { RadioChannel } from "../classes/NorthClient";
import { globalClient as client } from "../common";
export const players: RadioChannel[] = [];

export async function makePlayers() {
    const [results] = <RowDataPacket[][]> await client.pool.query("SELECT * FROM radio");
    for (let i = 0; i < 10; i++) {
        var tracks = [];
        if (results[i]) tracks = JSON.parse(results[i].tracks);
        players[i] = new RadioChannel(tracks);
    }
}