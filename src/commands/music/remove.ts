import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { moveArray } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { play } from "./play.js";

class RemoveCommand implements SlashCommand {
    name = "remove"
    description = "Removes soundtrack(s) from the queue."
    usage = "<index | starting index> [delete count]"
    category = 0
    args = 1
    options = [
        {
            name: "index",
            description: "The index of the soundtrack to be removed.",
            required: true,
            type: "INTEGER"
        },
        {
            name: "count",
            description: "The amount of soundtrack to delete after the index.",
            required: false,
            type: "INTEGER"
        }
    ]

    async execute(interaction: ChatInputCommandInteraction) {
        const queueIndex = interaction.options.getInteger("index");
        const amount = interaction.options.getInteger("count") || 1;
        if (amount < 1) return await interaction.reply("The delete count must be larger than 0!");
        await this.remove(interaction, queueIndex, amount);
    }

    async remove(interaction: ChatInputCommandInteraction, queueIndex: number, amount: number) {
        let serverQueue = getQueue(interaction.guild.id);
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to alter the queue when the bot is playing!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue.");
        const deleteIndex = queueIndex < 0 ? serverQueue.songs.length + queueIndex : queueIndex - 1;
        if (deleteIndex > serverQueue.songs.length - 1 || queueIndex === 0) return await interaction.reply(`You cannot remove a soundtrack that doesn't exist.`);
        const song = serverQueue.songs[deleteIndex];
        const oldSong = serverQueue.songs[0];
        const title = song.title;
        const removed = serverQueue.songs.splice(deleteIndex, amount);
        updateQueue(interaction.guild.id, serverQueue);
        await interaction.reply(`${removed.length > 1 ? `**${removed.length} tracks** have` : `**${title}** has`} been removed from the queue.`);
        if (oldSong != serverQueue.songs[0] && serverQueue.playing) {
            serverQueue.stop();
            if (!serverQueue.random) await play(interaction.guild, serverQueue.songs[0]);
            else {
                const int = Math.floor(Math.random() * serverQueue.songs.length);
                const pending = serverQueue.songs[int];
                serverQueue.songs = moveArray(serverQueue.songs, int);
                updateQueue(interaction.guild.id, serverQueue);
                await play(interaction.guild, pending);
            }
        }
    }
}

const cmd = new RemoveCommand();
export default cmd;