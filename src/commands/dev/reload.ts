import { ApplicationCommandOptionType, ChatInputCommandInteraction } from "discord.js";
import { NorthClient, SlashCommand } from "../../classes/index.js";
import { categories } from "../../commands/information/help.js";

class ReloadCommand implements SlashCommand {
    name = "reload";
    description = "Reload command(s).";
    category = 2;

    options = [
        {
            name: "command",
            description: "The command(s) to reload.",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ];

    async execute(interaction: ChatInputCommandInteraction) {
        const commands = interaction.options.getString("command").split(/ +/);
        await interaction.deferReply();
        await this.reload(interaction, commands);
    }

    async reload(interaction: ChatInputCommandInteraction, commands: string[]) {
        for (const command of commands) {
            const cmd = NorthClient.storage.commands.get(command);
            if (!cmd?.category === undefined) continue;
            const path = `${__dirname}/../${categories[cmd.category].toLowerCase()}.js`;
            delete require.cache[require.resolve(path)];
            const comd = <SlashCommand> (await import(path)).default;
            if (comd.name) NorthClient.storage.commands.set(comd.name, comd);
        }
        await interaction.editReply(`Reloaded \`${commands.join("`, `")}\``);
    }
}

const cmd = new ReloadCommand();
export default cmd;
