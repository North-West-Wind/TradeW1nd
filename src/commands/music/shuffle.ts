import { ChatInputCommandInteraction, GuildMember, Message } from "discord.js";

import { FullCommand } from "../../classes/NorthClient.js";
import { msgOrRes, shuffleArray } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class ShuffleCommand implements FullCommand {
    name = "shuffle"
    description = "Shuffles the queue."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.shuffle(interaction);
    }

    async run(message: Message) {
        await this.shuffle(message);
    }

    async shuffle(message: Message | ChatInputCommandInteraction) {
        let serverQueue = getQueue(message.guild.id);
        if (!Array.isArray(serverQueue?.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (!serverQueue || serverQueue.songs.length < 1) return await msgOrRes(message, "There is nothing in the queue.");
        if (((<GuildMember> message.member).voice.channelId !== message.guild.members.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to shuffle the queue when the bot is playing!");
        if (serverQueue.playing) serverQueue.songs = shuffleArray(serverQueue.songs, 1);
        else serverQueue.songs = shuffleArray(serverQueue.songs, 0);
        updateQueue(message.guild.id, serverQueue);
        await msgOrRes(message, "The queue has been shuffled.");
    }
}

const cmd = new ShuffleCommand();
export default cmd;