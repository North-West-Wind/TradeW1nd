import { CommandInteraction, GuildMember, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { moveArray, msgOrRes } from "../../function";
import { getQueues, setQueue, updateQueue } from "../../helpers/music";
import { play } from "./play";

class ReverseCommand implements SlashCommand {
    name = "reverse"
    description = "Reverses the order of the server queue."
    aliases = ["rev"]
    category = 8

    async execute(interaction: CommandInteraction) {
        await this.reverse(interaction);
    }

    async run(message: Message) {
        await this.reverse(message);
    }

    async reverse(message: Message | CommandInteraction) {
        var serverQueue = getQueues().get(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await msgOrRes(message, "Nothing is in the queue now.");
        if (((<GuildMember> message.member).voice.channelId !== message.guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to alter the queue when the bot is playing!");
        var oldSong = serverQueue.songs[0];
        serverQueue.songs.reverse();
        await msgOrRes(message, "The queue has been reversed!");
        updateQueue(message.guild.id, serverQueue);
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

const cmd = new ReverseCommand();
export default cmd;