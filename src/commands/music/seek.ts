import { CommandInteraction, GuildMember, Message, VoiceChannel } from "discord.js";

import { ServerQueue, FullCommand } from "../../classes/NorthClient.js";
import { duration, ms, msgOrRes } from "../../function.js";
import { createDiscordJSAdapter, getQueue, setQueue } from "../../helpers/music.js";
import { joinVoiceChannel } from "@discordjs/voice";

class SeekCommand implements FullCommand {
    name = "seek"
    description = "Skips to the time specified for the current playing soundtrack."
    usage = "<time>"
    aliases = ["skipto"]
    category = 0
    options = [{
        name: "time",
        description: "The position to skip to.",
        required: true,
        type: "STRING"
    }]

    async execute(interaction: CommandInteraction) {
        var serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        var parsed = ms(interaction.options.getString("time")) || interaction.options.getString("time");
        if (typeof parsed === "string" && parsed.endsWith("%")) {
            const percentage = Number(parsed.slice(0, -1));
            if (isNaN(percentage) || percentage > 100 || percentage < 0) return await interaction.reply("The given percentage is not valid!");
            parsed = serverQueue.songs[0].time * (percentage / 100);
        } else parsed = Math.floor(parsed / 1000);
        await this.seek(interaction, serverQueue, parsed);
    }

    async run(message: Message, args: string[]) {
        var serverQueue = getQueue(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (args.length < 1) return await message.channel.send("You didn't provide the time to skip to!");
        var parsed = ms(args.join(" "));
        if (args.join(" ").endsWith("%")) {
            const percentage = Number(args.join(" ").slice(0, -1));
            if (isNaN(percentage) || percentage > 100 || percentage < 0) return await message.channel.send("The given percentage is not valid!");
            parsed = serverQueue.songs[0].time * (percentage / 100);
        } else parsed = Math.floor(parsed / 1000);
        await this.seek(message, serverQueue, parsed);
    }

    async seek(message: Message | CommandInteraction, serverQueue: ServerQueue, seek: number) {
        if (serverQueue.songs.length < 1 || !serverQueue?.player || !serverQueue.playing) return await msgOrRes(message, "There is nothing in the queue.");
        if (((<GuildMember> message.member).voice.channelId !== message.guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to change the time of the soundtrack begins when the bot is playing!");
        if (serverQueue.songs[0].time === 0) return await msgOrRes(message, "This command does not work for live videos.");
        if (!seek) return await msgOrRes(message, "The given time is not valid!");
        if (seek > serverQueue.songs[0].time) return await msgOrRes(message, "The time specified should not be larger than the maximum length of the soundtrack!");
        serverQueue.isSkipping = true;
        serverQueue.seek = seek;
        serverQueue.player?.stop();
        await msgOrRes(message, `Seeked to **${seek == 0 ? "0:00" : duration(seek, "seconds")}**`);
        const member = <GuildMember> message.member;
        if (member.voice.channel && serverQueue.playing && !serverQueue.connection) serverQueue.connection = joinVoiceChannel({ channelId: member.voice.channel.id, guildId: message.guild.id, adapterCreator: createDiscordJSAdapter(<VoiceChannel> member.voice.channel) });
    }
}

const cmd = new SeekCommand();
export default cmd;