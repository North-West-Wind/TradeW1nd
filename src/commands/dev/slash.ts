import { ChatInputCommandInteraction } from "discord.js";
import { NorthClient, ISlash, SlashCommand } from "../../classes/NorthClient.js";

class DevSlashCommand implements SlashCommand {
    name = "slash";
    description = "TradeW1nd's Slash Command Manager.";
    usage = "<subcommand>";
    aliases = ["scm"];
    category = 2;
    args = 1;
    subcommands = ["register", "refresh"];
    subdesc = ["Register all Slash Commands.", "Refresh all Slash Commands."];
    options = [
        {
            name: "register",
            description: "Register all Slash Commands.",
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: "refresh",
            description: "Refresh all Slash Commands.",
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: "delete",
            description: "Delete all Slash Commands.",
            type: ApplicationCommandOptionType.Subcommand
        }
    ];

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "register") return await this.register(interaction);
        if (sub === "refresh") return await this.refresh(interaction);
        if (sub === "delete") return await this.delete(interaction);
    }
    
    async register(interaction: ChatInputCommandInteraction) {
        await interaction.reply(`Registering Slash Commands...`);
        const client = interaction.client;
        for (const command of NorthClient.storage.commands.values()) {
            try {
                const options = {
                    name: command.name,
                    description: command.description,
                    options: (<ISlash><unknown>command).options
                };
                await client.application.commands.create(options);
            } catch (err: any) {
                console.log("Failed to create slash command " + command.name);
                console.error(err);
            }
        }
        await interaction.editReply(`Registered all Slash Commands.`);
    }

    async refresh(interaction: ChatInputCommandInteraction) {
        await interaction.reply(`Refreshing Slash Commands...`);
        const client = interaction.client;
        const commands = await client.application.commands.fetch();
        for (const command of commands.values()) {
            try {
                const cmd = NorthClient.storage.commands.get(command.name);
                if (!cmd) {
                    await client.application.commands.delete(command.id);
                    continue;
                }
                const options = {
                    name: cmd.name,
                    description: cmd.description,
                    options: (<ISlash><unknown>cmd).options
                };
                await client.application.commands.edit(command.id, options);
            } catch (err: any) {
                console.log("Failed to refresh slash command " + command.name);
                console.error(err);
            }
        }
        await interaction.editReply(`Refreshed all Slash Commands.`);
    }

    async delete(interaction: ChatInputCommandInteraction) {
        await interaction.reply(`Deleting Slash Commands...`);
        const client = interaction.client;
        const commands = await client.application.commands.fetch();
        for (const command of commands.values()) {
            try {
                await client.application.commands.delete(command.id);
            } catch (err: any) {
                console.log("Failed to delete slash command " + command.name);
                console.error(err);
            }
        }
        await interaction.editReply(`Deleted all Slash Commands.`);
    }
}

const cmd = new DevSlashCommand();
export default cmd;
