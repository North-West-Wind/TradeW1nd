import { ApplicationCommandOptionType, ChatInputCommandInteraction, GuildMember, Role, User } from "discord.js";
import { SlashCommand } from "../../classes/NorthClient.js";
import { getQueue } from "../../helpers/music.js";

class AllowCommand implements SlashCommand {
    name = "allow"
    description = "Allows a user or role to alter the queue."
    category = 0
    options = [{
        name: "mentionable",
        description: "The user or role to allow.",
        required: true,
        type: ApplicationCommandOptionType.Mentionable
    }]

    async execute(interaction: ChatInputCommandInteraction) {
        const mentionable = interaction.options.getMentionable("mentionable");
        if (mentionable instanceof User) return await this.addUser(interaction, mentionable);
        else if (mentionable instanceof GuildMember) return await this.addUser(interaction, mentionable.user);
        else if (mentionable instanceof Role) return await this.addRole(interaction, mentionable);
        await interaction.reply("The type of mention is unknown!");
    }

    async addUser(interaction: ChatInputCommandInteraction, user: User) {
        const serverQueue = getQueue(interaction.guildId);
        if (!serverQueue.playing) return await interaction.reply("I'm not playing!");
        serverQueue.callers.add(user.id);
    }

    async addRole(interaction: ChatInputCommandInteraction, role: Role) {
        const serverQueue = getQueue(interaction.guildId);
        if (!serverQueue.playing) return await interaction.reply("I'm not playing!");
        serverQueue.callRoles.add(role.id);
    }
}

const cmd = new AllowCommand();
export default cmd;