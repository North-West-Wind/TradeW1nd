import { GuildConfig, NorthClient } from "./classes/NorthClient.js";
import { globalClient } from "./common.js";
import * as Discord from "discord.js";
import superms from "ms";
import * as fs from "fs";
import * as path from "path";
import moment from "moment";
import { Readable } from "stream";
import ytdl, { downloadOptions } from "ytdl-core";
import { setQueue } from "./helpers/music.js";
import fetch from "node-fetch";

export function twoDigits(d) {
    if (0 <= d && d < 10) return "0" + d.toString();
    if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
    return d.toString();
}

export function validURL(str: string) { return !!str.match(/^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[-a-z\d%_.~+]*)*(\?.*)?(\#[-a-z\d_]*)?$/i); }
export function validYTURL(str: string) { return !!str.match(/^(https?:\/\/)?((w){3}.)?youtu(be|.be)?(.com)?\/.+/); }
export function validYTPlaylistURL(str: string) { return !!str.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(.com)?\/playlist\?list=\w+/); }
export function validSPURL(str: string) { return !!str.match(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/); }
export function validGDURL(str: string) { return !!str.match(/^(https?)?:\/\/drive\.google\.com\/(file\/d\/(?<id>.*?)\/(?:edit|view)\?usp=sharing|open\?id=(?<id1>.*?)$)/); }
export function validGDFolderURL(str: string) { return !!str.match(/^(https?)?:\/\/drive\.google\.com\/drive\/folders\/[\w\-]+(\?usp=sharing)?$/); }
export function validGDDLURL(str: string) { return !!str.match(/^(https?)?:\/\/drive\.google\.com\/uc\?export=download&id=[\w-]+/); }
export function validSCURL(str: string) { return !!str.match(/^https?:\/\/(soundcloud\.com|snd\.sc)\/(.+)?/); }
export function validMSURL(str: string) { return !!str.match(/^(https?:\/\/)?musescore\.com\/(user\/\d+\/scores\/\d+|[\w-]+\/(scores\/\d+|[\w-]+))[#\?]?$/); }
export function validMSSetURL(str: string) { return !!str.match(/^https?:\/\/musescore.com\/user\/[\w-]+\/sets\/[\w-]+$/); }
export function decodeHtmlEntity(str: string) { return str?.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(dec)).replace(/&quot;/g, `"`).replace(/&amp;/g, `&`); }

export function shuffleArray(array: any[], start: number = 0) {
    const temp = array.splice(0, start);
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return temp.concat(array);
}
export function moveArray(array, index) {
    const a1 = array.splice(0, index);
    return array.concat(a1);
}
export function isGoodMusicVideoContent(videoSearchResultItem) {
    const contains = (string, content) => !!~(string || "").indexOf(content);
    return (contains(videoSearchResultItem.author ? videoSearchResultItem.author.name : undefined, "VEVO") || contains(videoSearchResultItem.author ? videoSearchResultItem.author.name.toLowerCase() : undefined, "official") || contains(videoSearchResultItem.title.toLowerCase(), "official") || !contains(videoSearchResultItem.title.toLowerCase(), "extended"));
}
export function ms(val: string) {
    if (typeof val === "string" && superms(val) === undefined) {
        if (val.split(":").length > 1) {
            const nums = val.split(":").reverse();
            const units = ["s", "m", "h", "d"];
            const mses = [];
            for (const num of nums) {
                const str = `${parseInt(num)}${units[nums.indexOf(num)]}`;
                const parsed = superms(str);
                if (parsed === undefined) return undefined;
                mses.push(parsed);
            }
            return mses.reduce((acc, c) => acc + c);
        }
        var mses = [];
        let temp = "";
        let last = "";
        for (let i = 0; i < val.length; i++) {
            let char = val.substr(i, 1);
            if (!/\d/.test(last) && /\d/.test(char) && i != 0) {
                if (superms(temp) === undefined) return undefined;
                mses.push(superms(temp));
                temp = "";
            }
            temp += char;
            if (val[i + 1] === undefined) mses.push(superms(temp));
        }
        return mses.reduce((acc, c) => acc + c);
    } else return superms(val);
}
export function isEquivalent(a, b) {
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);
    if (aProps.length != bProps.length) return false;
    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];
        if (a[propName] !== b[propName]) return false;
    }
    return true;
}
export async function createEmbedScrolling(message: Discord.Message | Discord.CommandInteraction | { interaction: Discord.CommandInteraction, useEdit: boolean }, allEmbeds: Discord.MessageEmbed[], id: number = 0, additionalData: any = undefined) {
    var author: Discord.Snowflake;
    if (message instanceof Discord.Message) author = message.author.id;
    else if (message instanceof Discord.Interaction) author = message.user.id;
    else author = message.interaction.user.id;
    const filter = (reaction: Discord.MessageReaction, user: Discord.User) => (["◀", "▶", "⏮", "⏭", "⏹"].includes(reaction.emoji.name) && user.id === author);
    var s = 0;
    var msg: Discord.Message;
    if (message instanceof Discord.Message) msg = await message.channel.send({ embeds: [allEmbeds[0]]});
    else if (message instanceof Discord.Interaction) msg = <Discord.Message> await message.reply({ embeds: [allEmbeds[0]], fetchReply: true });
    else {
        if (message.useEdit) msg = <Discord.Message> await message.interaction.editReply({ embeds: [allEmbeds[0]] });
        else msg = <Discord.Message> await message.interaction.reply({ embeds: [allEmbeds[0]], fetchReply: true });
    }
    await msg.react("⏮");
    await msg.react("◀");
    await msg.react("▶");
    await msg.react("⏭");
    await msg.react("⏹");
    const collector = msg.createReactionCollector({ filter, idle: 60000 });
    collector.on("collect", function (reaction, user) {
        reaction.users.remove(user.id).catch(() => {});
        switch (reaction.emoji.name) {
            case "⏮":
                s = 0;
                msg.edit({ embeds: [allEmbeds[s]] });
                break;
            case "◀":
                s -= 1;
                if (s < 0) {
                    s = allEmbeds.length - 1;
                }
                msg.edit({ embeds: [allEmbeds[s]] });
                break;
            case "▶":
                s += 1;
                if (s > allEmbeds.length - 1) {
                    s = 0;
                }
                msg.edit({ embeds: [allEmbeds[s]] });
                break;
            case "⏭":
                s = allEmbeds.length - 1;
                msg.edit({ embeds: [allEmbeds[s]] });
                break;
            case "⏹":
                collector.emit("end");
                break;
        }
    });
    collector.on("end", async () => {
        msg.reactions.removeAll().catch(() => {});
        if (id == 1) {
            await msg.edit({ content: "Loading simplier version...", embeds: [] });
            await msg.edit("https://sky.shiiyu.moe/stats/" + additionalData.res[0].name);
        } else if (id == 2) setTimeout(() => msg.edit({ embeds: [], content: `**[Lyrics of ${additionalData.title}**]` }).catch(() => {}), 10000);
        else if (id == 3) setTimeout(() => msg.edit({ embeds: [], content: `**[Queue: ${additionalData.songArray.length} tracks in total]**` }).catch(() => {}), 60000);
    });
    return { msg, collector };
}
export function genPermMsg(permissions: number, id) {
    if (id == 0) return `You need the permissions \`${new Discord.Permissions(BigInt(permissions)).toArray().join("`, `")}\` to use this command.`;
    else return `I need the permissions \`${new Discord.Permissions(BigInt(permissions)).toArray().join("`, `")}\` to run this command.`;
}
export function color() { return Math.floor(Math.random() * 16777214) + 1; }
export async function requestStream(url) {
    const fetched = await fetch(url);
    return { data: fetched.body, status: fetched.status };
}
export function capitalize(s) { return (typeof s !== 'string') ? '' : s.charAt(0).toUpperCase() + s.slice(1); }
export function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
export function bufferToStream(buf, chunkSize = undefined) {
    if (typeof buf === 'string') buf = Buffer.from(buf, 'utf8');
    if (!Buffer.isBuffer(buf)) throw new TypeError(`"buf" argument must be a string or an instance of Buffer`);
    const reader = new Readable();
    const hwm = reader.readableHighWaterMark;
    if (!chunkSize || typeof chunkSize !== 'number' || chunkSize < 1 || chunkSize > hwm) chunkSize = hwm;
    const len = buf.length;
    let start = 0;
    reader._read = () => {
        while (reader.push(buf.slice(start, (start += chunkSize)))) if (start >= len) {
            reader.push(null);
            break;
        }
    }
    return reader;
}
export function duration(seconds: number, type: moment.unitOfTime.DurationConstructor = "seconds") {
    const duration = moment.duration(seconds, type);
    const str = [];
    if (duration.hours()) str.push(twoDigits(duration.hours()) + ":");
    str.push(twoDigits(duration.minutes()) + ":");
    str.push(twoDigits(duration.seconds()));
    return str.join("");
}
export async function msgOrRes(message: Discord.Message | Discord.CommandInteraction, str: string | Discord.MessageEmbed | Discord.MessageAttachment | { content?: string, embeds?: Discord.MessageEmbed[], files?: Discord.MessageAttachment[], components?: Discord.MessageActionRow[] }, reply: boolean = false): Promise<Discord.Message> {
    if (message instanceof Discord.Message) {
        if (reply) {
            if (str instanceof Discord.MessageEmbed) return await message.reply({ embeds: [str] });
            else if (str instanceof Discord.MessageAttachment) return await message.reply({ files: [str] });
            else return await message.reply(str);
        } else {
            if (str instanceof Discord.MessageEmbed) return await message.channel.send({ embeds: [str] });
            else if (str instanceof Discord.MessageAttachment) return await message.channel.send({ files: [str] });
            else return await message.channel.send(str);
        }
    } else {
        const useEdit = message.deferred, useFollowUp = message.replied;
        if (useEdit) {
            if (str instanceof Discord.MessageEmbed) return <Discord.Message> await message.editReply({ embeds: [str] });
            else if (str instanceof Discord.MessageAttachment) return <Discord.Message> await message.editReply({ files: [str] });
            else return <Discord.Message> await message.editReply(str);
        } else if (useFollowUp) {
            if (typeof str === "string") return <Discord.Message> await message.followUp({ content: str, fetchReply: true });
            else if (str instanceof Discord.MessageEmbed) return <Discord.Message> await message.followUp({ embeds: [str], fetchReply: true });
            else if (str instanceof Discord.MessageAttachment) return <Discord.Message> await message.followUp({ files: [str], fetchReply: true });
            else return <Discord.Message> await message.followUp({ fetchReply: true, ...str });
        } else {
            if (typeof str === "string") return <Discord.Message> await message.reply({ content: str, fetchReply: true });
            else if (str instanceof Discord.MessageEmbed) return <Discord.Message> await message.reply({ embeds: [str], fetchReply: true });
            else if (str instanceof Discord.MessageAttachment) return <Discord.Message> await message.reply({ files: [str], fetchReply: true });
            else return <Discord.Message> await message.reply({ fetchReply: true, ...str });
        }
    }
}
export function deepReaddir(dir) {
    var results = [];
    const list = fs.readdirSync(dir);
    var i = 0;
    function next() {
        var file = list[i++];
        if (!file) return results;
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            const res = deepReaddir(file);
            results = results.concat(res);
            return next();
        } else {
            results.push(file);
            return next();
        }
    };
    return next();
}

export function mutate(array: any[], fromIndex: number, toIndex: number) {
	const startIndex = fromIndex < 0 ? array.length + fromIndex : fromIndex;

	if (startIndex >= 0 && startIndex < array.length) {
		const endIndex = toIndex < 0 ? array.length + toIndex : toIndex;

		const [item] = array.splice(fromIndex, 1);
		array.splice(endIndex, 0, item);
	}
}

export function requestYTDLStream(url: string, opts: downloadOptions & { timeout?: number }) {
    const timeoutMS = opts.timeout || 120000;
    const getStream = new Promise(async(resolve, reject) => {
        const options = <any> opts;
        if (process.env.COOKIE) {
          options.requestOptions = {};
          options.requestOptions.headers = { cookie: process.env.COOKIE };
          if (process.env.YT_TOKEN) options.requestOptions.headers["x-youtube-identity-token"] = process.env.YT_TOKEN;
        }
        const stream = await ytdl(url, options);
        stream.on("finish", () => resolve(stream)).on("error", err => reject(err));
    });
    return Promise.race([wait(timeoutMS), getStream]);
}

export async function fixGuildRecord(id: Discord.Snowflake) {
    if (NorthClient.storage.guilds[id]) return NorthClient.storage.guilds[id];
    const results = await query("SELECT id FROM servers WHERE id = " + id);
    if (results.length > 0) {
        if (results[0].queue || results[0].looping || results[0].repeating) {
            var queue = [];
            try { if (results[0].queue) queue = JSON.parse(unescape(results[0].queue)); }
            catch (err: any) { console.error(`Error parsing queue of ${results[0].id}`); }
            setQueue(results[0].id, queue, !!results[0].looping, !!results[0].repeating);
        }
        NorthClient.storage.guilds[results[0].id] = new GuildConfig(results[0]);
    } else {
        try {
            await query(`INSERT INTO servers (id, autorole, giveaway, safe) VALUES ('${id}', '[]', '${escape("🎉")}', 1)`);
            NorthClient.storage.guilds[id] = new GuildConfig();
        } catch (err: any) { }
    }
    return NorthClient.storage.guilds[id];
}

export function messagePrefix(message: Discord.Message, client: NorthClient): string {
    return NorthClient.storage.guilds[message.guildId]?.prefix || client.prefix;
}

export function humanDurationToNum(duration: string) {
    const splitted = duration.split(".");
    const rest = splitted[0];
    const splitted1 = rest.split(":").reverse();
    var sec = 0;
    for (let i = 0; i < splitted1.length; i++) {
        let parsed;
        if (isNaN(parsed = parseInt(splitted1[i]))) continue;
        sec += parsed * Math.pow(60, i);
    }
    return sec;
}

export async function getOwner() {
	if (!globalClient.application?.owner) await globalClient.application?.fetch();
    return globalClient.application?.owner.id;
}

export async function query(query: string) {
    const res = await fetch("http://192.168.1.29:4269/api/query", { method: "post", body: JSON.stringify({ token: process.env.DB_TOKEN, query }), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    else return <any> await res.json();
}

export async function checkN0rthWestW1nd(guild: Discord.Snowflake) {
    const res = await fetch("http://192.168.1.29:3001/checkGuild/" + guild);
    return res.ok && (<any> await res.json()).isIn;
}