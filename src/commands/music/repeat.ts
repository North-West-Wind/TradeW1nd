import { ChatInputCommandInteraction, Message } from "discord.js";

import { FullCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { msgOrRes } from "../../function.js";

class RepeatCommand implements FullCommand {
    name = "repeat"
    description = "Toggles repeat of a soundtrack."
    aliases = ["rep", "rp"]
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.repeat(interaction);
    }

    async run(message: Message) {
        await this.repeat(message);
    }

    async repeat(message: Message | ChatInputCommandInteraction) {
        let serverQueue = getQueue(message.guild.id);
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