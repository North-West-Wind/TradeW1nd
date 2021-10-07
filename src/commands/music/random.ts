import { CommandInteraction, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { msgOrRes } from "../../function";
import { getQueues, setQueue, updateQueue } from "../../helpers/music";

class RandomCommand implements SlashCommand {
    name = "random"
    description = "Plays the queue randomly."
    aliases = ["rnd"]
    category = 0

    async execute(interaction: CommandInteraction) {
        if (!interaction.guild) return await interaction.reply("This command only works on server.");
        await this.random(interaction);
    }

    async run(message: Message) {
        await this.random(message);
    }

    async random(message: Message | CommandInteraction) {
        var serverQueue = getQueues().get(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        serverQueue.random = !serverQueue.random;
        try {
            updateQueue(message.guild.id, serverQueue);
            if (serverQueue.random) await msgOrRes(message, "The queue will be played randomly.");
            else await msgOrRes(message, "The queue will be played in order.");
        } catch (err: any) {
            await msgOrRes(message, "There was an error trying to update the status!");
        }
    }
}

const cmd = new RandomCommand();
export default cmd;