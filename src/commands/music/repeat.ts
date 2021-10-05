import { CommandInteraction, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { getQueues, setQueue, updateQueue } from "../../helpers/music";
import { msgOrRes } from "../../function";

class RepeatCommand implements SlashCommand {
    name = "repeat"
    description = "Toggles repeat of a soundtrack."
    aliases = ["rep", "rp"]
    category = 8

    async execute(interaction: CommandInteraction) {
        await this.repeat(interaction);
    }

    async run(message: Message) {
        await this.repeat(message);
    }

    async repeat(message: Message | CommandInteraction) {
        var serverQueue = getQueues().get(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        serverQueue.repeating = !serverQueue.repeating;
        if (serverQueue.repeating && serverQueue.looping) {
            serverQueue.looping = false;
            await msgOrRes(message, "Disabled looping to prevent conflict.");
        }
        try {
            updateQueue(message.guild.id, serverQueue);
            if (serverQueue.repeating) await msgOrRes(message, "The queue is now being repeated.");
            else await msgOrRes(message, "The queue is no longer being repeated.");
        } catch (err: any) {
            await msgOrRes(message, "There was an error trying to update the status!");
        }
    }
}

const cmd = new RepeatCommand();
export default cmd;