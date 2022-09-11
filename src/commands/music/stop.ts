import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class StopCommand implements SlashCommand {
    name = "stop"
    description = "Stops the music and disconnect the bot from the voice channel."
    aliases = ["end", "disconnect", "dis"]
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.stop(interaction);
    }

    async stop(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue?.playing) return await interaction.reply("You have to be in a voice channel to stop the music when the bot is playing!");
        serverQueue.destroy();
        serverQueue.playing = false;
        serverQueue.connection = null;
        serverQueue.voiceChannel = null;
        serverQueue.textChannel = null;
        serverQueue.clean();
        await interaction.reply(":wave:");
        updateQueue(interaction.guild.id, serverQueue, false);
    }
}

const cmd = new StopCommand();
export default cmd;