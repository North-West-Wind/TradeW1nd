import { CommandInteraction, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { msgOrRes } from "../../function";
import { getQueues, setQueue, updateQueue } from "../../helpers/music";

class LoopCommand implements SlashCommand {
    name = "loop"
    description = "Toggles loop of the queue."
    category = 0
    aliases = ["lp"]

    async execute(interaction: CommandInteraction) {
        await this.loop(interaction);
    }

    async run(message: Message) {
        await this.loop(message);
    }

    async loop(message: Message | CommandInteraction) {
        var serverQueue = getQueues().get(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        serverQueue.looping = !serverQueue.looping;
        if (serverQueue.repeating && serverQueue.looping) {
            serverQueue.repeating = false;
            await msgOrRes(message, "Disabled repeating to prevent conflict.");
        }
        try {
            updateQueue(message.guild.id, serverQueue);
            if (serverQueue.looping) await msgOrRes(message, "The queue is now being looped.");
            else await msgOrRes(message, "The queue is no longer being looped.");
        } catch (err: any) {
            await msgOrRes(message, "There was an error trying to update the status!");
        }
    }
}

const cmd = new LoopCommand();
export default cmd;