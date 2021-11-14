
import { ServerQueue, SlashCommand, SoundTrack } from "../../classes/NorthClient";
import * as Discord from "discord.js";
import sanitize from "sanitize-filename";
import scdl from 'soundcloud-downloader';
import { isEquivalent, requestStream, validYTPlaylistURL, validYTURL, validSPURL, validSCURL, validGDURL, validMSURL, validURL, msgOrRes, requestYTDLStream } from "../../function";
import { addYTURL, addYTPlaylist, addSPURL, addSCURL, addMSURL, search } from "../../helpers/addTrack";
import { getQueues, setQueue, updateQueue } from "../../helpers/music";
import { getMP3 } from "../../helpers/musescore";

class DownloadCommand implements SlashCommand {
    name = "download"
    description = "Downloads the soundtrack from the server queue or online."
    usage = "[index | link | keywords]"
    aliases = ["dl"]
    category = 0
    options = [{
        name: "keywords",
        description: "Index/Link/Keywords of soundtrack.",
        required: false,
        type: "STRING"
    }]

    async execute(interaction: Discord.CommandInteraction) {
        var serverQueue = getQueues().get(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        const keywords = interaction.options.getString("keywords");
        await interaction.deferReply();
        if (keywords && isNaN(parseInt(keywords))) return await this.downloadFromArgs(interaction, serverQueue, keywords);
        if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue.");
        var song = serverQueue.songs[0];
        const parsed = keywords ? parseInt(keywords) : -1;
        if (parsed <= serverQueue.songs.length && parsed > 0) song = serverQueue.songs[parsed - 1];
        await this.download(interaction, serverQueue, song);
    }
    
    async run(message: Discord.Message, args: string[]) {
        var serverQueue = getQueues().get(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        const parsed = parseInt(args[0]);
        if (args[0] && isNaN(parsed)) return await this.downloadFromArgs(message, serverQueue, args.join(" "));
        if (serverQueue.songs.length < 1) return await message.channel.send("There is nothing in the queue.");
        var song = serverQueue.songs[0];
        if (parsed <= serverQueue.songs.length && parsed > 0) song = serverQueue.songs[parsed - 1];
        await this.download(message, serverQueue, song);
    }

    async download(message: Discord.Message | Discord.CommandInteraction, serverQueue: ServerQueue, song: SoundTrack) {
        try {
            if (song?.isLive) {
                const result = await addYTURL(song.url, song.type);
                if (result.error) throw "Failed to find video";
                if (!isEquivalent(result.songs[0], song)) {
                    song = result.songs[0];
                    serverQueue.songs[0] = song;
                    updateQueue(message.guild.id, serverQueue);
                    if (song?.isLive) return await msgOrRes(message, "Livestream downloading is not supported and recommended! Come back later when the livestream is over.");
                }
            }
        } catch (err: any) {
            console.error(err);
            return await msgOrRes(message, `There was an error trying to download the soundtrack!`);
        }
        const msg = <Discord.Message> await msgOrRes(message, `Downloading... (Soundtrack Type: **Type ${song.type}**)`);
        let stream;
        try {
            switch (song.type) {
                case 2:
                case 4:
                    stream = await requestStream(song.url);
                    break;
                case 3:
                    stream = await scdl.download(song.url);
                    break;
                case 5:
                    const mp3 = await getMP3(song.url);
                    if (mp3.error) throw new Error(mp3.message);
                    if (mp3.url.startsWith("https://www.youtube.com/embed/")) {
                        const ytid = mp3.url.split("/").slice(-1)[0].split("?")[0];
                        stream = await requestYTDLStream(`https://www.youtube.com/watch?v=${ytid}`, { highWaterMark: 1 << 22, filter: "audioonly", dlChunkSize: 0 });
                    } else stream = (await requestStream(mp3.url)).data;
                    break;
                default:
                    stream = await requestYTDLStream(song.url, { highWaterMark: 1 << 22, filter: "audioonly", dlChunkSize: 0 });
                    break;
            }
            if (!stream) throw new Error("Cannot receive stream");
        } catch (err: any) {
            console.error(err);
            return await msg.edit(`There was an error trying to download the soundtrack!`);
        }
        try {
            await msg.edit("The file may not appear just yet. Please be patient!");
            const attachment = new Discord.MessageAttachment(stream, sanitize(`${song.title}.mp3`));
            if (message instanceof Discord.Message) await message.channel.send({ files: [attachment] });
            else await message.followUp({ files: [attachment] });
        } catch (err: any) {
            if (message instanceof Discord.Message) await message.channel.send(`There was an error trying to send the soundtrack! (${err.message})`);
            else await message.followUp(`There was an error trying to send the soundtrack! (${err.message})`);
            console.error(err);
        }
    }

    async downloadFromArgs(message: Discord.Message | Discord.CommandInteraction, serverQueue: ServerQueue, link: string) {
        var result = { error: true, songs: [], msg: null };
        try {
            if (validYTPlaylistURL(link)) result = await addYTPlaylist(link);
            else if (validYTURL(link)) result = await addYTURL(link);
            else if (validSPURL(link)) result = await addSPURL(message, link);
            else if (validSCURL(link)) result = await addSCURL(link);
            else if (validGDURL(link)) return await msgOrRes(message, "Wait, you should be able to access this file?");
            else if (validMSURL(link)) result = await addMSURL(link);
            else if (validURL(link)) return await msgOrRes(message, "Wait, you should be able to access this file?");
            else result = await search(message, link);
            if (result.error) return;
            if (result.msg) result.msg.edit({ content: "Getting your download ready...", embeds: [] });
            for (const song of result.songs) await this.download(message, serverQueue, song);
        } catch (err: any) {
            await msgOrRes(message, "There was an error trying to download the soundtack!");
            console.error(err);
        }
    }
}

const cmd = new DownloadCommand();
export default cmd;