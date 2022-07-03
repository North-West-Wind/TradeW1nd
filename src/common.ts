import { ClientStorage, NorthClient, SlashCommand } from "./classes/NorthClient.js";
import { deepReaddir } from "./function.js";
import * as fs from "fs";
import isOnline from "is-online";
import SimpleNodeLogger from "simple-node-logger";
import { Handler } from "./handler.js";
import pkg from "../package.json" assert { type: "json" };
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
  if (!fs.existsSync("log")) fs.mkdirSync("log");
  const logger = SimpleNodeLogger.createSimpleLogger({
		logFilePath: `log/console_${client.id}.log`,
		timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
	});
  logger.setLevel("all");
  console.log = (message: string, ...data: any[]) => logger.info(message, ...data);
  console.error = (message: string, ...data: any[]) => logger.error(message, ...data);
  console.debug = (message: string, ...data: any[]) => logger.debug(message, ...data);
  console.trace = (message: string, ...data: any[]) => logger.trace(message, ...data);
  const commandFiles = deepReaddir("./out/src/commands").filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = <SlashCommand>(await import(file)).default;
    NorthClient.storage.commands.set(command.name, command);
  }
  if (!fs.existsSync(process.env.CACHE_DIR)) fs.mkdirSync(process.env.CACHE_DIR);
  client.setVersion(pkg.version);
  globalClient = client;
}

export { globalClient };