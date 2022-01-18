import { AudioPlayerStatus, getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { CommandInteraction, GuildMember, Message, MessageEmbed, VoiceChannel } from "discord.js";
import * as moment from "moment";
import { SlashCommand } from "../../classes/NorthClient";
import { color, msgOrRes, validGDDLURL, validGDFolderURL, validGDURL, validMSURL, validSCURL, validSPURL, validURL, validYTPlaylistURL, validYTURL, wait } from "../../function";
import { addYTPlaylist, addYTURL, addSPURL, addSCURL, addGDFolderURL, addGDURL, addMSURL, addURL, addAttachment, search } from "../../helpers/addTrack";
import { createDiscordJSAdapter, getQueue, setQueue, updateQueue } from "../../helpers/music";
import { addPlaying, isPlaying, players, removePlaying } from "../../helpers/radio";
import { createEmbed } from "./play";
import { globalClient as client } from "../../common";
const type = [
    "YouTube",
    "Spotify",
    "URL/Attachment",
    "SoundCloud",
    "Google Drive",
    "Musescore",
    "PornHub",
    "MSCZ/MSCX"
];

class RadioCommand implements SlashCommand {
    name = "radio";
    description = "Plays music in a channel 24/7!";
    usage = "<subcommand>";
    args = 1;
    subcommands = ["tune", "off", "add", "info", "copy"];
    subdesc = ["Connects to one of the radio channels.", "Disconnects from a radio channel and the voice channel.", "Adds a soundtrack to the radio channel queue.", "Retrieves information of a radio channel.", "Copies the radio queue to the current server."]
    subusage = ["<subcommand> <channel>", null, "<subcommand> <track>", 0, 0];
    options = [
        {
            name: "tune",
            description: "Connects to one of the radio channels.",
            type: "SUB_COMMAND",
            options: [{
                name: "channel",
                description: "The radio channel to connect to.",
                required: true,
                type: "INTEGER",
                choices: [{name:"1",value:1},{name:"2",value:2},{name:"3",value:3},{name:"4",value:4},{name:"5",value:5},{name:"6",value:6},{name:"7",value:7},{name:"8",value:8},{name:"9",value:9},{name:"10",value:10}]
            }]
        },
        {
            name: "off",
            description: "Disconnects from a radio channel and the voice channel.",
            type: "SUB_COMMAND",
        },
        {
            name: "add",
            description: "Adds a soundtrack to the radio channel queue.",
            type: "SUB_COMMAND",
            options: [
                {
                    name: "channel",
                    description: "The radio channel to add the soundtrack to.",
                    required: true,
                    type: "INTEGER",
                    choices: [{name:"1",value:1},{name:"2",value:2},{name:"3",value:3},{name:"4",value:4},{name:"5",value:5},{name:"6",value:6},{name:"7",value:7},{name:"8",value:8},{name:"9",value:9},{name:"10",value:10}]
                },
                {
                    name: "track",
                    description: "The soundtrack to add.",
                    required: true,
                    type: "STRING"
                }
            ]
        },
        {
            name: "info",
            description: "Retrieves information of a radio channel.",
            type: "SUB_COMMAND",
            options: [{
                name: "channel",
                description: "The radio channel to get the information of.",
                required: true,
                type: "INTEGER",
                choices: [{name:"1",value:1},{name:"2",value:2},{name:"3",value:3},{name:"4",value:4},{name:"5",value:5},{name:"6",value:6},{name:"7",value:7},{name:"8",value:8},{name:"9",value:9},{name:"10",value:10}]
            }]
        },
        {
            name: "copy",
            description: "Copies the radio queue to the current server.",
            type: "SUB_COMMAND",
            options: [{
                name: "channel",
                description: "The radio channel to copy.",
                required: true,
                type: "INTEGER",
                choices: [{name:"1",value:1},{name:"2",value:2},{name:"3",value:3},{name:"4",value:4},{name:"5",value:5},{name:"6",value:6},{name:"7",value:7},{name:"8",value:8},{name:"9",value:9},{name:"10",value:10}]
            }]
        }
    ];

    checkChannel(channel: number) {
        return channel >= 1 && channel <= 10 && !(channel % 1);
    }

    async execute(interaction: CommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "tune") return await this.tune(interaction, interaction.options.getInteger("channel"));
        else if (sub === "off") return await this.off(interaction);
        else if (sub === "add") {
            await interaction.deferReply();
            return await this.add(interaction, interaction.options.getString("track"), interaction.options.getInteger("channel"));
        } else if (sub === "info") return await this.info(interaction, interaction.options.getInteger("channel"));
    }

    async run(message: Message, args: string[]) {
        if (!this.subcommands.includes(args[0])) return await message.channel.send("There is no such subcommand!");
        if (args[0] === "tune") {
            const channel = parseInt(args[1]);
            if (isNaN(channel)) return await message.channel.send("The channel number is not valid!");
            if (!this.checkChannel(channel)) return await message.channel.send("The channel number should be an interger between 1 and 10!");
            return await this.tune(message, channel);
        } else if (args[0] === "off") return await this.off(message);
        else if (args[0] === "add") {
            if (!args[1]) return await message.channel.send("Please provide a channel number!");
            if (!args[2]) return await message.channel.send("No link/keywords/attachments!");
            const channel = parseInt(args[1]);
            if (isNaN(channel)) return await message.channel.send("The channel number is not valid!");
            if (!this.checkChannel(channel)) return await message.channel.send("The channel number should be an interger between 1 and 10!");
            return await this.add(message, args.slice(2).join(" "), channel);
        } else if (args[0] === "info") {
            const channel = parseInt(args[1]);
            if (isNaN(channel)) return await message.channel.send("The channel number is not valid!");
            if (!this.checkChannel(channel)) return await message.channel.send("The channel number should be an interger between 1 and 10!");
            return await this.info(message, channel);
        }
    }

    async tune(message: Message | CommandInteraction, channel: number) {
        var connection = getVoiceConnection(message.guildId);
        if (!connection) {
            const member = <GuildMember>message.member;
            if (!member.voice.channelId) return await msgOrRes(message, "You are not in any voice channel!");
            connection = joinVoiceChannel({ channelId: member.voice.channelId, guildId: message.guildId, adapterCreator: createDiscordJSAdapter(<VoiceChannel>member.voice.channel) });
        }
        const radioCh = players[channel - 1];
        if (!radioCh) return await msgOrRes(message, "That channel is not available!");
        connection.subscribe(radioCh.player);
        addPlaying(channel, message.guildId);
        await msgOrRes(message, "Connected!");
    }

    async off(message: Message | CommandInteraction) {
        if (!isPlaying(message.guildId)) return await msgOrRes(message, "Radio isn't connected to this server!");
        const connection = getVoiceConnection(message.guildId);
        if (connection) connection.destroy();
        removePlaying(message.guildId);
        await msgOrRes(message, "Disconnected!");
    }

    async add(message: Message | CommandInteraction, str: string, channel: number) {
        try {
            var songs = [];
            var result = { error: true, message: "No link/keywords/attachments!", songs: [], msg: null };
            if (validYTPlaylistURL(str)) result = await addYTPlaylist(str);
            else if (validYTURL(str)) result = await addYTURL(str);
            else if (validSPURL(str)) result = await addSPURL(message, str);
            else if (validSCURL(str)) result = await addSCURL(str);
            else if (validGDFolderURL(str)) {
                const msg = message instanceof Message ? await message.channel.send("Processing track: (Initializing)") : <Message>await message.reply({ content: "Processing track: (Initializing)", fetchReply: true });
                result = await addGDFolderURL(str, async (i, l) => await msg.edit(`Processing track: **${i}/${l}**`));
                result.msg = msg;
            } else if (validGDURL(str) || validGDDLURL(str)) result = await addGDURL(str);
            else if (validMSURL(str)) result = await addMSURL(str);
            else if (validURL(str)) result = await addURL(str);
            else if (message instanceof Message && message.attachments.size > 0) result = await addAttachment(message);
            else result = await search(message, str);
            if (result.error) return await msgOrRes(message, result.message || "Failed to add soundtrack");
            songs = result.songs;
            if (!songs || songs.length < 1) return await msgOrRes(message, "There was an error trying to add the soundtrack!");
            const Embed = createEmbed(songs);
            await players[channel - 1].add(songs);
            var msg: Message;
            if (result.msg) msg = await result.msg.edit({ content: null, embeds: [Embed] });
            else msg = await msgOrRes(message, Embed);
            await wait(30000);
            await msg.edit({ embeds: [], content: `**[Added Track: ${songs.length > 1 ? songs.length + " in total" : songs[0].title}]**` });
        } catch (err) {
            await msgOrRes(message, "There was an error trying to add the soundtrack to the queue!");
            console.error(err);
        }
    }

    async info(message: Message | CommandInteraction, channel: number) {
        const radio = players[channel - 1];
        var position = 0;
        const streamTime = radio.player.state.status == AudioPlayerStatus.Playing ? radio.player.state.playbackDuration : 0;
        if (streamTime && radio.startTime) position = (streamTime - radio.startTime);
        var processBar = [];
        for (let i = 0; i < 20; i++) processBar.push("═");
        var progress = 0;
        const isLive = !!radio.tracks[0]?.isLive;
        const length = isLive ? 0 : (radio.tracks[0].time || 1);
        if (isLive) {
            processBar.splice(19, 1, "■");
            var positionTime = "∞";
        } else {
            var positionTime = moment.duration(Math.round(position / 1000), "seconds").format();
            if (position === 0 || isNaN(position))
                positionTime = "0:00";
            progress = Math.floor((position / length) * processBar.length);
            processBar.splice(progress, 1, "■");
        }
        var next: string;
        if (radio.tracks[1]) next = `${radio.tracks[1].title} : ${moment.duration(radio.tracks[1].time, "seconds").format()}`;
        else if ((radio.tracks[0].looped || 0) < 3) next = `${radio.tracks[0].title} : ${moment.duration(radio.tracks[0].time, "seconds").format()}`;
        else next = "Empty";
        var info = [];
        var embed = new MessageEmbed()
            .setColor(color())
            .setTitle("Information of Radio Channel #" + channel)
            .setTimestamp()
            .setFooter({ text: `Coming up next: ${next}`, iconURL: message.client.user.displayAvatarURL() });

        const songLength = !radio.tracks[0].time ? "∞" : moment.duration(radio.tracks[0].time, "seconds").format();
        if (radio.tracks[0].type === 1) info = [`**[${radio.tracks[0].title}](${radio.tracks[0].spot})**\nLength: **${songLength}**`, radio.tracks[0].thumbnail];
        else info = [`**[${radio.tracks[0].title}](${radio.tracks[0].url})**\nLive: **${isLive ? "Yes" : "No"}**\nType: **${type[radio.tracks[0].type]}**`, radio.tracks[0].thumbnail];
        embed.setDescription(`${info[0]}\n\n${positionTime} \`${processBar.join("")}\` ${songLength || "Unknown"}`).setThumbnail(info[1]);
        const msg = await msgOrRes(message, embed);
        setTimeout(() => msg.edit({ content: "**[Outdated Radio Information]**", embeds: [] }).catch(() => {}), 60000);
    }

    async copy(message: Message | CommandInteraction, channel: number) {
        var serverQueue = getQueue(message.guildId);
        const pool = client.pool;
        const author = message instanceof Message ? message.author : message.user;
        if (serverQueue?.playing) return await msgOrRes(message, "Someone is listening to the music. Don't ruin their day.");
        const radio = players[channel - 1];
        if (radio.tracks.length == 0) return await msgOrRes(message, "The queue of this radio channel is empty!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guildId, radio.tracks, false, false);
        else serverQueue.songs = radio.tracks;
        updateQueue(message.guildId, serverQueue);
        return await msgOrRes(message, `Copied the queue from radio channel #${channel}.`);
    }
}

const cmd = new RadioCommand();
export default cmd;