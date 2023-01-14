import { joinVoiceChannel } from "@discordjs/voice";
import { ApplicationCommandOptionType, ChatInputCommandInteraction, GuildMember, VoiceChannel } from "discord.js";

import { SlashCommand } from "../../classes/index.js";
import { createDiscordJSAdapter, getQueue, setQueue } from "../../helpers/music.js";

class SkipCommand implements SlashCommand {
    name = "skip"
    description = "Skips soundtrack(s) in the queue."
    category = 0
    options = [{
        name: "amount",
        description: "The amount of soundtrack to skip.",
        required: false,
        type: ApplicationCommandOptionType.Integer
    }]

    async execute(interaction: ChatInputCommandInteraction) {
        const skipped = interaction.options.getInteger("amount") || 1;
        await this.skip(interaction, skipped);
    }

    async skip(interaction: ChatInputCommandInteraction, skip: number) {
        let serverQueue = getQueue(interaction.guild.id);
        const guild = interaction.guild;
        const member = (<GuildMember> interaction.member);
        if (!serverQueue || !Array.isArray(serverQueue?.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if ((member.voice.channelId !== guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to skip the music when the bot is playing!");
        if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue!");
        if (serverQueue.repeating) skip = 0;
        for (let i = 0; i < skip; i++) {
            if (serverQueue.looping) serverQueue.songs.push(serverQueue.songs.shift());
            else serverQueue.songs.shift();
        }
        serverQueue.isSkipping = true;
        serverQueue.player?.stop();
        await interaction.reply(`Skipped **${Math.max(1, skip)}** track${skip > 1 ? "s" : ""}!`);
        if (member.voice.channel && serverQueue.playing && !serverQueue.connection) serverQueue.connection = joinVoiceChannel({ channelId: member.voice.channel.id, guildId: interaction.guild.id, adapterCreator: createDiscordJSAdapter(<VoiceChannel> member.voice.channel) });
    }
}

const cmd = new SkipCommand();
export default cmd;