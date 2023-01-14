import { AudioPlayer, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus, getVoiceConnection } from "@discordjs/voice";
import { Snowflake } from "discord.js";
import Ffmpeg from "fluent-ffmpeg";
import * as Stream from "stream";
import { SoundTrack } from "./index.js";
import { probeAndCreateResource } from "../commands/music/play.js";
import { query } from "../function.js";
import { getStream } from "../helpers/addTrack.js";
import { addUsing, removeUsing } from "../helpers/music.js";

class RadioSoundTrack extends SoundTrack {
	looped?: number;
}

export class RadioChannel {
	id: number;
	player: AudioPlayer;
	tracks: RadioSoundTrack[];
	guilds: Set<Snowflake> = new Set();
	seek: number;
	startTime?: number;
	private interval: NodeJS.Timer;

	constructor(id: number, tracks: RadioSoundTrack[], seek: number, guilds: Snowflake[]) {
		this.id = id;
		this.tracks = tracks;
		this.seek = seek;
		this.guilds = new Set(guilds);
		this.player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Pause
			}
		}).on(AudioPlayerStatus.Playing, async () => {
			this.interval = setInterval(() => {
				this.seek = this.player.state.status == AudioPlayerStatus.Playing ? Math.floor(this.player.state.playbackDuration / 1000) : 0;
				this.updateSeek();
			}, 30000);
		}).on(AudioPlayerStatus.Idle, () => {
			this.next();
		}).on("error", () => {
			this.next();
		});
		for (const guild of guilds) {
			const connection = getVoiceConnection(guild);
			if (!connection) continue;
			connection.subscribe(this.player);
		}
		this.start();
	}

	async start() {
		if (this.tracks[0]) {
			const stream = await getStream(this.tracks[0], { type: "radio", tracks: this.tracks });
			if (this.seek) {
				console.log(`Fast-forwarding radio channel #${this.id} to where we left off (${this.seek}s)`)
				const command = Ffmpeg(stream);
				const passthru = new Stream.PassThrough({ highWaterMark: 1 << 19 });
				command.on("error", err => console.error(err.message)).seekInput(this.seek).format("wav").output(passthru, { end: true }).run();
				this.player.play(await probeAndCreateResource(passthru));
			} else this.player.play(await probeAndCreateResource(stream));
  		const streamTime = this.getPlaybackDuration();
			if (streamTime) this.startTime = streamTime - this.seek * 1000;
			else this.startTime = -this.seek * 1000;
			addUsing(this.tracks[0].id);
		}
	}

	async add(tracks: RadioSoundTrack[]) {
		this.tracks.push(...tracks);
		this.update();
		if (this.player.state.status == AudioPlayerStatus.Idle) await this.start();
	}

	async update() {
		try {
			await query(`UPDATE radio SET queue = "${escape(JSON.stringify(this.tracks))}" WHERE id = ${this.id}`);
		} catch (err) { }
	}

	async updateSeek() {
		try {
			await query(`UPDATE radio SET seek = "${this.seek || 0}" WHERE id = ${this.id}`);
		} catch (err) { }
	}
	async next() {
		clearInterval(this.interval);
		this.seek = 0;
		const finished = this.tracks.shift();
		if (!finished.looped) finished.looped = 1;
		else finished.looped++;
		if (finished.looped <= 10 || this.tracks.length <= 10) this.tracks.push(finished);
		else removeUsing(finished.id, true);
		this.update();
		this.updateSeek();
		await this.start();
	}

	getPlaybackDuration() {
		if (this.player?.state?.status != AudioPlayerStatus.Playing) return 0;
		return this.player.state.playbackDuration;
	}
}