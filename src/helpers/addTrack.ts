import { ButtonStyle, Message, MessageActionRowComponentBuilder, SelectMenuInteraction } from "discord.js";
import * as mm from "music-metadata";
import { muse, museSet } from "musescore-metadata";
import { SCDL } from '@vncsprd/soundcloud-downloader';
import ytdl from "ytdl-core";
import ytpl from "ytpl";
import ytsr, { Video } from "ytsr";
import { decodeHtmlEntity, isGoodMusicVideoContent, validGDDLURL, color, humanDurationToNum, requestStream, duration } from "../function.js";
import * as Stream from 'stream';
import SpotifyWebApi from "spotify-web-api-node";
import * as crypto from "crypto";
import rp from "request-promise-native";
import * as cheerio from "cheerio";
import * as Discord from "discord.js";
import { ServerQueue, SoundTrack } from "../classes/NorthClient.js";
import { getMP3 } from "./musescore.js";
import { cacheTrack, findCache, updateQueue } from "./music.js";
import { TrackInfo } from "@vncsprd/soundcloud-downloader/dist/info.js";
import fetch from "node-fetch";
let spotifyApi: SpotifyWebApi;
const scdl = new SCDL();

export function getSCDL() {
    return scdl;
}

export function init() {
    if (spotifyApi) return;
    spotifyApi = new SpotifyWebApi({
        clientId: process.env.SPOTID,
        clientSecret: process.env.SPOTSECRET
    });
    async function fetchToken() {
        const d = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(d.body.access_token);
        setTimeout(fetchToken, d.body.expires_in * 1000);
    }
    fetchToken();
}

export async function addAttachment(file: Discord.Attachment) {
    const stream = <Stream.Readable>await fetch(file.url).then(res => res.body);
    try {
        var metadata = await mm.parseStream(stream, {}, { duration: true });
    } catch (err: any) {
        return { error: true, message: "The audio format is not supported!", msg: null, songs: [] };
    }
    if (!metadata) {
        return { error: true, message: "An error occured while parsing the audio file into stream! Maybe it is not link to the file?", msg: null, songs: [] };
    }
    const length = Math.round(metadata.format.duration);
    const songs = [{
        title: (file.name ? file.name.split(".").slice(0, -1).join(".") : file.url.split("/").slice(-1)[0].split(".").slice(0, -1).join(".")).replace(/_/g, " "),
        url: file.url,
        type: 2,
        time: length,
        volume: 1,
        thumbnail: "https://www.dropbox.com/s/ms27gzjcz4c3h3z/audio-x-generic.svg?dl=1",
        isLive: false
    }];
    return { error: false, songs, msg: null, message: null };
}
export async function addYTPlaylist(link: string) {
    try {
        var playlistInfo = await ytpl(link, { limit: Infinity });
    } catch (err: any) {
        let msg = "There was an error trying to fetch your playlist!";
        if (err.message === "This playlist is private.") msg = "The playlist is private!";
        return { error: true, message: msg, msg: null, songs: [] };
    }
    const videos = playlistInfo.items.filter(x => x && !x.isLive);
    const songs = [];
    for (const video of videos) songs.push({
        title: video.title,
        url: video.shortUrl,
        type: 0,
        time: video.durationSec,
        thumbnail: video.bestThumbnail.url,
        volume: 1,
        isLive: !!video?.isLive
    });
    return { error: false, songs: songs, msg: null, message: null };
}
export async function addYTURL(link: string, type = 0) {
    try {
        const options = <any>{};
        if (process.env.COOKIE) {
            options.requestOptions = {};
            options.requestOptions.headers = { cookie: process.env.COOKIE };
            if (process.env.YT_TOKEN) options.requestOptions.headers["x-youtube-identity-token"] = process.env.YT_TOKEN;
        }
        var songInfo = await ytdl.getInfo(link, options);
    } catch (err: any) {
        console.error(err);
        return { error: true, message: "Failed to get video data!", msg: null, songs: [] };
    }
    const length = parseInt(songInfo.videoDetails.lengthSeconds);
    const thumbnails = songInfo.videoDetails.thumbnails;
    let thumbUrl = thumbnails[thumbnails.length - 1].url;
    let maxWidth = 0;
    for (const thumbnail of thumbnails) {
        if (thumbnail.width > maxWidth) {
            maxWidth = thumbnail.width;
            thumbUrl = thumbnail.url;
        }
    }
    const songs = [
        {
            title: decodeHtmlEntity(songInfo.videoDetails.title),
            url: songInfo.videoDetails.video_url,
            type: type,
            time: length,
            thumbnail: thumbUrl,
            volume: 1,
            isPastLive: !!songInfo?.videoDetails?.isLiveContent
        }
    ];
    return { error: false, songs: songs, msg: null, message: null };
}
export async function addSPURL(interaction: Discord.ChatInputCommandInteraction, link: string) {
    const url_array = link.replace("https://", "").split("/");
    let musicID = url_array[2].split("?")[0];
    let highlight = false;
    if (url_array[2].split("?")[1]) highlight = url_array[2].split("?")[1].split("=")[0] === "highlight";
    if (highlight) musicID = url_array[2].split("?")[1].split("=")[1].split(":")[2];
    const type = url_array[1];
    const songs = [];
    let tracks, counter = 0;
    switch (type) {
        case "playlist":
            var musics = await spotifyApi.getPlaylist(musicID);
            tracks = musics.body.tracks.items;
            async function checkAll() {
                if (musics.body.tracks.next) {
                    const offset = musics.body.tracks.offset + 50;
                    musics = await spotifyApi.getPlaylist(musicID, <any>{ limit: 50, offset: offset });
                    tracks = tracks.concat(musics.body.tracks.items);
                    return await checkAll();
                }
            }
            await checkAll();
            var mesg = await interaction.editReply(`Processing track: **0/${tracks.length}**`);
            for (const track of <SpotifyApi.PlaylistTrackObject[]>tracks) {
                await mesg.edit(`Processing track: **${++counter}/${tracks.length}**`).catch(() => { });
                var results = [];
                try {
                    const searched = await ytsr(`${track.track.artists[0].name} - ${track.track.name}`, { limit: 20 });
                    results = searched.items.filter(x => x.type === "video" && x.duration.split(":").length < 3);
                    if (results.length < 1) {
                        const msg = await mesg.channel.send(`Cannot find video for ${track.track.name}`);
                        setTimeout(async () => { try { await msg.delete() } catch (err) { } }, 10000);
                        continue;
                    }
                } catch (err: any) {
                    return { error: true, msg: null, songs: [], message: err.message };
                }
                var o = 0;
                for (var s = 0; s < results.length; s++) {
                    if (isGoodMusicVideoContent(results[s])) {
                        o = s;
                        s = results.length - 1;
                    }
                    if (s + 1 == results.length) {
                        songs.push({
                            title: track.track.name,
                            url: results[o].link,
                            type: 1,
                            spot: track.track.external_urls.spotify,
                            thumbnail: track.track.album.images[0]?.url,
                            time: !results[o].live ? humanDurationToNum(results[o].duration) : 0,
                            volume: 1,
                            isLive: !!results[o]?.live
                        });
                    }
                }
            }
            await mesg.edit("Track processing completed.").then(msg => setTimeout(() => msg.delete().catch(() => { }), 10000));
            break;
        case "album":
            var image;
            if (!highlight) {
                const album = await spotifyApi.getAlbums([musicID]);
                image = album.body.albums[0].images[0]?.url;
                let data = await spotifyApi.getAlbumTracks(musicID, { limit: 50 });
                tracks = data.body.items;
                async function checkAll() {
                    if (!data.body.next) return;
                    const offset = data.body.offset + 50;
                    data = await spotifyApi.getAlbumTracks(musicID, { limit: 50, offset: offset });
                    tracks = tracks.concat(data.body.items);
                    return await checkAll();
                }
                await checkAll();
            } else {
                const data = await spotifyApi.getTracks([musicID]);
                tracks = data.body.tracks;
            }
            var mesg = await interaction.editReply(`Processing track: **0/${tracks.length}**`);
            for (const track of <SpotifyApi.TrackObjectFull[]>tracks) {
                await mesg.edit(`Processing track: **${++counter}/${tracks.length}**`).catch(() => { });
                var results = [];
                try {
                    const searched = await ytsr(`${track.artists[0].name} - ${track.name}`, { limit: 20 });
                    results = searched.items.filter(x => x.type === "video" && x.duration.split(":").length < 3);
                    if (results.length < 1) {
                        const msg = await mesg.channel.send(`Cannot find video for ${track.name}`);
                        setTimeout(async () => { try { await msg.delete() } catch (err) { } }, 10000);
                        continue;
                    }
                } catch (err: any) {
                    return { error: true, msg: null, songs: [], message: err.message };
                }
                var o = 0;
                for (var s = 0; s < results.length; s++) {
                    if (isGoodMusicVideoContent(results[s])) {
                        o = s;
                        s = results.length - 1;
                    }
                    if (s + 1 == results.length) {
                        songs.push({
                            title: track.name,
                            url: results[o].link,
                            type: 1,
                            spot: track.external_urls.spotify,
                            thumbnail: highlight ? track.album.images[o]?.url : image,
                            time: !results[o].live ? humanDurationToNum(results[o].duration) : 0,
                            volume: 1,
                            isLive: !!results[o]?.live
                        });
                    }
                }
            }
            await mesg.edit("Track processing completed.").then(msg => setTimeout(() => msg.delete().catch(() => { }), 10000));
            break;
        case "track":
            tracks = (await spotifyApi.getTracks([musicID])).body.tracks;
            for (const track of <SpotifyApi.TrackObjectFull[]>tracks) {
                var resultss;
                try {
                    const searched = await ytsr(`${track.artists[0].name} - ${track.name}`, { limit: 20 });
                    resultss = searched.items.filter(x => x.type === "video" && x.duration.split(":").length < 3);
                    if (resultss.length < 1) {
                        const msg = await mesg.channel.send(`Cannot find video for ${track.name}`);
                        setTimeout(async () => { try { await msg.delete() } catch (err) { } }, 10000);
                        continue;
                    }
                } catch (err: any) {
                    return { error: true, msg: null, songs: [], message: err.message };
                }
                var o = 0;
                for (var s = 0; s < resultss.length; s++) {
                    if (isGoodMusicVideoContent(resultss[s])) {
                        o = s;
                        s = resultss.length - 1;
                    }
                    if (s + 1 == resultss.length) {
                        songs.push({
                            title: track.name,
                            url: resultss[o].link,
                            type: 1,
                            spot: track.external_urls.spotify,
                            thumbnail: track.album.images[o].url,
                            time: !resultss[o].live ? humanDurationToNum(resultss[o].duration) : 0,
                            volume: 1,
                            isLive: !!resultss[o]?.live
                        });
                    }
                }
            }
            break;
    }
    return { error: false, songs: songs, msg: null, message: null };
}
export async function addSCURL(link: string) {
    const res = await fetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(link)}&client_id=${await scdl.getClientID()}`);
    if (!res.ok) return { error: true, message: "A problem occured while fetching the track information! Status Code: " + res.status, msg: null, songs: [] };
    const data = <any>await res.json();
    if (data.kind == "user") return { error: true, message: "What do you think you can do with a user?", msg: null, songs: [] };
    const songs = [];
    if (data.kind == "playlist") {
        for (const track of data.tracks) {
            const length = Math.round(track.duration / 1000);
            songs.push({
                title: track.title,
                type: 3,
                id: track.id,
                time: length,
                thumbnail: track.artwork_url,
                url: track.permalink_url,
                volume: 1,
                isLive: false
            });
        }
    } else {
        const length = Math.round(data.duration / 1000);
        songs.push({
            title: data.title,
            type: 3,
            id: data.id,
            time: length,
            thumbnail: data.artwork_url,
            url: data.permalink_url,
            volume: 1,
            isLive: false
        });
    }
    return { error: false, songs: songs, msg: null, message: null };
}
export async function addGDURL(link: string) {
    let dl;
    let id;
    const alphanumeric = /^[a-zA-Z0-9\-_]+$/;
    if (!validGDDLURL(link)) {
        const formats = [/https:\/\/drive\.google\.com\/file\/d\/(?<id>.*?)\/(?:edit|view)(\?usp=sharing)?/, /https:\/\/drive\.google\.com\/open\?id=(?<id>.*?)$/];
        formats.forEach((regex) => {
            const matches = link.match(regex);
            if (matches?.groups?.id) id = matches.groups.id;
        });
        if (!id) {
            if (alphanumeric.test(link)) id = link;
            else return { error: true, message: `The link/keywords you provided is invalid!`, msg: null, songs: [] };
        }
        dl = "https://drive.google.com/uc?export=download&id=" + id;
    } else {
        dl = link;
        const matches = link.match(/^(https?)?:\/\/drive\.google\.com\/uc\?export=download&id=(?<id>.*?)$/);
        if (matches?.groups?.id) id = matches.groups.id;
        else {
            id = link.split("=")[link.split("=").length - 1];
            if (alphanumeric.test(id)) link = `https://drive.google.com/file/d/${id}/view`;
            else return { error: true, message: `The link/keywords you provided is invalid!`, msg: null, songs: [] };
        }
    }
    const f = await fetch(dl);
    if (!f.ok) return { error: true, message: `Received HTTP Status: ${f.status}`, msg: null, songs: [] };
    const stream = <Stream.Readable>f.body;
    let title = "No Title";
    try {
        var metadata = await mm.parseStream(stream, {}, { duration: true });
        const html = await fetch(link).then(res => res.text());
        const $ = cheerio.load(html);
        title = metadata.common.title ? metadata.common.title : $("title").text().split(" - ").slice(0, -1).join(" - ").split(".").slice(0, -1).join(".");
    } catch (err: any) {
        return { error: true, message: "An error occured while parsing the audio file into stream! Note that the file cannot be too large (>100MB)!", msg: null, songs: [] };
    }
    if (!metadata) return { error: true, message: "An error occured while parsing the audio file into stream! Note that the file cannot be too large (>100MB)!", msg: null, songs: [] };
    const length = Math.round(metadata.format.duration);
    const song = {
        title: title,
        url: dl,
        type: 4,
        time: length,
        volume: 1,
        thumbnail: "https://drive-thirdparty.googleusercontent.com/256/type/audio/mpeg",
        isLive: false
    };
    return { error: false, songs: [song], msg: null, message: null };
}
export async function addGDFolderURL(link: string, cb: Function = async () => { }) {
    const songs = [];
    try {
        const body = await rp(link);
        const $ = cheerio.load(body);
        const elements = $("div[data-target='doc']");
        let i = 0;
        for (const el of elements.toArray()) {
            const id = (<any>el).attribs["data-id"];
            const link = "https://drive.google.com/uc?export=download&id=" + id;
            ++i;
            cb(i, elements.length);
            let title = "No Title";
            try {
                const html = await rp("https://drive.google.com/file/d/" + id + "/view");
                const $1 = cheerio.load(html);
                title = $1("title").text().split(" - ").slice(0, -1).join(" - ").split(".").slice(0, -1).join(".");
                songs.push({
                    title: title,
                    url: link,
                    type: 4,
                    volume: 1,
                    thumbnail: "https://drive-thirdparty.googleusercontent.com/256/type/audio/mpeg",
                    isLive: false
                });
            } catch (err: any) { console.error(err); }
        }
    } catch (err: any) {
        return { error: true, message: "Cannot open your link!", msg: null, songs: [] };
    }
    return { error: false, songs: songs, msg: null, message: null };
}
export async function addMSSetURL(link: string) {
    try {
        var data = await museSet(link, { all: true });
    } catch (err: any) {
        return { error: true, message: "Failed to fetch metadata of the set!", msg: null, songs: [] };
    }
    return { error: false, songs: data.scores.map(score => ({ title: score.title, url: score.url, type: 5, time: humanDurationToNum(score.duration), volume: 1.5, thumbnail: "http://s.musescore.org/about/images/musescore-mu-logo-bluebg-xl.png", isLive: false })), msg: null, message: null };
}
export async function addMSURL(link: string) {
    try {
        var data = await muse(link);
    } catch (err: any) {
        return { error: true, message: "Failed to fetch metadata of the score!", msg: null, songs: [] };
    }
    const song = {
        title: data.title,
        url: data.url,
        type: 5,
        time: humanDurationToNum(data.duration),
        volume: 1.5,
        thumbnail: "http://s.musescore.org/about/images/musescore-mu-logo-bluebg-xl.png",
        isLive: false
    };
    return { error: false, songs: [song], msg: null, message: null };
}

export async function addURL(link: string) {
    let title = link.split("/").slice(-1)[0].split(".").slice(0, -1).join(".").replace(/_/g, " ");
    try {
        var stream = <Stream.Readable>await fetch(link).then(res => res.body);
        var metadata = await mm.parseStream(stream, {}, { duration: true });
        if (metadata.format.trackInfo && metadata.format.trackInfo[0]?.name) title = metadata.format.trackInfo[0].name;
    } catch (err: any) {
        return { error: true, message: "The audio format is not supported!", msg: null, songs: [] };
    }
    if (!metadata || !stream) return { error: true, message: "There was an error while parsing the audio file into stream! Maybe it is not link to the file?", msg: null, songs: [] };
    const length = Math.round(metadata.format.duration);
    const song = {
        title: title,
        url: link,
        type: 2,
        time: length,
        volume: 1,
        thumbnail: "https://www.dropbox.com/s/ms27gzjcz4c3h3z/audio-x-generic.svg?dl=1",
        isLive: false
    };
    return { error: false, songs: [song], msg: null, message: null };
}
export async function search(interaction: Discord.ChatInputCommandInteraction, link: string) {
    const allEmbeds: Discord.EmbedBuilder[] = [], allMenus: Discord.SelectMenuBuilder[] = [];
    const Embed = new Discord.EmbedBuilder()
        .setTitle(`Search result of ${link} on YouTube`)
        .setColor(color())
        .setTimestamp()
        .setFooter({ text: "Please do so within 60 seconds.", iconURL: interaction.client.user.displayAvatarURL() });
    const results = { yt: [], sc: [] };
    try {
        const searched = await ytsr(link, { limit: 20 });
        var video = <Video[]>searched.items.filter(x => x.type === "video" && !x.isUpcoming);
    } catch (err: any) {
        console.error(err);
        await await interaction.editReply("There was an error trying to search the videos!");
        return { error: true, msg: null, songs: [], message: err.message };
    }
    const ytResults = video.map(x => ({
        title: decodeHtmlEntity(x.title),
        url: x.url,
        type: 0,
        time: !x.isLive ? humanDurationToNum(x.duration) : 0,
        thumbnail: x.bestThumbnail?.url,
        volume: 1,
        isLive: x.isLive
    })).filter(x => !!x.url);
    let num = 0;
    if (ytResults.length > 0) {
        results.yt = ytResults;
        Embed.setDescription("This page shows search results from **YouTube**. The other page shows search results from **SoundCloud**.\nChoose the soundtrack from the menu, or click \"cancel\" to cancel.\n\n" + ytResults.map(x => `${++num} - **[${x.title}](${x.url})** : **${!x.time ? "∞" : duration(x.time, "seconds")}**`).slice(0, 10).join("\n"));
        allEmbeds.push(Embed);
        const menu = new Discord.SelectMenuBuilder().setCustomId("yt").setMinValues(1).setMaxValues(ytResults.length);
        for (let ii = 0; ii < ytResults.length; ii++) menu.addOptions({ label: ytResults[ii].title, value: ii.toString() });
        allMenus.push(menu);
    }
    const scEm = new Discord.EmbedBuilder()
        .setTitle(`Search result of ${link} on SoundCloud`)
        .setColor(color())
        .setTimestamp()
        .setFooter({ text: "Please do so within 60 seconds.", iconURL: interaction.client.user.displayAvatarURL() });
    try {
        var scSearched = await scdl.search({
            limit: 20,
            query: link,
            resourceType: "tracks"
        });
        num = 0;
    } catch (err: any) {
        console.error(err);
        await await interaction.editReply("There was an error trying to search the videos!");
        return { error: true, msg: null, songs: [], message: err.message };
    }
    const scResults = (<TrackInfo[]>scSearched.collection).map(x => ({
        title: x.title,
        url: x.permalink_url,
        type: 3,
        time: Math.floor(x.duration / 1000),
        thumbnail: x.artwork_url,
        volume: 1,
        isLive: false
    })).filter(x => !!x.url);
    if (scResults.length > 0) {
        results.sc = scResults;
        scEm.setDescription("This page shows search results from **SoundCloud**. The other page shows search results from **YouTube**.\nChoose the soundtrack from the menu, or click \"cancel\" to cancel.\n\n" + scResults.map(x => `${++num} - **[${x.title}](${x.url})** : **${!x.time ? "∞" : duration(x.time, "seconds")}**`).slice(0, 10).join("\n"));
        allEmbeds.push(scEm);
        const menu = new Discord.SelectMenuBuilder().setCustomId("sc");
        for (let ii = 0; ii < scResults.length; ii++) menu.addOptions({ label: scResults[ii].title, value: ii.toString() });
        allMenus.push(menu);
    }
    if (allEmbeds.length < 1) {
        await await interaction.editReply("Cannot find any result with the given string.");
        return { error: true, msg: null, songs: [], message: null };
    }
    let val = { error: true, songs: [], msg: null, message: null };
    let s = 0;
    const globalRow = new Discord.ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new Discord.ButtonBuilder({ label: "Next Page", emoji: "📄", customId: "next", style: ButtonStyle.Primary }),
        new Discord.ButtonBuilder({ label: "Cancel", emoji: "✖️", customId: "cancel", style: ButtonStyle.Danger }),
    );
    const msg = await interaction.editReply({ embeds: [allEmbeds[0]], components: [new Discord.ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(allMenus[0]), globalRow] });
    const collector = msg.createMessageComponentCollector({ filter: int => int.user.id === interaction.member.user.id, idle: 60000 });
    collector.on("collect", async interaction => {
        switch (interaction.customId) {
            case "next":
                s = (s + 1) % allEmbeds.length;
                await interaction.update({ embeds: [allEmbeds[s]], components: [new Discord.ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(allMenus[s]), globalRow] });
                break;
            case "cancel":
                await interaction.update({});
                collector.emit("end");
                break;
            default:
                if (!interaction.isSelectMenu()) return;
                const descriptions: string[] = [];
                const tracks = [];
                var thumb: string;
                for (const val of (<SelectMenuInteraction>interaction).values) {
                    const o = parseInt(val);
                    const track = results[interaction.customId][o];
                    tracks.push(track);
                    if (!thumb) thumb = track.thumbnail;
                    const length = !track.time ? "∞" : duration(track.time, "seconds");
                    descriptions.push(`**[${decodeHtmlEntity(track.title)}](${track.url})** : **${length}**`);
                }
                const chosenEmbed = new Discord.EmbedBuilder()
                    .setColor(color())
                    .setTitle("Soundtrack(s) chosen:")
                    .setThumbnail(thumb)
                    .setDescription(descriptions.join("\n"))
                    .setTimestamp()
                    .setFooter({ text: "Have a nice day :)", iconURL: interaction.client.user.displayAvatarURL() });
                await interaction.update({ embeds: [chosenEmbed] });
                val = { error: false, songs: tracks, msg, message: null };
                collector.emit("end");
        }
    });
    return new Promise<{ error: boolean, songs: any[], msg: Message, message: any }>(resolve => {
        collector.on("end", async () => {
            if (val.error) {
                const cancelled = new Discord.EmbedBuilder()
                    .setColor(color())
                    .setTitle("Action cancelled.")
                    .setTimestamp()
                    .setFooter({ text: "Have a nice day! :)", iconURL: interaction.client.user.displayAvatarURL() });
                msg.edit({ embeds: [cancelled], components: [] }).then(msg => setTimeout(() => msg.edit({ content: "**[Added Track: No track added]**" }).catch(() => { }), 30000));
            }
            msg.edit({ components: [] });
            resolve(val);
        });
    });
}

export async function getStream(track: SoundTrack, data: { type: "server" | "radio" | "download", guild?: Discord.Guild, serverQueue?: ServerQueue, tracks?: SoundTrack[] }) {
    if (!track.id) track.id = crypto.createHash("md5").update(`${track.title};${track.url}`).digest("hex");
    let stream: Stream.Readable;
    let cacheFound = true;
    if (!(stream = findCache(track.id))) {
        cacheFound = false;
        switch (track.type) {
            case 2:
            case 4:
                var a: Stream.Readable;
                if (!track.time) {
                    const { error, message, songs } = await addGDURL(track.url);
                    if (error) throw new Error(message);
                    track = songs[0];
                    a = <Stream.Readable>(await requestStream(track.url)).data;
                    if (data.type === "server") {
                        data.serverQueue.songs[0] = track;
                        updateQueue(data.guild.id, data.serverQueue);
                    } else if (data.type === "radio") data.tracks[0] = track;
                } else a = <Stream.Readable>(await requestStream(track.url)).data;
                stream = a;
                break;
            case 3:
                stream = await scdl.download(track.url);
                break;
            case 5:
                const c = await getMP3(track.url);
                if (c.error) throw new Error(c.message);
                if (c.url.startsWith("https://www.youtube.com/embed/")) {
                    const ytid = c.url.split("/").slice(-1)[0].split("?")[0];
                    const options = <any>{ highWaterMark: 1 << 19, filter: "audioonly", dlChunkSize: 0 };
                    if (process.env.COOKIE) {
                        options.requestOptions = {};
                        options.requestOptions.headers = { cookie: process.env.COOKIE };
                        if (process.env.YT_TOKEN) options.requestOptions.headers["x-youtube-identity-token"] = process.env.YT_TOKEN;
                    }
                    stream = <Stream.Readable>await ytdl(`https://www.youtube.com/watch?v=${ytid}`, options);
                    cacheFound = true;
                } else stream = <Stream.Readable>(await requestStream(c.url)).data;
                break;
            default:
                const options = <any>{};
                if (process.env.COOKIE) {
                    options.requestOptions = {};
                    options.requestOptions.headers = { cookie: process.env.COOKIE };
                    if (process.env.YT_TOKEN) options.requestOptions.headers["x-youtube-identity-token"] = process.env.YT_TOKEN;
                }
                if (!track?.isPastLive) Object.assign(options, { filter: "audioonly", dlChunkSize: 0, highWaterMark: 1 << 62 });
                else Object.assign(options, { highWaterMark: 1 << 62 });
                stream = await ytdl(track.url, options);
                if (!stream) throw new Error("Failed to get YouTube video stream.");
                cacheFound = true;
                break;
        }
    }
    if (!cacheFound && data.type !== "download") stream = await cacheTrack(track.id, stream);
    return stream;
}
