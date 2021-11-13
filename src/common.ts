import { NorthClient, SlashCommand } from "./classes/NorthClient";
import { deepReaddir } from "./function";
import * as mysql from "mysql2";
import * as fs from "fs";
const { version } = require("../package.json");
var globalClient: NorthClient;

process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason));
process.on('exit', () => fs.rmSync(process.env.CACHE_DIR, { recursive: true, force: true }));

export default async (client: NorthClient) => {
  const mysql_config = {
    connectTimeout: 30000,
    connectionLimit: 10,
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password: process.env.DBPW,
    database: process.env.DBNAME,
    supportBigNumbers: true,
    charset: "utf8mb4"
  };

  const commandFiles = deepReaddir("./out/commands").filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = <SlashCommand>(await import(file)).default;
    NorthClient.storage.commands.set(command.name, command);
  }
  if (!fs.existsSync(process.env.CACHE_DIR)) fs.mkdirSync(process.env.CACHE_DIR);

  var pool = mysql.createPool(mysql_config).promise();
  pool.on("connection", con => con.on("error", async err => {
    if (["PROTOCOL_CONNECTION_LOST", "ECONNREFUSED", "ETIMEDOUT"].includes(err.code) || (err.message === "Pool is closed.")) try {
      await pool.end();
    } catch (err: any) {
      console.error(err);
    } finally {
        pool = mysql.createPool(mysql_config).promise();
        client.setPool(pool);
      }
  }));
  client.setPool(pool);
  client.setVersion(version);
  globalClient = client;
}

export { globalClient };