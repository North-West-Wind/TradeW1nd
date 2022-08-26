import { joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, GuildMember, Message, VoiceChannel } from "discord.js";

import { FullCommand } from "../../classes/NorthClient.js";
import { msgOrRes } from "../../function.js";
import { createDiscordJSAdapter, getQueue, setQueue } from "../../helpers/music.js";

class UnSkipCommand implements FullCommand {
    name = "unskip"
    description = "Goes to the previous soundtrack in the queue."
    usage = "[amount]"
    aliases = ["us"]
    category = 0
    options = [{
        name: "amount",
        description: "The amount of soundtrack to go back.",
        required: false,
        type: "INTEGER"
    }]

    async execute(interaction: ChatInputCommandInteraction) {
        const skipped = interaction.options.getInteger("amount") || 1;
        await this.unskip(interaction, skipped);
    }

    async run(message: Message, args: string[]) {
        let skipped = 1;
        if (args[0]) {
            const parsed = parseInt(args[0]);
            if (isNaN(parsed)) await message.channel.send(`**${args[0]}** is not a integer. Will skip 1 track instead.`);
            else if (parsed < 1) await message.channel.send(`**${args[0]}** is smaller than 1. Will skip 1 track instead.`);
            else skipped = parsed;
        }
        await this.unskip(message, skipped);
    }

    async unskip(message: Message | ChatInputCommandInteraction, unskip: number) {
        let serverQueue = getQueue(message.guild.id);
        const guild = message.guild;
        const member = (<GuildMember> message.member);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if ((member.voice.channelId !== guild.members.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message,"You have to be in a voice channel to unskip the music when the bot is playing!");
        if (serverQueue.songs.length < 1) return await msgOrRes(message,"There is nothing in the queue!");
        if (serverQueue.repeating) unskip = 0;
        for (let i = 0; i < unskip; i++) {
            const song = serverQueue.songs.pop();
            serverQueue.songs.unshift(song);
        }
        serverQueue.isSkipping = true;
        serverQueue.player?.stop();
        await msgOrRes(message,`Unskipped **${Math.max(1, unskip)}** track${unskip > 1 ? "s" : ""}!`);
        if (member.voice.channel && serverQueue.playing && !serverQueue.connection) serverQueue.connection = joinVoiceChannel({ channelId: member.voice.channel.id, guildId: message.guild.id, adapterCreator: createDiscordJSAdapter(<VoiceChannel> member.voice.channel) });
    }
}

const cmd = new UnSkipCommand();
export default cmd;