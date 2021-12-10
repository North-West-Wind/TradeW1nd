import { CommandInteraction, Message, Role, User } from "discord.js";
import { SlashCommand } from "../../classes/NorthClient";
import { msgOrRes } from "../../function";
import { getQueue } from "../../helpers/music";

class AllowCommand implements SlashCommand {
    name = "allow"
    description = "Allows a user or role to alter the queue."
    aliases = ["al"]
    usage = "<user | role>"
    category = 0
    options = [{
        name: "mentionable",
        description: "The user or role to allow.",
        required: true,
        type: "MENTIONABLE"
    }]

    async execute(interaction: CommandInteraction) {
        const mentionable = interaction.options.getMentionable("mentionable");
        if (mentionable instanceof User) return await this.addUser(interaction, mentionable);
        else if (mentionable instanceof Role) return await this.addRole(interaction, mentionable);
        await interaction.reply("The type of mention is unknown!");
    }

    async run(message: Message, args: string[]) {
        try {
            const role = await message.guild.roles.fetch(args[0]);
            return await this.addRole(message, role);
        } catch (err) {
            const user = await message.guild.members.fetch(args[0]);
            if (user) return await this.addUser(message, user.user);
            else await message.channel.send("The type of mention is unknown!");
        }
    }

    async addUser(message: Message | CommandInteraction, user: User) {
        const serverQueue = getQueue(message.guildId);
        if (!serverQueue.playing) return await msgOrRes(message, "I'm not playing!");
        serverQueue.callers.add(user.id);
    }

    async addRole(message: Message | CommandInteraction, role: Role) {
        const serverQueue = getQueue(message.guildId);
        if (!serverQueue.playing) return await msgOrRes(message, "I'm not playing!");
        serverQueue.callRoles.add(role.id);
    }
}

const cmd = new AllowCommand();
export default cmd;