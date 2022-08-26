import { GuildConfig, NorthClient } from "./classes/NorthClient.js";
import * as Discord from "discord.js";
import superms from "ms";
import * as fs from "fs";
import * as path from "path";
import moment from "moment";
import { Readable } from "stream";
import ytdl, { downloadOptions } from "ytdl-core";
import { setQueue } from "./helpers/music.js";
import fetch from "node-fetch";
import { getClients } from "./main.js";
import { ButtonStyle, MessageActionRowComponentBuilder } from "discord.js";

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

export function shuffleArray(array: any[], start = 0) {
    const temp = array.splice(0, start);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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
        const mses = [];
        let temp = "";
        const last = "";
        for (let i = 0; i < val.length; i++) {
            const char = val.substr(i, 1);
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
    const aProps = Object.getOwnPropertyNames(a);
    const bProps = Object.getOwnPropertyNames(b);
    if (aProps.length != bProps.length) return false;
    for (let i = 0; i < aProps.length; i++) {
        const propName = aProps[i];
        if (a[propName] !== b[propName]) return false;
    }
    return true;
}
export async function createEmbedScrolling(message: Discord.Message | Discord.ChatInputCommandInteraction | { interaction: Discord.ChatInputCommandInteraction, useEdit: boolean }, allEmbeds: Discord.EmbedBuilder[], post?: Function) {
    let author: Discord.Snowflake;
    if (message instanceof Discord.Message) author = message.author.id;
    else if (message instanceof Discord.ChatInputCommandInteraction) author = message.user.id;
    else author = message.interaction.user.id;
    const filter = (interaction: Discord.Interaction) => (interaction.user.id === author);
    let s = 0;
    const row = new Discord.ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new Discord.ButtonBuilder({ label: "<< First", style: ButtonStyle.Secondary, customId: "first" }),
        new Discord.ButtonBuilder({ label: "< Previous", style: ButtonStyle.Primary, customId: "previous" }),
        new Discord.ButtonBuilder({ label: "Next >", style: ButtonStyle.Primary, customId: "next" }),
        new Discord.ButtonBuilder({ label: "Last >>", style: ButtonStyle.Secondary, customId: "last" }),
        new Discord.ButtonBuilder({ label: "Stop", style: ButtonStyle.Danger, customId: "stop", emoji: "✖️" })
    );
    let msg: Discord.Message;
    if (message instanceof Discord.Message) msg = await message.channel.send({ embeds: [allEmbeds[0]], components: [row] });
    else if (message instanceof Discord.ChatInputCommandInteraction) msg = <Discord.Message> await message.reply({ embeds: [allEmbeds[0]], components: [row], fetchReply: true });
    else {
        if (message.useEdit) msg = <Discord.Message> await message.interaction.editReply({ embeds: [allEmbeds[0]], components: [row] });
        else msg = <Discord.Message> await message.interaction.reply({ embeds: [allEmbeds[0]], components: [row], fetchReply: true });
    }
    const collector = msg.createMessageComponentCollector({ filter, idle: 60000 });
    collector.on("collect", async (interaction) => {
        if (!interaction.isButton()) return;
        switch (interaction.customId) {
            case "first":
                s = 0;
                await interaction.update({ embeds: [allEmbeds[s]] });
                break;
            case "previous":
                s -= 1;
                if (s < 0) {
                    s = allEmbeds.length - 1;
                }
                await interaction.update({ embeds: [allEmbeds[s]] });
                break;
            case "next":
                s = (s + 1) % allEmbeds.length;
                await interaction.update({ embeds: [allEmbeds[s]] });
                break;
            case "last":
                s = allEmbeds.length - 1;
                await interaction.update({ embeds: [allEmbeds[s]] });
                break;
            case "stop":
                await interaction.update({});
                collector.emit("end");
                break;
        }
    });
    collector.on("end", async () => {
        await msg.edit({ components: [] });
        if (post) post(msg);
    });
    return { msg, collector };
}
export function genPermMsg(permissions: number, id) {
    if (id == 0) return `You need the permissions \`${new Discord.PermissionsBitField(BigInt(permissions)).toArray().join("`, `")}\` to use this command.`;
    else return `I need the permissions \`${new Discord.PermissionsBitField(BigInt(permissions)).toArray().join("`, `")}\` to run this command.`;
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
export async function msgOrRes(message: Discord.Message | Discord.ChatInputCommandInteraction, str: string | Discord.EmbedBuilder | Discord.AttachmentBuilder | { content?: string, embeds?: Discord.EmbedBuilder[], files?: Discord.AttachmentBuilder[], components?: Discord.ActionRowBuilder<MessageActionRowComponentBuilder>[] }, reply = false): Promise<Discord.Message> {
    if (message instanceof Discord.Message) {
        if (reply) {
            if (str instanceof Discord.EmbedBuilder) return await message.reply({ embeds: [str] });
            else if (str instanceof Discord.AttachmentBuilder) return await message.reply({ files: [str] });
            else return await message.reply(str);
        } else {
            if (str instanceof Discord.EmbedBuilder) return await message.channel.send({ embeds: [str] });
            else if (str instanceof Discord.AttachmentBuilder) return await message.channel.send({ files: [str] });
            else return await message.channel.send(str);
        }
    } else {
        const useEdit = message.deferred, useFollowUp = message.replied;
        if (useEdit) {
            if (str instanceof Discord.EmbedBuilder) return <Discord.Message> await message.editReply({ embeds: [str] });
            else if (str instanceof Discord.AttachmentBuilder) return <Discord.Message> await message.editReply({ files: [str] });
            else return <Discord.Message> await message.editReply(str);
        } else if (useFollowUp) {
            if (typeof str === "string") return <Discord.Message> await message.followUp({ content: str, fetchReply: true });
            else if (str instanceof Discord.EmbedBuilder) return <Discord.Message> await message.followUp({ embeds: [str], fetchReply: true });
            else if (str instanceof Discord.AttachmentBuilder) return <Discord.Message> await message.followUp({ files: [str], fetchReply: true });
            else return <Discord.Message> await message.followUp({ fetchReply: true, ...str });
        } else {
            if (typeof str === "string") return <Discord.Message> await message.reply({ content: str, fetchReply: true });
            else if (str instanceof Discord.EmbedBuilder) return <Discord.Message> await message.reply({ embeds: [str], fetchReply: true });
            else if (str instanceof Discord.AttachmentBuilder) return <Discord.Message> await message.reply({ files: [str], fetchReply: true });
            else return <Discord.Message> await message.reply({ fetchReply: true, ...str });
        }
    }
}
export function deepReaddir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    let i = 0;
    function next() {
        let file = list[i++];
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
    }
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
    const results = await query(`SELECT servers.*, configs.prefix FROM servers LEFT JOIN configs ON configs.id = servers.id WHERE servers.id = "${id}" AND configs.id = "${id}"`);
    if (results.length > 0) {
        if (results[0].queue || results[0].looping || results[0].repeating) {
            let queue = [];
            try { if (results[0].queue) queue = JSON.parse(unescape(results[0].queue)); }
            catch (err: any) { console.error(`Error parsing queue of ${results[0].id}`); }
            setQueue(results[0].id, queue, !!results[0].looping, !!results[0].repeating);
        }
        NorthClient.storage.guilds[results[0].id] = new GuildConfig(results[0]);
    } else {
        try {
            await query(`INSERT INTO configs (id, safe) VALUES ('${id}', 1)`);
            await query(`INSERT INTO servers (id), VALUES ('${id}')`);
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
    let sec = 0;
    for (let i = 0; i < splitted1.length; i++) {
        let parsed;
        if (isNaN(parsed = parseInt(splitted1[i]))) continue;
        sec += parsed * Math.pow(60, i);
    }
    return sec;
}

export async function getOwner() {
    const [client] = getClients();
	if (!client.application?.owner) await client.application?.fetch();
    return client.application?.owner.id;
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