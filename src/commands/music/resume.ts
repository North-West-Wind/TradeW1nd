import { CommandInteraction, GuildMember, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { msgOrRes } from "../../function";
import { getQueue, setQueue, updateQueue } from "../../helpers/music";

class ResumeCommand implements SlashCommand {
    name = "resume"
    description = "Resumes the paused music."
    category = 0

    async execute(interaction: CommandInteraction) {
        await this.resume(interaction);
    }

    async run(message: Message) {
        await this.resume(message);
    }

    async resume(message: Message | CommandInteraction) {
        var serverQueue = getQueue(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (((<GuildMember> message.member).voice.channelId !== message.guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to resume the music when the bot is playing!");
        if (!serverQueue?.player) return await msgOrRes(message, "There is nothing playing.");
        if (serverQueue.paused) {
            serverQueue.paused = false;
            serverQueue.player?.unpause();
            updateQueue(message.guild.id, serverQueue, false);
            return await msgOrRes(message, "The playback has been resumed.");
        } else {
            return await msgOrRes(message, "The playback is not stopped.");
        }
    }
}

const cmd = new ResumeCommand();
export default cmd;