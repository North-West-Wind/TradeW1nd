import { ServerQueue, SlashCommand, SoundTrack } from "../../classes/NorthClient.js";
import * as Discord from "discord.js";
import sanitize from "sanitize-filename";
import { Readable } from "stream";
import { isEquivalent, validYTPlaylistURL, validYTURL, validSPURL, validSCURL, validGDURL, validMSURL, validURL, validMSSetURL, wait } from "../../function.js";
import { addYTURL, addYTPlaylist, addSPURL, addSCURL, addMSURL, search, addMSSetURL, getStream } from "../../helpers/addTrack.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import * as fs from "fs";
import archiver from "archiver";

export const downloading = new Discord.Collection<Discord.Snowflake, number>();

class DownloadCommand implements SlashCommand {
    name = "download"
    description = "Downloads the soundtrack from the server queue or online."
    category = 0
    options = [
        {
            name: "queue",
            description: "Downloads a single soundtrack of the queue.",
            type: Discord.ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "index",
                description: "The position of the soundtrack in the queue.",
                required: false,
                type: Discord.ApplicationCommandOptionType.Integer
            }]
        },
        {
            name: "online",
            description: "Downloads a soundtrack from the Internet.",
            type: Discord.ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "link",
                description: "The link of the soundtrack or keywords to search for.",
                required: true,
                type: Discord.ApplicationCommandOptionType.String
            }]
        },
        {
            name: "all",
            description: "Downloads the entire server queue.",
            type: Discord.ApplicationCommandOptionType.Subcommand
        }
    ]

    async execute(interaction: Discord.ChatInputCommandInteraction) {
        var serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        const subcommannd = interaction.options.getSubcommand();
        if (subcommannd === "all") return await this.downloadAll(interaction, serverQueue);
        await interaction.deferReply();
        if (subcommannd === "online") return await this.downloadFromArgs(interaction, serverQueue, interaction.options.getString("link"));
        if (serverQueue.songs.length < 1) return await interaction.editReply("There is nothing in the queue.");
        const index = interaction.options.getInteger("index");
        var song = serverQueue.songs[0];
        if (index && index <= serverQueue.songs.length && index > 0) song = serverQueue.songs[index - 1];
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
        let stream: Readable;
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
        if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`)) {
            const row = new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(
                new Discord.ButtonBuilder({ label: "Yes", style: Discord.ButtonStyle.Success, customId: "yes" }),
                new Discord.ButtonBuilder({ label: "No", style: Discord.ButtonStyle.Danger, customId: "no" })
            );
            const res = await interaction.reply({ content: "This will remove the old downloaded list. Are you sure you want to continue?", components: [row] });
            const int = await res.awaitMessageComponent({ filter: x => x.user.id === interaction.user.id, time: 60000 }).catch(() => { });
            if (!int) return await interaction.editReply({ content: "No response received. Download cancelled.", components: [] });
            if (int.customId === "no") return await int.update({ content: "Download cancelled.", components: [] });
            await int.update({ content: `Download started. Use this [link](https://northwestwind.ml/tradew1nd/download/${interaction.guildId}) to track its progress.`, components: [] });
            if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}`)) fs.rmSync(`${process.env.CACHE_DIR}/${interaction.guildId}`, { recursive: true });
            fs.unlinkSync(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`);
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
            let stream: Readable | boolean;
            async function doIt() {
                const writeStream = fs.createWriteStream(`${process.env.CACHE_DIR}/${interaction.guildId}/${sanitize(track.title)}.mp3`);
                let retry = false;
                if ([0, 1].includes(track.type)) stream = await Promise.race([getStream(track, { type: "download" }), new Promise<boolean>(res => setTimeout(() => { retry = true; res(true); }, 30000))]);
                else stream = await getStream(track, { type: "download" });
                if (stream && typeof stream === "boolean") retry = true;
                if (!stream) throw new Error("Cannot receive stream");
                if (!retry) await Promise.race([new Promise(res => (<Readable>stream).pipe(writeStream).on("close", res)), new Promise(res => setTimeout(() => { retry = true; res(undefined); }, 60000))]);
                if (retry) {
                    (<Readable>stream)?.destroy();
                    writeStream?.destroy();
                    await wait(30000);
                    return await doIt();
                }
            }
            try {
                await doIt();
            } catch (err: any) { }
            fs.writeFileSync(`${process.env.CACHE_DIR}/${interaction.guildId}/progress.json`, JSON.stringify({ count, initializer: interaction.user.id }, null, 2));
            downloading.set(interaction.guildId, ++count / serverQueue.songs.length);
        }
        fs.rmSync(`${process.env.CACHE_DIR}/${interaction.guildId}/progress.json`);
        const archive = archiver.create("zip");
        const output = fs.createWriteStream(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`);
        archive.pipe(output);
        await archive.directory(`${process.env.CACHE_DIR}/${interaction.guildId}`, false).finalize();
        await interaction.user.send(`Your download has finished! Go to the link below to download it.\nThe file will be deleted after 2 hours.\nhttps://northwestwind.ml/tradew1nd/download/${interaction.guildId}`);
        downloading.delete(interaction.guildId);
        if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}`)) fs.rmSync(`${process.env.CACHE_DIR}/${interaction.guildId}`, { recursive: true });
        setTimeout(() => {
            if (fs.existsSync(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`)) fs.rmSync(`${process.env.CACHE_DIR}/${interaction.guildId}.zip`);
        }, 7200000);
    }
}

const cmd = new DownloadCommand();
export default cmd;