import { NorthClient, SlashCommand } from "../../classes/NorthClient.js";
import { color, deepReaddir, fixGuildRecord, messagePrefix, wait } from "../../function.js";
import * as Discord from "discord.js";
import { globalClient as client } from "../../common.js";

export const categories = ["Music", "Information", "Dev"];

class HelpCommand implements SlashCommand {
    name = "help"
    description = "Sends you a DM with an embed of all available commands and the user manual."
    usage = "[command]"
    cooldown = 5
    category = 1
    options: any[];

    constructor() {
        this.options = [
            {
                name: "all",
                description: "Display all the commands.",
                type: "SUB_COMMAND"
            }
        ];
        const commandFiles = deepReaddir("./out/src/commands").filter(file => file.endsWith(".js"));
        for (const category of categories) {
            const fetchOpt = {
                name: "command",
                description: "The command to fetch.",
                required: true,
                type: "STRING",
                choices: commandFiles.map(async file => (await import(file)).default).filter(command => command.category === categories.indexOf(category)).map(x => ({ name: x.name, value: x.name }))
            };
            const option = {
                name: category.toLowerCase(),
                description: `${category} - Command Category`,
                type: "SUB_COMMAND",
                options: [fetchOpt]
            };
            this.options.push(option);
        }
    }

    async execute(interaction: Discord.CommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "all") {
            try {
                await interaction.user.send({ embeds: [await this.getAllCommands(interaction.guildId)] });
                await interaction.reply({ content: "Slid into your DM!", ephemeral: true });
            } catch (err) {
                await interaction.reply({ embeds: [await this.getAllCommands(interaction.guildId)], ephemeral: true });
            }
        } else {
            const name = interaction.options.getString("command").toLowerCase();
            await interaction.reply({ content: this.getCommand(name, "/").join("\n"), ephemeral: true });
        }
    }

    async run(message: Discord.Message, args: string[]) {
        if (!args.length) {
            try {
                await message.author.send({ embeds: [await this.getAllCommands(message.guildId)] });
                await message.react("💨");
            } catch (err) {
                const msg = await message.channel.send({ embeds: [await this.getAllCommands(message.guildId)] });
                await wait(30000);
                msg.delete().catch(() => { });
            }
        } else {
            const name = args[0].toLowerCase();
            await message.channel.send(this.getCommand(name, messagePrefix(message, client)).join("\n"));
        }
    }

    async getAllCommands(guildID: Discord.Snowflake) {
        var config = NorthClient.storage.guilds[guildID];
        if (!config) config = await fixGuildRecord(guildID);
        const Embed = new Discord.MessageEmbed()
            .setColor(color())
            .setTitle("Command list is here!")
            .setDescription(`[**Click this**](https://northwestwind.ml/n0rthwestw1nd/manual/tradew1nd) for the user manual.\nIf you need any support, you can join the [**Support Server**](https://discord.gg/S44PNSh)\n\nI don't know if you need but [**here's N0rthWestW1nd**](https://top.gg/bot/649611982428962819) in [**Discord bot List**](https://top.gg)!`)
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: "Have a nice day! :)", iconURL: client.user.displayAvatarURL() });
        for (let i = 0; i < categories.length; i++) {
            Embed.addField(`**${categories[i]}**`, Array.from(NorthClient.storage.commands.filter(x => x.category === i).keys()).join("\n"), true);
        }
        return Embed;
    }

    getCommand(name: string, prefix: string) {
        const data = [];
        const { commands } = NorthClient.storage;
        const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));
        if (!command) return ["That's not a valid command!"];
        data.push(`**Name:** ${command.name}`);

        if (command.aliases) data.push(`**Aliases:** ${command.aliases.join(", ")}`);
        if (command.description) data.push(`**Description:** ${command.description}`);
        if (command.usage) data.push(`**Usage:** ${prefix}${command.name} ${command.usage}`);
        else data.push(`**Usage:** ${prefix}${command.name}`);
        if (command.subcommands) {
            const strs = [];
            for (let i = 0; i < command.subcommands.length; i++) {
                var str = "    • ";
                if (command.subaliases) str = `**${command.subcommands[i]} | ${command.subaliases[i]}**${command.subdesc ? ` - ${command.subdesc[i]}` : ""}`;
                else str = `**${command.subcommands[i]}**${command.subdesc ? ` - ${command.subdesc[i]}` : ""}`;
                str += "\n        • "
                if (command.subusage && (command.subusage[i] || command.subusage[i] == 0) && !isNaN(<number>command.subusage[i])) str += `${prefix}${command.name} ${command.subusage[command.subusage[i]].replace("<subcommand>", command.subcommands[i])}`;
                else if (command.subusage && command.subusage[i]) str += `${prefix}${command.name} ${command.subusage[i].toString().replace("<subcommand>", command.subcommands[i])}`;
                else str += `${prefix}${command.name} ${command.usage ? command.usage.replace(/(?!\s)[\<\[\w\s\|]*subcommand[\w\s\|\>\]]*/, command.subcommands[i]) : command.subcommands[i]}`;
                strs.push(str);
            }
            data.push(`**Subcommands:**\n${strs.join("\n")}`);
        }
        if (command.subcommands) data.push("\nIf you want to know how subcommands work, please refer to the manual.");
        return data;
    }
};

const cmd = new HelpCommand();
export default cmd;
