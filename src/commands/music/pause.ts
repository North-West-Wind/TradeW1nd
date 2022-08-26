import { ChatInputCommandInteraction, GuildMember, Message } from "discord.js";

import { FullCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { msgOrRes } from "../../function.js";

class PauseCommand implements FullCommand {
    name = "pause"
    description = "Pauses the current music."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.pause(interaction);
    }

    async run(message: Message) {
        await this.pause(message);
    }

    async pause(message: Message | ChatInputCommandInteraction) {
        let serverQueue = getQueue(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (((<GuildMember> message.member).voice.channelId !== message.guild.members.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to pause the music when the bot is playing!");
        if (!serverQueue?.player) return await msgOrRes(message, "There is nothing playing.");
        if (!serverQueue.paused) {
            serverQueue.paused = true;
            serverQueue.player?.pause(true);
            updateQueue(message.guild.id, serverQueue);
            return await msgOrRes(message, "The playback has been stopped.");
        } else {
            return await msgOrRes(message, "The playback is already stopped.");
        }
    }
}

const cmd = new PauseCommand();
export default cmd;