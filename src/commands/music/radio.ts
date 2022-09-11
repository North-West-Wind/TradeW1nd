import { AudioPlayerStatus, getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, GuildMember, Message, EmbedBuilder, VoiceChannel, Attachment } from "discord.js";
import { SlashCommand } from "../../classes/NorthClient.js";
import { color, duration, validGDDLURL, validGDFolderURL, validGDURL, validMSSetURL, validMSURL, validSCURL, validSPURL, validURL, validYTPlaylistURL, validYTURL, wait } from "../../function.js";
import { addYTPlaylist, addYTURL, addSPURL, addSCURL, addGDFolderURL, addGDURL, addMSURL, addURL, addAttachment, search, addMSSetURL } from "../../helpers/addTrack.js";
import { createDiscordJSAdapter, getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { addPlaying, isPlaying, players, removePlaying } from "../../helpers/radio.js";
import { createEmbed } from "./play.js";
const type = [
    "YouTube",
    "Spotify",
    "URL/Attachment",
    "SoundCloud",
    "Google Drive",
    "Musescore",
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
                },
                {
                    name: "attachment",
                    description: "An attachment of the audio file.",
                    required: false,
                    type: "ATTACHMENT"
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

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "tune") return await this.tune(interaction, interaction.options.getInteger("channel"));
        else if (sub === "off") return await this.off(interaction);
        else if (sub === "add") {
            await interaction.deferReply();
            return await this.add(interaction, interaction.options.getString("track"), interaction.options.getAttachment("attachment"), interaction.options.getInteger("channel"));
        } else if (sub === "info") return await this.info(interaction, interaction.options.getInteger("channel"));
        else if (sub === "copy") return await this.copy(interaction, interaction.options.getInteger("channel"));
    }

    async tune(interaction: ChatInputCommandInteraction, channel: number) {
        let connection = getVoiceConnection(interaction.guildId);
        if (!connection) {
            const member = <GuildMember>interaction.member;
            if (!member.voice.channelId) return await interaction.reply("You are not in any voice channel!");
            connection = joinVoiceChannel({ channelId: member.voice.channelId, guildId: interaction.guildId, adapterCreator: createDiscordJSAdapter(<VoiceChannel>member.voice.channel) });
        }
        const radioCh = players[channel - 1];
        if (!radioCh) return await interaction.reply("That channel is not available!");
        connection.subscribe(radioCh.player);
        addPlaying(channel, interaction.guildId);
        await interaction.reply("Connected!");
    }

    async off(interaction: ChatInputCommandInteraction) {
        if (!isPlaying(interaction.guildId)) return await interaction.reply("Radio isn't connected to this server!");
        const connection = getVoiceConnection(interaction.guildId);
        if (connection) connection.destroy();
        removePlaying(interaction.guildId);
        await interaction.reply("Disconnected!");
    }

    async add(interaction: ChatInputCommandInteraction, str: string, att: Attachment, channel: number) {
        try {
            let result = { error: true, message: "No link/keywords/attachments!", songs: [], msg: null };
            if (att) result = await addAttachment(att);
            else if (validYTPlaylistURL(str)) result = await addYTPlaylist(str);
            else if (validYTURL(str)) result = await addYTURL(str);
            else if (validSPURL(str)) result = await addSPURL(interaction, str);
            else if (validSCURL(str)) result = await addSCURL(str);
            else if (validGDFolderURL(str)) {
                const msg = await interaction.editReply("Processing track: (Initializing)");
                result = await addGDFolderURL(str, async (i, l) => await msg.edit(`Processing track: **${i}/${l}**`));
                result.msg = msg;
            } else if (validGDURL(str) || validGDDLURL(str)) result = await addGDURL(str);
            else if (validMSSetURL(str)) result = await addMSSetURL(str);
            else if (validMSURL(str)) result = await addMSURL(str);
            else if (validURL(str)) result = await addURL(str);
            else result = await search(interaction, str);
            if (result.error) return await interaction.editReply(result.message || "Failed to add soundtrack");
            const songs = result.songs;
            if (!songs || songs.length < 1) return await interaction.editReply("There was an error trying to add the soundtrack!");
            const Embed = createEmbed(songs);
            await players[channel - 1].add(songs);
            let msg: Message;
            if (result.msg) msg = await result.msg.edit({ content: null, embeds: [Embed] });
            else msg = await interaction.editReply({ embeds: [Embed] });
            await wait(30000);
            await msg.edit({ embeds: [], content: `**[Added Track: ${songs.length > 1 ? songs.length + " in total" : songs[0].title}]**` });
        } catch (err) {
            await interaction.editReply("There was an error trying to add the soundtrack to the queue!");
            console.error(err);
        }
    }

    async info(interaction: ChatInputCommandInteraction, channel: number) {
        const radio = players[channel - 1];
        if (!radio.tracks.length) return await interaction.reply("There are currently no tracks in this radio channel.");
        const position = radio.player.state.status == AudioPlayerStatus.Playing ? radio.player.state.playbackDuration : 0;
        const processBar = [];
        for (let i = 0; i < 20; i++) processBar.push("═");
        let progress = 0;
        const isLive = !!radio.tracks[0]?.isLive;
        const length = isLive ? 0 : (radio.tracks[0].time || 1);
        let positionTime: string;
        if (isLive) {
            processBar.splice(19, 1, "■");
            positionTime = "∞";
        } else {
            positionTime = duration(Math.round(position / 1000), "seconds");
            if (position === 0 || isNaN(position))
                positionTime = "0:00";
            progress = Math.floor((position / length) * processBar.length);
            processBar.splice(progress, 1, "■");
        }
        let next: string;
        if (radio.tracks[1]) next = `${radio.tracks[1].title} : ${duration(radio.tracks[1].time, "seconds")}`;
        else if ((radio.tracks[0].looped || 0) < 3) next = `${radio.tracks[0].title} : ${duration(radio.tracks[0].time, "seconds")}`;
        else next = "Empty";
        let info = [];
        const embed = new EmbedBuilder()
            .setColor(color())
            .setTitle("Information of Radio Channel #" + channel)
            .setTimestamp()
            .setFooter({ text: `Coming up next: ${next}`, iconURL: interaction.client.user.displayAvatarURL() });

        const songLength = !radio.tracks[0].time ? "∞" : duration(radio.tracks[0].time, "seconds");
        if (radio.tracks[0].type === 1) info = [`**[${radio.tracks[0].title}](${radio.tracks[0].spot})**\nLength: **${songLength}**`, radio.tracks[0].thumbnail];
        else info = [`**[${radio.tracks[0].title}](${radio.tracks[0].url})**\nLive: **${isLive ? "Yes" : "No"}**\nType: **${type[radio.tracks[0].type]}**`, radio.tracks[0].thumbnail];
        embed.setDescription(`${info[0]}\n\n${positionTime} \`${processBar.join("")}\` ${songLength || "Unknown"}`).setThumbnail(info[1]);
        await interaction.reply({ embeds: [embed] });
        setTimeout(() => interaction.editReply({ content: "**[Outdated Radio Information]**", embeds: [] }).catch(() => {}), 60000);
    }

    async copy(interaction: ChatInputCommandInteraction, channel: number) {
        let serverQueue = getQueue(interaction.guildId);
        if (serverQueue?.playing) return await interaction.editReply("Someone is listening to the music. Don't ruin their day.");
        const radio = players[channel - 1];
        if (radio.tracks.length == 0) return await interaction.editReply("The queue of this radio channel is empty!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guildId, radio.tracks, false, false);
        else serverQueue.songs = radio.tracks;
        updateQueue(interaction.guildId, serverQueue);
        return await interaction.editReply(`Copied the queue from radio channel #${channel}.`);
    }
}

const cmd = new RadioCommand();
export default cmd;