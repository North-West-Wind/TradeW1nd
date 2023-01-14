import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { SlashCommand } from "../../classes/index.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class ResumeCommand implements SlashCommand {
    name = "resume"
    description = "Resumes the paused music."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.resume(interaction);
    }

    async resume(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to resume the music when the bot is playing!");
        if (!serverQueue?.player) return await interaction.reply("There is nothing playing.");
        if (serverQueue.paused) {
            serverQueue.paused = false;
            serverQueue.player?.unpause();
            await interaction.reply("The playback has been resumed.");
            updateQueue(interaction.guild.id, serverQueue, false);
        } else {
            await interaction.reply("The playback is not stopped.");
        }
    }
}

const cmd = new ResumeCommand();
export default cmd;