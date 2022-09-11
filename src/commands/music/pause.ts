import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class PauseCommand implements SlashCommand {
    name = "pause"
    description = "Pauses the current music."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.pause(interaction);
    }

    async pause(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to pause the music when the bot is playing!");
        if (!serverQueue?.player) return await interaction.reply("There is nothing playing.");
        if (!serverQueue.paused) {
            serverQueue.paused = true;
            serverQueue.player?.pause(true);
            updateQueue(interaction.guild.id, serverQueue);
            return await interaction.reply("The playback has been stopped.");
        } else {
            return await interaction.reply("The playback is already stopped.");
        }
    }
}

const cmd = new PauseCommand();
export default cmd;