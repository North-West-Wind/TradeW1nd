import { CommandInteraction, GuildMember, Message } from "discord.js";

import { ServerQueue, SlashCommand } from "../../classes/NorthClient";
import { ms, msgOrRes } from "../../function";
import * as moment from "moment";
import formatSetup from "moment-duration-format";
import { getQueues, setQueue } from "../../helpers/music";
formatSetup(moment);
import { play } from "./play";

class SeekCommand implements SlashCommand {
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
        var serverQueue = getQueues().get(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        var parsed = ms(interaction.options.getString("time")) || interaction.options.getString("time");
        if (typeof parsed === "string" && parsed.endsWith("%")) {
            const percentage = Number(parsed.slice(0, -1));
            if (isNaN(percentage) || percentage > 100 || percentage < 0) return await interaction.reply("The given percentage is not valid!");
            parsed = moment.duration(serverQueue.songs[0].time).asSeconds() * (percentage / 100);
        }
        await this.seek(interaction, serverQueue, parsed);
    }

    async run(message: Message, args: string[]) {
        var serverQueue = getQueues().get(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (args.length < 1) return await message.channel.send("You didn't provide the time to skip to!");
        var parsed = ms(args.join(" "));
        if (args.join(" ").endsWith("%")) {
            const percentage = Number(args.join(" ").slice(0, -1));
            if (isNaN(percentage) || percentage > 100 || percentage < 0) return await message.channel.send("The given percentage is not valid!");
            parsed = moment.duration(serverQueue.songs[0].time).asSeconds() * (percentage / 100);
        }
        await this.seek(message, serverQueue, parsed);
    }

    async seek(message: Message | CommandInteraction, serverQueue: ServerQueue, seek: number) {
        if (serverQueue.songs.length < 1 || !serverQueue?.player || !serverQueue.playing) return await msgOrRes(message, "There is nothing in the queue.");
        if (((<GuildMember> message.member).voice.channelId !== message.guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to change the time of the soundtrack begins when the bot is playing!");
        if (serverQueue.songs[0].time === "∞") return await msgOrRes(message, "This command does not work for live videos.");
        if (!seek) return await msgOrRes(message, "The given time is not valid!");
        if (seek > moment.duration(serverQueue.songs[0].time).asSeconds()) return await msgOrRes(message, "The time specified should not be larger than the maximum length of the soudtrack!");
        serverQueue.stop();
        await msgOrRes(message, `Seeked to **${seek == 0 ? "0:00" : moment.duration(seek, "seconds").format()}**`);
        await play(message.guild, serverQueue.songs[0], seek);
    }
}

const cmd = new SeekCommand();
export default cmd;