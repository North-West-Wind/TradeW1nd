import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, GuildMember, TextChannel, VoiceChannel } from "discord.js";

import { NorthClient, SlashCommand } from "../../classes/NorthClient.js";
import { moveArray } from "../../function.js";
import { createDiscordJSAdapter, getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { play } from "./play.js";

export async function migrate(interaction: ChatInputCommandInteraction) {
    let serverQueue = getQueue(interaction.guild.id);
    const member = <GuildMember> interaction.member;
    const exit = NorthClient.storage.guilds[interaction.guild.id].exit;
    const migrating = NorthClient.storage.migrating;
    if (migrating.find(x => x === interaction.guild.id)) return await interaction.reply("I'm on my way!").then(() => setTimeout(() => interaction.deleteReply().catch(() => {}), 10000));
    if (!member.voice.channel) return await interaction.reply("You are not in any voice channel!");
    if (!interaction.guild.members.me.voice.channel) return await interaction.reply("I am not in any voice channel!");
    if (member.voice.channelId === interaction.guild.members.me.voice.channelId) return await interaction.reply("I'm already in the same channel with you!");
    if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
    if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue.");
    if (!serverQueue.playing) return await interaction.reply("I'm not playing anything.");
    if (!member.voice.channel.permissionsFor(interaction.guild.members.me).has(BigInt(3145728))) return await interaction.reply("I don't have the required permissions to play music here!");
    migrating.push(interaction.guild.id);
    if (exit) NorthClient.storage.guilds[interaction.guild.id].exit = false;
    const oldChannel = serverQueue.voiceChannel;
    let seek = 0;
    if (serverQueue.connection) {
        seek = Math.floor((serverQueue.getPlaybackDuration() - serverQueue.startTime) / 1000);
        serverQueue.destroy();
    }
    serverQueue.playing = false;
    serverQueue.connection = null;
    serverQueue.voiceChannel = null;
    serverQueue.textChannel = null;
    const voiceChannel = <VoiceChannel> (<GuildMember> interaction.member).voice.channel;
    await interaction.reply("Migrating in 3 seconds...");
    setTimeout(() => {
        if (!interaction.guild.members.me.voice.channel || interaction.guild.members.me.voice.channelId !== voiceChannel.id) serverQueue.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guild.id, adapterCreator: createDiscordJSAdapter(voiceChannel) });
        else serverQueue.connection = getVoiceConnection(interaction.guild.id);
        serverQueue.voiceChannel = voiceChannel;
        serverQueue.playing = true;
        serverQueue.textChannel = <TextChannel>interaction.channel;
        serverQueue.seek = seek;
        serverQueue.callers.add(interaction.member.user.id);
        migrating.splice(migrating.indexOf(interaction.guild.id));
        interaction.editReply(`Moved from **${oldChannel.name}** to **${voiceChannel.name}**`).catch(() => { });
        updateQueue(interaction.guild.id, serverQueue, false);
        if (!serverQueue.random) play(interaction.guild, serverQueue.songs[0]);
        else {
            const int = Math.floor(Math.random() * serverQueue.songs.length);
            const pending = serverQueue.songs[int];
            serverQueue.songs = moveArray(serverQueue.songs, int);
            updateQueue(interaction.guild.id, serverQueue);
            play(interaction.guild, pending);
        }
    }, 3000);
}

class MigrateCommand implements SlashCommand {
    name = "migrate"
    description = "Moves the bot to the channel you are in. Use when changing voice channel."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        await migrate(interaction);
    }
}

const cmd = new MigrateCommand();
export default cmd;