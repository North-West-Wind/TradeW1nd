import { ClientStorage, NorthClient, SlashCommand } from "./classes/NorthClient";
import { deepReaddir } from "./function";
import * as mysql from "mysql2";
import * as fs from "fs";
import { Handler } from "./handler";
import isOnline from "is-online";
const { version } = require("../package.json");
var globalClient: NorthClient;

process.on('unhandledRejection', (reason) => {
  console.error('Reason:', reason);
  if (typeof reason === "string" && reason.includes("EAI_AGAIN")) {
    async function check() {
      if (await isOnline()) reloadClient();
      else setTimeout(check, 30000);
    }
    check();
  }
});

function reloadClient() {
  const options = globalClient.options;
  const token = globalClient.token;
  const prefix = globalClient.prefix;
  const id = globalClient.id;
  globalClient.destroy();

  globalClient = new NorthClient(options);
  NorthClient.storage = new ClientStorage();
  
  globalClient.prefix = prefix;
  globalClient.id = id;

  Handler.setup(globalClient, token);
}

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