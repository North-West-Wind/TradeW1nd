import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { CommandInteraction, GuildMember, Message, VoiceChannel } from "discord.js";
import { SlashCommand } from "../../classes/NorthClient";
import { msgOrRes, validGDDLURL, validGDFolderURL, validGDURL, validMSURL, validSCURL, validSPURL, validURL, validYTPlaylistURL, validYTURL } from "../../function";
import { addYTPlaylist, addYTURL, addSPURL, addSCURL, addGDFolderURL, addGDURL, addMSURL, addURL, addAttachment, search } from "../../helpers/addTrack";
import { createDiscordJSAdapter } from "../../helpers/music";
import { players } from "../../helpers/radio";

class RadioCommand implements SlashCommand {
    name = "radio";
    description = "Play music in a channel 24/7!";
    usage = "<subcommand>";
    args = 1;
    subcommands = ["tune", "off", "add"];
    subdesc = ["Connects to one of the radio channels.", "Disconnects from a radio channel and the voice channel.", "Adds a soundtrack to the radio channel queue."]
    subusage = ["<subcommand> <channel>", null, "<subcommand> <track>"];
    options = [
        {
            name: "tune",
            description: "Connects to one of the radio channels.",
            type: "SUB_COMMAND",
            options: [{
                name: "channel",
                description: "The radio channel to connect to.",
                required: true,
                type: "INTEGER"
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
            options: [{
                name: "track",
                description: "The soundtrack to add.",
                required: true,
                type: "STRING"
            }]
        }
    ];

    async execute(interaction: CommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "tune") {
            const channel = interaction.options.getInteger("channel");
            if (channel < 1 || channel > 10) return await interaction.reply("The channel number should be between 1 and 10!");
            return await this.tune(interaction, channel);
        } else if (sub === "off") return await this.off(interaction);
    }

    async run(message: Message, args: string[]) {
        if (!this.subcommands.includes(args[0])) return await message.channel.send("There is no such command!");
        if (args[0] === "tune") {
            const channel = parseInt(args[1]);
            if (isNaN(channel)) return await message.channel.send("The channel number is not valid!");
            if (channel < 1 || channel > 10) return await message.channel.send("The channel number should be between 1 and 10!");
            return await this.tune(message, channel);
        } else if (args[0] === "off") return await this.off(message);
    }

    async tune(message: Message | CommandInteraction, channel: number) {
        var connection = getVoiceConnection(message.guildId);
        if (!connection) {
            const member = <GuildMember> message.member;
            if (!member.voice.channelId) return await msgOrRes(message, "You are not in any voice channel!");
            connection = joinVoiceChannel({ channelId: member.voice.channelId, guildId: message.guildId, adapterCreator: createDiscordJSAdapter(<VoiceChannel> member.voice.channel) });
        }
        const radioCh = players[channel - 1];
        if (!radioCh) return await msgOrRes(message, "That channel is not available!");
        connection.subscribe(radioCh);
        await msgOrRes(message, "Connected!");
    }

    async off(message: Message | CommandInteraction) {
        const connection = getVoiceConnection(message.guildId);
        if (connection) connection.destroy();
        await msgOrRes(message, "Disconnected!");
    }

    async add(message: Message | CommandInteraction, str: string) {
        try {
            var songs = [];
            var result = { error: true, message: "No link/keywords/attachments!", songs: [], msg: null };
            if (validYTPlaylistURL(str)) result = await addYTPlaylist(str);
            else if (validYTURL(str)) result = await addYTURL(str);
            else if (validSPURL(str)) result = await addSPURL(message, str);
            else if (validSCURL(str)) result = await addSCURL(str);
            else if (validGDFolderURL(str)) {
                const msg = message instanceof Message ? await message.channel.send("Processing track: (Initializing)") : <Message> await message.reply({ content: "Processing track: (Initializing)", fetchReply: true });
                result = await addGDFolderURL(str, async(i, l) => await msg.edit(`Processing track: **${i}/${l}**`));
                result.msg = msg;
            } else if (validGDURL(str) || validGDDLURL(str)) result = await addGDURL(str);
            else if (validMSURL(str)) result = await addMSURL(str);
            else if (validURL(str)) result = await addURL(str);
            else if (message instanceof Message && message.attachments.size > 0) result = await addAttachment(message);
            else result = await search(message, str);
            if (result.error) return await msgOrRes(message, result.message || "Failed to add soundtrack");
            songs = result.songs;
            if (!songs || songs.length < 1) return await msgOrRes(message, "There was an error trying to add the soundtrack!");
        } catch (err) {
            await msgOrRes(message, "There was an error trying to add the soundtrack to the queue!");
            console.error(err);
        }
    }
}

const cmd = new RadioCommand();
export default cmd;