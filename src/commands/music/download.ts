import { ServerQueue, SlashCommand, SoundTrack } from "../../classes/NorthClient.js";
import * as Discord from "discord.js";
import sanitize from "sanitize-filename";
import { isEquivalent, requestStream, validYTPlaylistURL, validYTURL, validSPURL, validSCURL, validGDURL, validMSURL, validURL, requestYTDLStream, validMSSetURL } from "../../function.js";
import { addYTURL, addYTPlaylist, addSPURL, addSCURL, addMSURL, search, getSCDL, addMSSetURL } from "../../helpers/addTrack.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { getMP3 } from "../../helpers/musescore.js";

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

    async execute(interaction: Discord.ChatInputCommandInteraction) {
        var serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        const keywords = interaction.options.getString("keywords");
        await interaction.deferReply();
        if (keywords && isNaN(parseInt(keywords))) return await this.downloadFromArgs(interaction, serverQueue, keywords);
        if (serverQueue.songs.length < 1) return await interaction.editReply("There is nothing in the queue.");
        var song = serverQueue.songs[0];
        const parsed = keywords ? parseInt(keywords) : -1;
        if (parsed <= serverQueue.songs.length && parsed > 0) song = serverQueue.songs[parsed - 1];
        await this.download(interaction, serverQueue, song);
    }

    async download(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue, song: SoundTrack) {
        try {
            if (song?.isLive) {
                const result = await addYTURL(song.url, song.type);
                if (result.error) throw new Error("Failed to find video");
                if (!isEquivalent(result.songs[0], song)) {
                    song = result.songs[0];
                    serverQueue.songs[0] = song;
                    updateQueue(interaction.guild.id, serverQueue);
                    if (song?.isLive) return await interaction.editReply("Livestream downloading is not supported and recommended! Come back later when the livestream is over.");
                }
            }
        } catch (err: any) {
            console.error(err);
            return await interaction.editReply(`There was an error trying to download the soundtrack!`);
        }
        const msg = await interaction.editReply(`Downloading... (Soundtrack Type: **Type ${song.type}**)`);
        let stream: NodeJS.ReadableStream;
        try {
            switch (song.type) {
                case 2:
                case 4:
                    stream = (await requestStream(song.url)).data;
                    break;
                case 3:
                    stream = await getSCDL().download(song.url);
                    break;
                case 5:
                    const mp3 = await getMP3(song.url);
                    if (mp3.error) throw new Error(mp3.message);
                    if (mp3.url.startsWith("https://www.youtube.com/embed/")) {
                        const ytid = mp3.url.split("/").slice(-1)[0].split("?")[0];
                        stream = <NodeJS.ReadableStream>await requestYTDLStream(`https://www.youtube.com/watch?v=${ytid}`, { highWaterMark: 1 << 25, filter: "audioonly", dlChunkSize: 0 });
                    } else stream = (await requestStream(mp3.url)).data;
                    break;
                default:
                    stream = <NodeJS.ReadableStream>await requestYTDLStream(song.url, { highWaterMark: 1 << 25, filter: "audioonly", dlChunkSize: 0 });
                    break;
            }
            if (!stream) throw new Error("Cannot receive stream");
        } catch (err: any) {
            console.error(err);
            return await msg.edit(`There was an error trying to download the soundtrack!`);
        }
        try {
            await msg.edit("The file may not appear just yet. Please be patient!");
            const attachment = new Discord.AttachmentBuilder(stream).setName(sanitize(`${song.title}.mp3`));
            await interaction.followUp({ files: [attachment] });
        } catch (err: any) {
            await interaction.followUp(`There was an error trying to send the soundtrack! (${err.message})`);
            console.error(err);
        }
    }

    async downloadFromArgs(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue, link: string) {
        var result = { error: true, songs: [], msg: null };
        try {
            if (validYTPlaylistURL(link)) result = await addYTPlaylist(link);
            else if (validYTURL(link)) result = await addYTURL(link);
            else if (validSPURL(link)) result = await addSPURL(interaction, link);
            else if (validSCURL(link)) result = await addSCURL(link);
            else if (validGDURL(link)) return await interaction.reply("Wait, you should be able to access this file?");
            else if (validMSSetURL(link)) result = await addMSSetURL(link);
            else if (validMSURL(link)) result = await addMSURL(link);
            else if (validURL(link)) return await interaction.reply("Wait, you should be able to access this file?");
            else result = await search(interaction, link);
            if (result.error) return;
            if (result.msg) result.msg.edit({ content: "Getting your download ready...", embeds: [] });
            for (const song of result.songs) await this.download(interaction, serverQueue, song);
        } catch (err: any) {
            await (interaction.replied ? interaction.editReply : interaction.reply)("There was an error trying to download the soundtack!");
            console.error(err);
        }
    }
}

const cmd = new DownloadCommand();
export default cmd;