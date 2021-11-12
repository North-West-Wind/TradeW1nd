import { CommandInteraction, Message } from "discord.js";
import { NorthClient, SlashCommand } from "../../classes/NorthClient";
import { categories } from "../../commands/information/help";
import { msgOrRes } from "../../function";

class ReloadCommand implements SlashCommand {
    name = "reload";
    description = "Reload command(s).";
    usage = "<command>";
    aliases = ["rl"];
    category = 2;
    args = 1;

    options = [
        {
            name: "command",
            description: "The command(s) to reload.",
            type: "STRING",
            required: true
        }
    ];

    async execute(interaction: CommandInteraction) {
        const commands = interaction.options.getString("command").split(/ +/);
        await interaction.deferReply();
        await this.reload(interaction, commands);
    }

    async run(message: Message, args: string[]) {
        await this.reload(message, args);
    }

    async reload(message: Message | CommandInteraction, commands: string[]) {
        for (const command of commands) {
            const cmd = NorthClient.storage.commands.get(command);
            if (!cmd?.category === undefined) continue;
            const path = `${__dirname}/../${categories[cmd.category].toLowerCase()}.js`;
            delete require.cache[require.resolve(path)];
            const comd = <SlashCommand> (await import(path)).default;
            if (comd.name) NorthClient.storage.commands.set(comd.name, comd);
        }
        await msgOrRes(message, `Reloaded \`${commands.join("`, `")}\``);
    }
}

const cmd = new ReloadCommand();
export default cmd;
