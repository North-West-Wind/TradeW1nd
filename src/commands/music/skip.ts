import { joinVoiceChannel } from "@discordjs/voice";
import { CommandInteraction, GuildMember, Message, VoiceChannel } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient";
import { moveArray, msgOrRes } from "../../function";
import { createDiscordJSAdapter, getQueues, setQueue, updateQueue } from "../../helpers/music";
import { play } from "./play";

class SkipCommand implements SlashCommand {
    name = "skip"
    description = "Skips soundtrack(s) in the queue."
    usage = "[amount]"
    aliases = ["s"]
    category = 0
    options = [{
        name: "amount",
        description: "The amount of soundtrack to skip.",
        required: false,
        type: "INTEGER"
    }]

    async execute(interaction: CommandInteraction) {
        const skipped = interaction.options.getInteger("amount") || 1;
        await this.skip(interaction, skipped);
    }

    async run(message: Message, args: string[]) {
        var skipped = 1;
        if (args[0]) {
            const parsed = parseInt(args[0]);
            if (isNaN(parsed)) await message.channel.send(`**${args[0]}** is not a integer. Will skip 1 track instead.`);
            else if (parsed < 1) await message.channel.send(`**${args[0]}** is smaller than 1. Will skip 1 track instead.`);
            else skipped = parsed;
        }
        await this.skip(message, skipped);
    }

    async skip(message: Message | CommandInteraction, skip: number) {
        var serverQueue = getQueues().get(message.guild.id);
        const guild = message.guild;
        const member = (<GuildMember> message.member);
        if (!serverQueue || !Array.isArray(serverQueue?.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if ((member.voice.channelId !== guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to skip the music when the bot is playing!");
        if (serverQueue.songs.length < 1) return await msgOrRes(message, "There is nothing in the queue!");
        if (serverQueue.repeating) skip = 0;
        for (var i = 0; i < skip; i++) {
            if (serverQueue.looping) serverQueue.songs.push(serverQueue.songs.shift());
            else serverQueue.songs.shift();
        }
        serverQueue.isSkipping = true;
        serverQueue.player?.stop();
        await msgOrRes(message, `Skipped **${Math.max(1, skip)}** track${skip > 1 ? "s" : ""}!`);
        if (member.voice.channel && serverQueue.playing && !serverQueue.connection) serverQueue.connection = joinVoiceChannel({ channelId: member.voice.channel.id, guildId: message.guild.id, adapterCreator: createDiscordJSAdapter(<VoiceChannel> member.voice.channel) });
    }
}

const cmd = new SkipCommand();
export default cmd;