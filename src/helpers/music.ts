import { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from "@discordjs/voice";
import * as Discord from "discord.js";
import { GatewayVoiceServerUpdateDispatchData, GatewayVoiceStateUpdateDispatchData } from "discord-api-types/v9";
import { ServerQueue, SoundTrack } from "../classes/NorthClient";
import { globalClient as client } from "../common";
import { humanDurationToNum } from "../function";
const queue = new Discord.Collection<Discord.Snowflake, ServerQueue>();

export function getQueues() { return queue; }
export function getQueue(id: Discord.Snowflake) {
    return queue.get(id);
}
export async function updateQueue(id: Discord.Snowflake, serverQueue: ServerQueue, update: boolean = true) {
    if (!serverQueue) queue.delete(id);
    else queue.set(id, serverQueue);
    if (!update) return;
    try {
        await client.pool.query(`UPDATE servers SET looping = ${serverQueue?.looping ? 1 : "NULL"}, repeating = ${serverQueue?.repeating ? 1 : "NULL"}, random = ${serverQueue?.random ? 1 : "NULL"}, queue = ${!serverQueue?.songs?.length || !Array.isArray(serverQueue.songs) ? "NULL" : `'${escape(JSON.stringify(serverQueue.songs))}'`} WHERE id = '${id}'`);
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
}
export function setQueue(guild: Discord.Snowflake, tracks: SoundTrack[], loopStatus: boolean, repeatStatus: boolean) {
	tracks = tracks.map(track => {
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
	client.ws.on(Discord.Constants.WSEvents.VOICE_SERVER_UPDATE, (payload: GatewayVoiceServerUpdateDispatchData) => {
		adapters.get(payload.guild_id)?.onVoiceServerUpdate(payload);
	});
	client.ws.on(Discord.Constants.WSEvents.VOICE_STATE_UPDATE, (payload: GatewayVoiceStateUpdateDispatchData) => {
		if (payload.guild_id && payload.session_id && payload.user_id === client.user?.id) {
			adapters.get(payload.guild_id)?.onVoiceStateUpdate(<any> payload);
		}
	});
	client.on(Discord.Constants.Events.SHARD_DISCONNECT, (_, shardID) => {
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
				if (channel.guild.shard.status === Discord.Constants.Status.READY) {
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