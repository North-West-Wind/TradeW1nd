import * as moment from "moment";
import formatSetup from "moment-duration-format";
import { Message } from "discord.js";
formatSetup(moment);
import * as mm from "music-metadata";
import muse from "musescore-metadata";
import scdl from 'soundcloud-downloader/dist/index';
import ytdl from "ytdl-core";
import ytpl from "ytpl";
import ytsr, { Video } from "ytsr";
import { decodeHtmlEntity, isGoodMusicVideoContent, validGDDLURL, color, msgOrRes, humanDurationToNum, requestStream } from "../function";
import * as Stream from 'stream';
import SpotifyWebApi from "spotify-web-api-node";
import * as crypto from "crypto";
import rp from "request-promise-native";
import * as cheerio from "cheerio";
import * as Discord from "discord.js";
import { TrackInfo } from "soundcloud-downloader/dist/info";
import { SoundTrack } from "../classes/NorthClient";
import { getMP3 } from "./musescore";
import { cacheTrack, findCache, updateQueue } from "./music";
import originalFetch from "node-fetch";
import fetchBuilder from "fetch-retry-ts";
const fetch = fetchBuilder(originalFetch, { retries: 5, retryDelay: attempt => Math.pow(2, attempt) * 1000 });
var spotifyApi: SpotifyWebApi;

export function init() {
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

export async function addAttachment(message: Message) {
    const files = message.attachments;
    const songs = [];
    for (const file of files.values()) {
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
        songs.push({
            title: (file.name ? file.name.split(".").slice(0, -1).join(".") : file.url.split("/").slice(-1)[0].split(".").slice(0, -1).join(".")).replace(/_/g, " "),
            url: file.url,
            type: 2,
            time: length,
            volume: 1,
            thumbnail: "https://www.flaticon.com/svg/static/icons/svg/2305/2305904.svg",
            isLive: false
        });
    }
    return { error: false, songs, msg: null, message: null };
}
export async function addYTPlaylist(link: string) {
    try {
        var playlistInfo = await ytpl(link, { limit: Infinity });
    } catch (err: any) {
        var msg = "There was an error trying to fetch your playlist!";
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
export async function addYTURL(link: string, type: number = 0) {
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
    var length = parseInt(songInfo.videoDetails.lengthSeconds);
    const thumbnails = songInfo.videoDetails.thumbnails;
    var thumbUrl = thumbnails[thumbnails.length - 1].url;
    var maxWidth = 0;
    for (const thumbnail of thumbnails) {
        if (thumbnail.width > maxWidth) {
            maxWidth = thumbnail.width;
            thumbUrl = thumbnail.url;
        }
    }
    var songs = [
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
export async function addSPURL(message: Message | Discord.CommandInteraction, link: string) {
    var url_array = link.replace("https://", "").split("/");
    var musicID = url_array[2].split("?")[0];
    var highlight = false;
    if (url_array[2].split("?")[1]) highlight = url_array[2].split("?")[1].split("=")[0] === "highlight";
    if (highlight) musicID = url_array[2].split("?")[1].split("=")[1].split(":")[2];
    var type = url_array[1];
    var songs = [];
    var tracks, counter = 0;
    switch (type) {
        case "playlist":
            var musics = await spotifyApi.getPlaylist(musicID);
            tracks = musics.body.tracks.items;
            async function checkAll() {
                if (musics.body.tracks.next) {
                    var offset = musics.body.tracks.offset + 50;
                    musics = await spotifyApi.getPlaylist(musicID, <any>{ limit: 50, offset: offset });
                    tracks = tracks.concat(musics.body.tracks.items);
                    return await checkAll();
                }
            }
            await checkAll();
            var mesg = await msgOrRes(message, `Processing track: **0/${tracks.length}**`);
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
                    var offset = data.body.offset + 50;
                    data = await spotifyApi.getAlbumTracks(musicID, { limit: 50, offset: offset });
                    tracks = tracks.concat(data.body.items);
                    return await checkAll();
                }
                await checkAll();
            } else {
                const data = await spotifyApi.getTracks([musicID]);
                tracks = data.body.tracks;
            }
            var mesg = await msgOrRes(message, `Processing track: **0/${tracks.length}**`);
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
                        const songLength = !results[o].live ? results[o].duration : "∞";
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
                        const songLength = !resultss[o].live ? resultss[o].duration : "∞";
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
    const res = await fetch(`https://api.soundcloud.com/resolve?url=${link}&client_id=${process.env.SCID}`);
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
    var dl;
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
    var f = await fetch(dl);
    if (!f.ok) return { error: true, message: `Received HTTP Status: ${f.status}`, msg: null, songs: [] };
    const matches = decodeHtmlEntity(await f.text()).match(/<a id="uc-download-link" class="goog-inline-block jfk-button jfk-button-action" href="(?<link>[\/\w&\?=]+)">/);
    if (matches?.groups?.link) {
        dl = "https://drive.google.com" + matches.groups.link;
        f = await fetch(dl);
        if (!f.ok) return { error: true, message: `Received HTTP Status: ${f.status}`, msg: null, songs: [] };
    }
    const stream = <Stream.Readable>f.body;
    var title = "No Title";
    try {
        var metadata = await mm.parseStream(stream, {}, { duration: true });
        console.log(metadata);
        const html = await fetch(link).then(res => res.text());
        const $ = cheerio.load(html);
        title = metadata.common.title ? metadata.common.title : $("title").text().split(" - ").slice(0, -1).join(" - ").split(".").slice(0, -1).join(".");
    } catch (err: any) {
        return { error: true, message: "An error occured while parsing the audio file into stream! Maybe it is not link to the file?", msg: null, songs: [] };
    }
    if (!metadata) return { error: true, message: "An error occured while parsing the audio file into stream! Maybe it is not link to the file?", msg: null, songs: [] };
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
        var i = 0;
        for (const el of elements.toArray()) {
            const id = (<any>el).attribs["data-id"];
            const link = "https://drive.google.com/uc?export=download&id=" + id;
            ++i;
            cb(i, elements.length);
            var title = "No Title";
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

export async function addMSURL(link: string) {
    try {
        var data = await muse(link);
    } catch (err: any) {
        return { error: true, message: "Failed to fetch metadata of the score!", msg: null, songs: [] };
    }
    const song = {
        title: data.title,
        url: link,
        type: 5,
        time: humanDurationToNum(data.duration),
        volume: 1,
        thumbnail: "https://pbs.twimg.com/profile_images/1155047958326517761/IUgssah__400x400.jpg",
        isLive: false
    };
    return { error: false, songs: [song], msg: null, message: null };
}

export async function addURL(link: string) {
    var title = link.split("/").slice(-1)[0].split(".").slice(0, -1).join(".").replace(/_/g, " ");
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
        thumbnail: "https://www.flaticon.com/svg/static/icons/svg/2305/2305904.svg",
        isLive: false
    };
    return { error: false, songs: [song], msg: null, message: null };
}
export async function search(message: Message | Discord.CommandInteraction, link: string) {
    const allEmbeds = [];
    const Embed = new Discord.MessageEmbed()
        .setTitle(`Search result of ${link} on YouTube`)
        .setColor(color())
        .setTimestamp()
        .setFooter("Please do so within 60 seconds.", message.client.user.displayAvatarURL());
    const results = [];
    try {
        const searched = await ytsr(link, { limit: 20 });
        var video = <Video[]>searched.items.filter(x => x.type === "video" && !x.isUpcoming);
    } catch (err: any) {
        console.error(err);
        await msgOrRes(message, "There was an error trying to search the videos!");
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
    var num = 0;
    if (ytResults.length > 0) {
        results.push(ytResults);
        Embed.setDescription("Type **soundcloud** / **sc** to show the search results from SoundCloud.\nType the index of the soundtrack to select, or type anything else to cancel.\n\n" + ytResults.map(x => `${++num} - **[${x.title}](${x.url})** : **${!x.time ? "∞" : moment.duration(x.time, "seconds").format()}**`).slice(0, 10).join("\n"));
        allEmbeds.push(Embed);
    }
    const scEm = new Discord.MessageEmbed()
        .setTitle(`Search result of ${link} on SoundCloud`)
        .setColor(color())
        .setTimestamp()
        .setFooter("Please do so within 60 seconds.", message.client.user.displayAvatarURL());
    try {
        var scSearched = await scdl.search({
            limit: 20,
            query: link,
            resourceType: "tracks"
        });
        num = 0;
    } catch (err: any) {
        console.error(err);
        await msgOrRes(message, "There was an error trying to search the videos!");
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
        results.push(scResults);
        scEm.setDescription("Type **youtube** / **yt** to show the search results from Youtube.\nType the index of the soundtrack to select, or type anything else to cancel.\n\n" + scResults.map(x => `${++num} - **[${x.title}](${x.url})** : **${!x.time ? "∞" : moment.duration(x.time, "seconds").format()}**`).slice(0, 10).join("\n"));
        allEmbeds.push(scEm);
    }
    if (allEmbeds.length < 1) {
        await msgOrRes(message, "Cannot find any result with the given string.");
        return { error: true, msg: null, songs: [], message: null };
    }
    var val = { error: true, songs: [], msg: null, message: null };
    var s = 0;
    var msg = <Message>await msgOrRes(message, allEmbeds[0]);
    const filter = x => x.author.id === (message instanceof Message ? message.author : message.user).id;
    const collector = await msg.channel.createMessageCollector({ filter, idle: 60000 });
    collector.on("collect", async collected => {
        collected.delete().catch(() => { });
        if (isNaN(parseInt(collected.content))) {
            switch (collected.content) {
                case "youtube":
                case "yt":
                    s = 0;
                    await msg.edit({ embeds: [allEmbeds[s]] });
                    break;
                case "soundcloud":
                case "sc":
                    s = 1;
                    await msg.edit({ embeds: [allEmbeds[s]] });
                    break;
                default:
                    collector.emit("end");
            }
        } else {
            const o = parseInt(collected.content) - 1;
            if (o < 0 || o > results[s].length - 1) {
                collector.emit("end");
                return;
            }
            const length = !results[s][o].time ? "∞" : moment.duration(results[s][o].time, "seconds").format()
            const chosenEmbed = new Discord.MessageEmbed()
                .setColor(color())
                .setTitle("Music chosen:")
                .setThumbnail(results[s][o].thumbnail)
                .setDescription(`**[${decodeHtmlEntity(results[s][o].title)}](${results[s][o].url})** : **${length}**`)
                .setTimestamp()
                .setFooter("Have a nice day :)", message.client.user.displayAvatarURL());
            await msg.edit({ embeds: [chosenEmbed] });
            val = { error: false, songs: [results[s][o]], msg, message: null };
            collector.emit("end");
        }
    });
    return new Promise<{ error: boolean, songs: any[], msg: Message, message: any }>(resolve => {
        collector.on("end", async () => {
            if (val.error && !msg.deleted) {
                const cancelled = new Discord.MessageEmbed()
                    .setColor(color())
                    .setTitle("Action cancelled.")
                    .setTimestamp()
                    .setFooter("Have a nice day! :)", message.client.user.displayAvatarURL());
                await msg.edit({ embeds: [cancelled] }).then(msg => setTimeout(() => msg.edit({ content: "**[Added Track: No track added]**" }).catch(() => { }), 30000));
            }
            resolve(val);
        });
    });
}

export async function getStream(track: SoundTrack, data: any) {
    if (!track.id) track.id = crypto.createHash("md5").update(`${track.title};${track.url}`).digest("hex");
    var stream: Stream.Readable;
    var cacheFound = true;
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
              const options = <any> { highWaterMark: 1 << 22, filter: "audioonly", dlChunkSize: 0 };
              if (process.env.COOKIE) {
                options.requestOptions = {};
                options.requestOptions.headers = { cookie: process.env.COOKIE };
                if (process.env.YT_TOKEN) options.requestOptions.headers["x-youtube-identity-token"] = process.env.YT_TOKEN;
              }
              stream = <Stream.Readable> ytdl(`https://www.youtube.com/watch?v=${ytid}`, options);
              cacheFound = true;
            } else stream = <Stream.Readable> (await requestStream(c.url)).data;
            break;
          default:
            const options = <any> {};
            if (process.env.COOKIE) {
              options.requestOptions = {};
              options.requestOptions.headers = { cookie: process.env.COOKIE };
              if (process.env.YT_TOKEN) options.requestOptions.headers["x-youtube-identity-token"] = process.env.YT_TOKEN;
            }
            if (!track?.isPastLive) Object.assign(options, { filter: "audioonly", dlChunkSize: 0, highWaterMark: 1 << 22 });
            else Object.assign(options, { highWaterMark: 1 << 22 });
            if (!track.url) throw new Error("This soundtrack is missing URL! Please remove and add this track again to make it function.");
            stream = ytdl(track.url, options);
            if (!stream) throw new Error("Failed to get YouTube video stream.");
            cacheFound = true;
            break;
        }
    }
    if (!cacheFound) stream = await cacheTrack(track.id, stream);
    return stream;
}