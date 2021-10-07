import { CommandInteraction, GuildMember, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { moveArray, msgOrRes } from "../../function";
import { getQueues, setQueue, updateQueue } from "../../helpers/music";
import { play } from "./play";

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

    async execute(interaction: CommandInteraction) {
        const queueIndex = interaction.options.getInteger("index");
        const amount = interaction.options.getInteger("count") || 1;
        if (amount < 1) return await interaction.reply("The delete count must be larger than 0!");
        await this.remove(interaction, queueIndex, amount);
    }

    async run(message: Message, args: string[]) {
        const queueIndex = parseInt(args[0]);
        const amount = parseInt(args[1]) || 1;
        if (isNaN(queueIndex)) return await message.channel.send("The query provided is not a number.");
        if (amount < 1) return await message.channel.send("The delete count must be larger than 0!");
        await this.remove(message, queueIndex, amount);
    }

    async remove(message: Message | CommandInteraction, queueIndex: number, amount: number) {
        var serverQueue = getQueues().get(message.guild.id);
        if (((<GuildMember> message.member).voice.channelId !== message.guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to alter the queue when the bot is playing!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await msgOrRes(message, "There is nothing in the queue.");
        const deleteIndex = queueIndex < 0 ? serverQueue.songs.length + queueIndex : queueIndex - 1;
        if (deleteIndex > serverQueue.songs.length - 1 || queueIndex === 0) return await msgOrRes(message, `You cannot remove a soundtrack that doesn't exist.`);
        const song = serverQueue.songs[deleteIndex];
        const oldSong = serverQueue.songs[0];
        const title = song.title;
        const removed = serverQueue.songs.splice(deleteIndex, amount);
        updateQueue(message.guild.id, serverQueue);
        await msgOrRes(message, `${removed.length > 1 ? `**${removed.length} tracks** have` : `**${title}** has`} been removed from the queue.`);
        if (oldSong != serverQueue.songs[0] && serverQueue.playing) {
            serverQueue.stop();
            if (!serverQueue.random) await play(message.guild, serverQueue.songs[0]);
            else {
                const int = Math.floor(Math.random() * serverQueue.songs.length);
                const pending = serverQueue.songs[int];
                serverQueue.songs = moveArray(serverQueue.songs, int);
                updateQueue(message.guild.id, serverQueue);
                await play(message.guild, pending);
            }
        }
    }
}

const cmd = new RemoveCommand();
export default cmd;