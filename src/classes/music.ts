import { VoiceConnection, AudioPlayer, AudioResource, AudioPlayerStatus } from "@discordjs/voice";
import { TextChannel, VoiceChannel, Snowflake } from "discord.js";
import { removeUsing } from "../helpers/music.js";

export class ServerQueue {
	constructor(songs: SoundTrack[], loopStatus: boolean, repeatStatus: boolean) {
			this.textChannel = null;
			this.voiceChannel = null;
			this.connection = null;
			this.player = null;
			this.songs = songs;
			this.volume = 1;
			this.playing = false;
			this.paused = false;
			this.looping = loopStatus;
			this.repeating = repeatStatus;
			this.random = false;
			this.callers = new Set();
			this.callRoles = new Set();
	}

	textChannel: TextChannel;
	voiceChannel: VoiceChannel;
	connection: VoiceConnection;
	player: AudioPlayer;
	resource?: AudioResource;
	songs: SoundTrack[];
	volume: number;
	playing: boolean;
	paused: boolean;
	looping: boolean;
	repeating: boolean;
	random: boolean;
	startTime?: number;
	errorCounter?: number;
	isSkipping?: boolean;
	seek?: number;
	callers: Set<Snowflake>;
	callRoles: Set<Snowflake>;

	getPlaybackDuration() {
			if (this.player?.state?.status != AudioPlayerStatus.Playing) return 0;
			return this.player.state.playbackDuration;
	}

	destroy() {
			try {
					this.player?.stop();
					this.connection?.destroy();
					removeUsing(this.songs[0].id);
			} catch (err: any) { }
			this.player = null;
			this.connection = null;
	}

	stop() {
			try {
					this.player?.stop();
			} catch (err: any) { }
			this.player = null;
	}

	clean() {
			this.callers.clear();
			this.callRoles.clear();
	}
}

export class SoundTrack {
    id?: string;
    title: string;
    url: string;
    type: number;
    time: number;
    volume: number;
    thumbnail: string;
    isLive: boolean;
    isPastLive?: boolean;
    spot?: string;
}