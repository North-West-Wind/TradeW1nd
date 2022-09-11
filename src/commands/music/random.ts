import { ChatInputCommandInteraction } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class RandomCommand implements SlashCommand {
    name = "random"
    description = "Plays the queue randomly."
    aliases = ["rnd"]
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return await interaction.reply("This command only works on server.");
        await this.random(interaction);
    }

    async random(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        serverQueue.random = !serverQueue.random;
        if (serverQueue.repeating && serverQueue.random) {
            serverQueue.repeating = false;
            await interaction.reply("Disabled repeating to prevent conflict.");
        }
        if (serverQueue.random) await interaction.reply("The queue will be played randomly.");
        else await interaction.reply("The queue will be played in order.");
        updateQueue(interaction.guild.id, serverQueue);
    }
}

const cmd = new RandomCommand();
export default cmd;