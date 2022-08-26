import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, GuildMember, Message, TextChannel, VoiceChannel } from "discord.js";

import { NorthClient, FullCommand } from "../../classes/NorthClient.js";
import { moveArray, msgOrRes } from "../../function.js";
import { createDiscordJSAdapter, getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { play } from "./play.js";

export async function migrate(message: Message | ChatInputCommandInteraction) {
    var serverQueue = getQueue(message.guild.id);
    const member = <GuildMember> message.member;
    const exit = NorthClient.storage.guilds[message.guild.id].exit;
    const migrating = NorthClient.storage.migrating;
    if (migrating.find(x => x === message.guild.id)) return await  msgOrRes(message, "I'm on my way!").then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
    if (!member.voice.channel) return await msgOrRes(message, "You are not in any voice channel!");
    if (!message.guild.members.me.voice.channel) return await msgOrRes(message, "I am not in any voice channel!");
    if (member.voice.channelId === message.guild.members.me.voice.channelId) return await msgOrRes(message, "I'm already in the same channel with you!");
    if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
    if (serverQueue.songs.length < 1) return await msgOrRes(message, "There is nothing in the queue.");
    if (!serverQueue.playing) return await msgOrRes(message, "I'm not playing anything.");
    if (!member.voice.channel.permissionsFor(message.guild.members.me).has(BigInt(3145728))) return await msgOrRes(message, "I don't have the required permissions to play music here!");
    migrating.push(message.guild.id);
    if (exit) NorthClient.storage.guilds[message.guild.id].exit = false;
    const oldChannel = serverQueue.voiceChannel;
    var seek = 0;
    if (serverQueue.connection) {
        seek = Math.floor((serverQueue.getPlaybackDuration() - serverQueue.startTime) / 1000);
        serverQueue.destroy();
    }
    serverQueue.playing = false;
    serverQueue.connection = null;
    serverQueue.voiceChannel = null;
    serverQueue.textChannel = null;
    const voiceChannel = <VoiceChannel> (<GuildMember> message.member).voice.channel;
    const msg = <Message>await msgOrRes(message, "Migrating in 3 seconds...");
    setTimeout(() => {
        if (!message.guild.members.me.voice.channel || message.guild.members.me.voice.channelId !== voiceChannel.id) serverQueue.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: message.guild.id, adapterCreator: createDiscordJSAdapter(voiceChannel) });
        else serverQueue.connection = getVoiceConnection(message.guild.id);
        serverQueue.voiceChannel = voiceChannel;
        serverQueue.playing = true;
        serverQueue.textChannel = <TextChannel>message.channel;
        serverQueue.seek = seek;
        serverQueue.callers.add(message.member.user.id);
        migrating.splice(migrating.indexOf(message.guild.id));
        msg.edit(`Moved from **${oldChannel.name}** to **${voiceChannel.name}**`).catch(() => { });
        updateQueue(message.guild.id, serverQueue, false);
        if (!serverQueue.random) play(message.guild, serverQueue.songs[0]);
        else {
            const int = Math.floor(Math.random() * serverQueue.songs.length);
            const pending = serverQueue.songs[int];
            serverQueue.songs = moveArray(serverQueue.songs, int);
            updateQueue(message.guild.id, serverQueue);
            play(message.guild, pending);
        }
    }, 3000);
}

class MigrateCommand implements FullCommand {
    name = "migrate"
    description = "Moves the bot to the channel you are in. Use when changing voice channel."
    category = 0

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        await migrate(interaction);
    }

    async run(message: Message) {
        await migrate(message);
    }
}

const cmd = new MigrateCommand();
export default cmd;