import { ChatInputCommandInteraction } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class LoopCommand implements SlashCommand {
    name = "loop"
    description = "Toggles loop of the queue."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.loop(interaction);
    }

    async loop(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        serverQueue.looping = !serverQueue.looping;
        if (serverQueue.repeating && serverQueue.looping) {
            serverQueue.repeating = false;
            await interaction.reply("Disabled repeating to prevent conflict.");
        }
        try {
            updateQueue(interaction.guild.id, serverQueue);
            if (serverQueue.looping) await interaction.reply("The queue is now being looped.");
            else await interaction.reply("The queue is no longer being looped.");
        } catch (err: any) {
            await interaction.reply("There was an error trying to update the status!");
        }
    }
}

const cmd = new LoopCommand();
export default cmd;