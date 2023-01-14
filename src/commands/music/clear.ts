import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/index.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class ClearCommand implements SlashCommand {
    name = "clear"
    description = "Clears the queue and stop the playing soundtrack. Also resets the volume to 100%."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.clear(interaction);
    }

    async clear(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await interaction.reply("The queue is already empty!");
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to clear the queue when the bot is playing!");
        serverQueue?.player?.stop();
        serverQueue?.destroy();
        updateQueue(interaction.guild.id, null);
        await interaction.reply("The queue has been cleared!");
    }
}

const cmd = new ClearCommand();
export default cmd;