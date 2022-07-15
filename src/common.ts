import { ClientStorage, NorthClient, FullCommand, Command } from "./classes/NorthClient.js";
import { deepReaddir } from "./function.js";
import * as fs from "fs";
import isOnline from "is-online";
import SimpleNodeLogger from "simple-node-logger";
import { Handler } from "./handler.js";
import { getClients, setClient } from "./main.js";

const pkg = JSON.parse(fs.readFileSync("package.json", { encoding: "utf8" }));

process.on('unhandledRejection', (reason) => {
  console.error('Reason:', reason);
  if (typeof reason === "string" && reason.includes("EAI_AGAIN")) {
    async function check() {
      if (await isOnline()) reloadClients();
      else setTimeout(check, 30000);
    }
    check();
  }
});

function reloadClients() {
  const clients = getClients();
  for (let ii = 0; ii < clients.length; ii++) {
    var client = clients[ii];
    const options = client.options;
    const token = client.token;
    const prefix = client.prefix;
    const id = client.id;
    client.destroy();
  
    client = new NorthClient(options);
    NorthClient.storage = new ClientStorage();
  
    client.prefix = prefix;
    client.id = id;
  
    Handler.setup(client, token);
    setClient(ii, client);
  }
}

export default async (client: NorthClient) => {
  if (client.id) return;
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
  const commandFiles = deepReaddir("./out/commands").filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = <Command>(await import(file)).default;
    NorthClient.storage.commands.set(command.name, command);
  }
  if (!fs.existsSync(process.env.CACHE_DIR)) fs.mkdirSync(process.env.CACHE_DIR);
  client.setVersion(pkg.version);
}