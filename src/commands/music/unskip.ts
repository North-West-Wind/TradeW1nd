import { joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, GuildMember, VoiceChannel } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { createDiscordJSAdapter, getQueue, setQueue } from "../../helpers/music.js";

class UnSkipCommand implements SlashCommand {
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

    async unskip(interaction: ChatInputCommandInteraction, unskip: number) {
        let serverQueue = getQueue(interaction.guild.id);
        const guild = interaction.guild;
        const member = (<GuildMember> interaction.member);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if ((member.voice.channelId !== guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to unskip the music when the bot is playing!");
        if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue!");
        if (serverQueue.repeating) unskip = 0;
        for (let i = 0; i < unskip; i++) {
            const song = serverQueue.songs.pop();
            serverQueue.songs.unshift(song);
        }
        serverQueue.isSkipping = true;
        serverQueue.player?.stop();
        await interaction.reply(`Unskipped **${Math.max(1, unskip)}** track${unskip > 1 ? "s" : ""}!`);
        if (member.voice.channel && serverQueue.playing && !serverQueue.connection) serverQueue.connection = joinVoiceChannel({ channelId: member.voice.channel.id, guildId: interaction.guild.id, adapterCreator: createDiscordJSAdapter(<VoiceChannel> member.voice.channel) });
    }
}

const cmd = new UnSkipCommand();
export default cmd;