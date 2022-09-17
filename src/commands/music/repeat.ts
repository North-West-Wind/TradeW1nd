import { ChatInputCommandInteraction } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class RepeatCommand implements SlashCommand {
    name = "repeat"
    description = "Toggles repeat of a soundtrack."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.repeat(interaction);
    }

    async repeat(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        serverQueue.repeating = !serverQueue.repeating;
        if (serverQueue.repeating && serverQueue.looping) {
            serverQueue.looping = false;
            await interaction.reply("Disabled looping to prevent conflict.");
        }
        if (serverQueue.repeating) await interaction.reply("The queue is now being repeated.");
        else await interaction.reply("The queue is no longer being repeated.");
        updateQueue(interaction.guild.id, serverQueue);
    }
}

const cmd = new RepeatCommand();
export default cmd;