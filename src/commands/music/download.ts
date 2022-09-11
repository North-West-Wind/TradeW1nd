import { ServerQueue, SlashCommand, SoundTrack } from "../../classes/NorthClient.js";
import * as Discord from "discord.js";
import sanitize from "sanitize-filename";
import { isEquivalent, validYTPlaylistURL, validYTURL, validSPURL, validSCURL, validGDURL, validMSURL, validURL, validMSSetURL } from "../../function.js";
import { addYTURL, addYTPlaylist, addSPURL, addSCURL, addMSURL, search, addMSSetURL, getStream } from "../../helpers/addTrack.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import * as fs from "fs";
import archiver from "archiver";

export const downloading = new Discord.Collection<Discord.Snowflake, number>();

class DownloadCommand implements SlashCommand {
    name = "download"
    description = "Downloads the soundtrack from the server queue or online."
    usage = "[index | link | keywords]"
    aliases = ["dl"]
    category = 0
    options = [
        {
            name: "keywords",
            description: "Index/Link/Keywords of soundtrack. Type \"all\" to download the entire queue.",
            required: false,
            type: Discord.ApplicationCommandOptionType.String
        },
        {
            name: "all",
            description: "Whether or not to download the entire queue. When enabled, keywords will be ignored.",
            required: false,
            type: Discord.ApplicationCommandOptionType.Boolean
        }
    ]

    async execute(interaction: Discord.ChatInputCommandInteraction) {
        var serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (interaction.options.getBoolean("all")) return await this.downloadAll(interaction, serverQueue);
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
            stream = await getStream(song, { type: "download" });
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
            await (interaction.replied || interaction.deferred ? interaction.editReply : interaction.reply)("There was an error trying to download the soundtack!");
            console.error(err);
        }
    }

    async downloadAll(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue) {
        if (downloading.has(interaction.guildId)) return await interaction.reply(`The download is already in progress! Use this [link](https://northwestwind.ml/tradew1nd/download/${interaction.guildId}) to track its progress.`);
        if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}`)) {
            const row = new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(
                new Discord.ButtonBuilder({ label: "Yes", style: Discord.ButtonStyle.Success, customId: "yes" }),
                new Discord.ButtonBuilder({ label: "No", style: Discord.ButtonStyle.Danger, customId: "no" })
            );
            const res = await interaction.reply({ content: "This will remove the old downloaded list. Are you sure you want to continue?", components: [row] });
            const int = await res.awaitMessageComponent({ filter: x => x.user.id === interaction.user.id, time: 60000 }).catch(() => { });
            if (!int) return await interaction.editReply({ content: "No response received. Download cancelled.", components: [] });
            if (int.customId === "no") return await int.update({ content: "Download cancelled.", components: [] });
            await int.update({ content: `Download started. Use this [link](https://northwestwind.ml/tradew1nd/download/${interaction.guildId}) to track its progress.`, components: [] });
            fs.unlinkSync(`${process.env.CACHE_DIR}/${interaction.guildId}`);
        } else await interaction.reply(`Download started. Use this [link](https://northwestwind.ml/tradew1nd/download/${interaction.guildId}) to track its progress.`);
        downloading.set(interaction.guildId, 0);
        fs.mkdirSync(`${process.env.CACHE_DIR}/${interaction.guildId}`);
        var count = 0;
        for (const track of serverQueue.songs) {
            try {
                if (track?.isLive) {
                    const result = await addYTURL(track.url, track.type);
                    if (result.error) throw new Error("Failed to find video");
                    if (!isEquivalent(result.songs[0], track))
                        if (result.songs[0]?.isLive) continue;
                }
            } catch (err: any) { continue; }
            const writeStream = fs.createWriteStream(`${process.env.CACHE_DIR}/${interaction.guildId}/${track.title}.mp3`);
            let stream: NodeJS.ReadableStream;
            try {
                stream = await getStream(track, { type: "download" });
                if (!stream) throw new Error("Cannot receive stream");
            } catch (err: any) { continue; }
            await new Promise(res => stream.pipe(writeStream).on("close", res));
            downloading.set(interaction.guildId, ++count / serverQueue.songs.length);
        }
        const archive = archiver.create("zip");
        const output = fs.createWriteStream(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`);
        archive.pipe(output);
        await archive.directory(`${process.env.CACHE_DIR}/${interaction.guildId}`, false).finalize();
        await interaction.user.send(`Your download has finished! Go to [link](https://northwestwind.ml/tradew1nd/download/${interaction.guildId}) to download it.\nThe file will be deleted after 2 hours.`);
        downloading.delete(interaction.guildId);
        setTimeout(() => {
            if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}`)) fs.rmdirSync(`${process.env.CACHE_DIR}/${interaction.guildId}`);
            if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`)) fs.rmSync(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`);
        }, 7200000);
    }
}

const cmd = new DownloadCommand();
export default cmd;