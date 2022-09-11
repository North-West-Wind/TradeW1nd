import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { moveArray } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { play } from "./play.js";

class ReverseCommand implements SlashCommand {
    name = "reverse"
    description = "Reverses the order of the server queue."
    aliases = ["rev"]
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.reverse(interaction);
    }

    async reverse(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await interaction.reply("Nothing is in the queue now.");
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to alter the queue when the bot is playing!");
        const oldSong = serverQueue.songs[0];
        serverQueue.songs.reverse();
        await interaction.reply("The queue has been reversed!");
        updateQueue(interaction.guild.id, serverQueue);
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

const cmd = new ReverseCommand();
export default cmd;