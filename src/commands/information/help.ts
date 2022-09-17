import { NorthClient, SlashCommand } from "../../classes/NorthClient.js";
import { color, deepReaddir, fixGuildRecord } from "../../function.js";
import * as Discord from "discord.js";
import { getClients } from "../../main.js";
import { ApplicationCommandOptionType } from "discord.js";

export const categories = ["Music", "Information", "Dev"];

class HelpCommand implements SlashCommand {
    name = "help"
    description = "Sends you a DM with an embed of all available commands and the user manual."
    category = 1
    options = [
        {
            name: "all",
            description: "Display all the commands.",
            type: ApplicationCommandOptionType.Subcommand
        }
    ];

    constructor() {
        const commandFiles = deepReaddir("./out/commands").filter(file => file.endsWith(".js"));
        (async () => {
            const preloaded: SlashCommand[] = [];
            for (const file of commandFiles) {
                const command = <SlashCommand>(await import(file)).default;
                preloaded.push(command);
            }
            for (const category of categories) {
                const fetchOpt = {
                    name: "command",
                    description: "The command to fetch.",
                    required: true,
                    type: ApplicationCommandOptionType.String,
                    choices: preloaded.filter(command => command.category === categories.indexOf(category)).map(x => ({ name: x.name, value: x.name }))
                };
                const option = {
                    name: category.toLowerCase(),
                    description: `${category} - Command Category`,
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [fetchOpt]
                };
                this.options.push(option);
            }
        })();
    }

    async execute(interaction: Discord.ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "all") await interaction.reply({ embeds: [await this.getAllCommands(interaction.guildId)], ephemeral: true });
        else {
            const name = interaction.options.getString("command");
            await interaction.reply({ content: this.getCommand(name, "/").join("\n"), ephemeral: true });
        }
    }

    async getAllCommands(guildID: Discord.Snowflake) {
        const [client] = getClients();
        let config = NorthClient.storage.guilds[guildID];
        if (!config) config = await fixGuildRecord(guildID);
        const Embed = new Discord.EmbedBuilder()
            .setColor(color())
            .setTitle("Command list is here!")
            .setDescription(`[**Click this**](https://northwestwind.ml/n0rthwestw1nd/manual/tradew1nd) for the user manual.\nIf you need any support, you can join the [**Support Server**](https://discord.gg/S44PNSh)\n\nI don't know if you need but [**here's N0rthWestW1nd**](https://top.gg/bot/649611982428962819) in [**Discord bot List**](https://top.gg)!`)
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: "Have a nice day! :)", iconURL: client.user.displayAvatarURL() });
        for (let i = 0; i < categories.length; i++) {
            Embed.addFields([{ name: `**${categories[i]}**`, value: Array.from(NorthClient.storage.commands.filter(x => x.category === i).keys()).join("\n"), inline: true }]);
        }
        return Embed;
    }

    getCommand(name: string, prefix: string) {
        const data = [];
        const { commands } = NorthClient.storage;
        const command = commands.get(name);
        if (!command) return ["That's not a valid command!"];
        data.push(`**Name:** ${command.name}`);

        if (command.description) data.push(`**Description:** ${command.description}`);
        function writeArguments(upperOption: any, strPrefix = "") {
            let addition = "";
            for (let kk = 0; kk < upperOption.options.length; kk++) {
                const opt = upperOption.options[kk];
                const wrap = opt.required;
                addition += ` \`${wrap ? "[" : ""}${opt.name}: ${ApplicationCommandOptionType[opt.type]}${wrap ? "[" : ""}\``;
                data.push(`${strPrefix}• **${opt.name}:** ${opt.description}`);
            }
            return addition;
        }
        function writeSubcommands(upperOption: any, strPrefix = "") {
            data.push(`${strPrefix}${strPrefix ? "  " : ""}**Subcommand(s):**`);
            for (let jj = 0; jj < upperOption.options.length; jj++) {
                const sub = upperOption.options[jj];
                data.push(`${strPrefix}\t• **${sub.name}**: ${sub.description}`);
                const index = data.length;
                data[index] = `${strPrefix}\t  **Usage(s):** ${prefix}${command.name}`;
                if (upperOption.type === ApplicationCommandOptionType.SubcommandGroup) data[index] += ` ${upperOption.name}`;
                data[index] += ` ${sub.name}`;
                if (sub.options) data[index] += writeArguments(sub, strPrefix + "\t\t");
            }
        }
        if (command.options) {
            if (command.options[0].type === ApplicationCommandOptionType.SubcommandGroup) {
                data.push("**Subcommand Group(s):**");
                for (let ii = 0; ii < command.options.length; ii++) {
                    const subGroup = command.options[ii];
                    data.push(`\t• **${subGroup.name}**: ${subGroup.description}`);
                    writeSubcommands("\t");
                }
            } else if (command.options[0].type === ApplicationCommandOptionType.Subcommand) writeSubcommands(command);
            else {
                const index = data.length;
                data[index] = `**Usage(s):** ${prefix}${command.name}`;
                data[index] += writeArguments(command, "\t");
            }
        }
        return data;
    }
}

const cmd = new HelpCommand();
export default cmd;
