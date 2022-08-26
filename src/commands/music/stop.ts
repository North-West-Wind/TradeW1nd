import { ChatInputCommandInteraction, GuildMember, Message } from "discord.js";

import { FullCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { msgOrRes } from "../../function.js";

class StopCommand implements FullCommand {
    name = "stop"
    description = "Stops the music and disconnect the bot from the voice channel."
    aliases = ["end", "disconnect", "dis"]
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await this.stop(interaction);
    }

    async run(message: Message) {
        await this.stop(message);
    }

    async stop(message: Message | ChatInputCommandInteraction) {
        var serverQueue = getQueue(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (((<GuildMember> message.member).voice.channelId !== message.guild.members.me.voice.channelId) && serverQueue?.playing) return await msgOrRes(message, "You have to be in a voice channel to stop the music when the bot is playing!");
        serverQueue.destroy();
        serverQueue.playing = false;
        serverQueue.connection = null;
        serverQueue.voiceChannel = null;
        serverQueue.textChannel = null;
        serverQueue.clean();
        if (message instanceof Message) await message.react("👋");
        else await msgOrRes(message, ":wave:");
        updateQueue(message.guild.id, serverQueue, false);
    }
}

const cmd = new StopCommand();
export default cmd;