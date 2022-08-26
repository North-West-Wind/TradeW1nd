import { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from "@discordjs/voice";
import * as Discord from "discord.js";
import * as Stream from 'stream';
import * as fs from "fs";
import { GatewayVoiceServerUpdateDispatchData, GatewayVoiceStateUpdateDispatchData } from "discord-api-types/v9";
import { ServerQueue, SoundTrack } from "../classes/NorthClient.js";
import { humanDurationToNum, query } from "../function.js";
const queue = new Discord.Collection<Discord.Snowflake, ServerQueue>();
const using: { [key: string]: number } = {};

export function getQueue(id: Discord.Snowflake) {
	return queue.get(id);
}
export async function updateQueue(id: Discord.Snowflake, serverQueue: ServerQueue, update: boolean = true) {
	if (!serverQueue) queue.delete(id);
	else queue.set(id, serverQueue);
	if (!update) return;
	try {
		await query(`UPDATE servers SET looping = ${serverQueue?.looping ? 1 : "NULL"}, repeating = ${serverQueue?.repeating ? 1 : "NULL"}, random = ${serverQueue?.random ? 1 : "NULL"}, queue = ${!serverQueue?.songs?.length || !Array.isArray(serverQueue.songs) ? "NULL" : `'${escape(JSON.stringify(serverQueue.songs))}'`} WHERE id = '${id}'`);
	} catch (err: any) {
		console.error(err);
	}
}
export function stop(guild: Discord.Guild) {
	const serverQueue = queue.get(guild.id);
	if (!serverQueue) return;
	serverQueue.destroy();
	serverQueue.playing = false;
	serverQueue.connection = null;
	serverQueue.voiceChannel = null;
	serverQueue.textChannel = null;
	serverQueue.clean();
}
export function setQueue(guild: Discord.Snowflake, tracks: SoundTrack[], loopStatus: boolean, repeatStatus: boolean) {
	tracks = tracks.filter(track => !!track).map(track => {
		if (typeof track.time === "string") track.time = track.time === "∞" ? 0 : humanDurationToNum(track.time);
		return track;
	})
	const queueContruct = new ServerQueue(tracks, loopStatus, repeatStatus);
	queue.set(guild, queueContruct);
	return queueContruct;
}
export function checkQueue() {
	return queue.size > 0;
}
export function findCache(hashed: string) {
	const filePath = `${process.env.CACHE_DIR}/${hashed}`;
	if (!fs.existsSync(filePath)) return null;
	return fs.createReadStream(filePath, { highWaterMark: 1 << 25 });
}
export async function cacheTrack(hashed: string, stream: Stream.Readable, noReturn: boolean = false) {
	const filePath = `${process.env.CACHE_DIR}/${hashed}`;
	if (!fs.existsSync(filePath)) await new Promise((res) => stream.pipe(fs.createWriteStream(filePath)).on("close", res));
	if (!noReturn) return fs.createReadStream(filePath, { highWaterMark: 1 << 25 });
}
export function isUsing(hashed: string) {
	return !!using[hashed];
}
export function addUsing(hashed: string) {
	if (hashed) using[hashed]++;
}
export function removeUsing(hashed: string, all: boolean = false) {
	if (!hashed || !using[hashed]) return;
	if (all || !(using[hashed] -= 1))
		setTimeout(() => {
			const filePath = `${process.env.CACHE_DIR}/${hashed}`;
			delete using[hashed];
			if (isUsing(hashed)) waitHalfMin(hashed);
			else if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
		}, 3600000);
}
function waitHalfMin(hashed: string) {
	if (isUsing(hashed)) setTimeout(() => waitHalfMin(hashed), 30000);
	else {
		const filePath = `${process.env.CACHE_DIR}/${hashed}`
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
	}
}

// Copied from discord.js example: https://github.com/discordjs/voice/tree/main/examples/basic

const adapters = new Map<Discord.Snowflake, DiscordGatewayAdapterLibraryMethods>();
const trackedClients = new Set<Discord.Client>();

/**
 * Tracks a Discord.js client, listening to VOICE_SERVER_UPDATE and VOICE_STATE_UPDATE events.
 * @param client - The Discord.js Client to track
 */
function trackClient(client: Discord.Client) {
	if (trackedClients.has(client)) return;
	trackedClients.add(client);
	client.ws.on(Discord.GatewayDispatchEvents.VoiceServerUpdate, (payload: GatewayVoiceServerUpdateDispatchData) => {
		adapters.get(payload.guild_id)?.onVoiceServerUpdate(payload);
	});
	client.ws.on(Discord.GatewayDispatchEvents.VoiceStateUpdate, (payload: GatewayVoiceStateUpdateDispatchData) => {
		if (payload.guild_id && payload.session_id && payload.user_id === client.user?.id) {
			adapters.get(payload.guild_id)?.onVoiceStateUpdate(<any>payload);
		}
	});
	client.on(Discord.Events.ShardDisconnect, (_, shardID) => {
		const guilds = trackedShards.get(shardID);
		if (guilds) {
			for (const guildID of guilds.values()) {
				adapters.get(guildID)?.destroy();
			}
		}
		trackedShards.delete(shardID);
	});
}

const trackedShards = new Map<number, Set<Discord.Snowflake>>();

function trackGuild(guild: Discord.Guild) {
	let guilds = trackedShards.get(guild.shardId);
	if (!guilds) {
		guilds = new Set();
		trackedShards.set(guild.shardId, guilds);
	}
	guilds.add(guild.id);
}

/**
 * Creates an adapter for a Voice Channel
 * @param channel - The channel to create the adapter for
 */
export function createDiscordJSAdapter(channel: Discord.VoiceChannel): DiscordGatewayAdapterCreator {
	return (methods) => {
		adapters.set(channel.guild.id, methods);
		trackClient(channel.client);
		trackGuild(channel.guild);
		return {
			sendPayload(data) {
				if (channel.guild.shard.status === Discord.Status.Ready) {
					channel.guild.shard.send(data);
					return true;
				}
				return false;
			},
			destroy() {
				return adapters.delete(channel.guild.id);
			},
		};
	};
}