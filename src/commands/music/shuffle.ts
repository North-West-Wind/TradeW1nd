import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/index.js";
import { shuffleArray } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class ShuffleCommand implements SlashCommand {
    name = "shuffle"
    description = "Shuffles the queue."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.shuffle(interaction);
    }

    async shuffle(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!Array.isArray(serverQueue?.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (!serverQueue || serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue.");
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to shuffle the queue when the bot is playing!");
        if (serverQueue.playing) serverQueue.songs = shuffleArray(serverQueue.songs, 1);
        else serverQueue.songs = shuffleArray(serverQueue.songs, 0);
        updateQueue(interaction.guild.id, serverQueue);
        await interaction.reply("The queue has been shuffled.");
    }
}

const cmd = new ShuffleCommand();
export default cmd;