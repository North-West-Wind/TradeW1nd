import * as Discord from "discord.js";
import { validURL, validYTURL, validSPURL, validGDURL, validGDFolderURL, validYTPlaylistURL, validSCURL, validMSURL, moveArray, color, validGDDLURL, wait, duration, validMSSetURL } from "../../function.js";
import { migrate as music } from "./migrate.js";
import { NorthClient, SoundTrack, SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, updateQueue, setQueue, createDiscordJSAdapter, addUsing, removeUsing } from "../../helpers/music.js";
import { addYTPlaylist, addYTURL, addSPURL, addSCURL, addGDFolderURL, addGDURL, addMSURL, addURL, addAttachment, search, getStream, addMSSetURL } from "../../helpers/addTrack.js";
import * as Stream from 'stream';
import { AudioPlayerError, AudioPlayerStatus, createAudioPlayer, createAudioResource, demuxProbe, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, VoiceConnectionStatus } from "@discordjs/voice";
import Ffmpeg from "fluent-ffmpeg";
import { getClients } from "../../main.js";

function createPlayer(guild: Discord.Guild) {
  let serverQueue = getQueue(guild.id);
  if (!serverQueue.player) {
    serverQueue.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    updateQueue(guild.id, serverQueue, false);
  }
  let track: SoundTrack;
  let needResource = true, needSetVolume = true;
  async function next() {
    let randomized = false;
    if (!serverQueue.isSkipping) {
      if (serverQueue.looping) serverQueue.songs.push(track);
      if (!serverQueue.repeating) serverQueue.songs.shift();
      randomized = serverQueue.random;
    } else serverQueue.isSkipping = false;
    updateQueue(guild.id, serverQueue);
    needResource = true;
    needSetVolume = true;
    if (!randomized) await play(guild, serverQueue.songs[0]);
    else {
      const int = Math.floor(Math.random() * serverQueue.songs.length);
      const pending = serverQueue.songs[int];
      serverQueue.songs = moveArray(serverQueue.songs, int);
      updateQueue(guild.id, serverQueue);
      await play(guild, pending);
    }
  }
  return serverQueue.player.on(AudioPlayerStatus.Playing, async (_oldState, newState) => {
    track = serverQueue.songs[0];
    addUsing(track.id);
    if (needResource) {
      serverQueue.resource = newState.resource;
      needResource = !!serverQueue.resource;
    }
    if (needSetVolume) {
      const volume = serverQueue.resource?.volume;
      if (volume) {
        volume.setVolumeLogarithmic(track?.volume ? serverQueue.volume * track.volume : serverQueue.volume);
        needSetVolume = false;
      }
    }
    if (serverQueue.errorCounter) serverQueue.errorCounter--;
    updateQueue(guild.id, serverQueue, false);
  }).on(AudioPlayerStatus.Idle, async () => {
    removeUsing(track?.id);
    serverQueue = getQueue(guild.id);
    await next();
  }).on("error", async error => {
    console.error(error.message);
    if (serverQueue) {
      removeUsing(track?.id);
      serverQueue.textChannel?.send("There was an error trying to play the soundtrack!").then(msg => setTimeout(() => msg.delete().catch(() => { }), 10000));
      if (!serverQueue.errorCounter) serverQueue.errorCounter = 1;
      else serverQueue.errorCounter = 3;
      if (serverQueue.errorCounter >= 3) serverQueue?.destroy();
      else await next();
    }
  });
}

export async function probeAndCreateResource(readableStream: Stream.Readable) {
  const { stream, type } = await demuxProbe(readableStream);
  return createAudioResource(stream, { inputType: type, inlineVolume: true });
}

export function createEmbed(songs: SoundTrack[]) {
  const songLength = songs[0].time == 0 ? "∞" : duration(songs[0].time, "seconds");
  const Embed = new Discord.EmbedBuilder()
    .setColor(color())
    .setTitle("New track added:")
    .setThumbnail(songs[0].thumbnail)
    .setDescription(`**[${songs[0].title}](${songs[0].url})**\nLength: **${songLength}**`)
    .setTimestamp()
    .setFooter({ text: "Have a nice day! :)", iconURL: getClients()[0].user.displayAvatarURL() });
  if (songs.length > 1) Embed.setDescription(`**${songs.length}** tracks were added.`).setThumbnail(undefined);
  return Embed;
}

export async function play(guild: Discord.Guild, song: SoundTrack) {
  const serverQueue = getQueue(guild.id);
  if (!serverQueue.voiceChannel && guild.members.me.voice?.channel) serverQueue.voiceChannel = <Discord.VoiceChannel>guild.members.me.voice.channel;
  serverQueue.playing = true;
  if (!song && serverQueue.songs.length > 0) {
    const filtered = serverQueue.songs.filter(song => !!song);
    if (serverQueue.songs.length !== filtered.length) {
      serverQueue.songs = filtered;
      updateQueue(guild.id, serverQueue);
      if (serverQueue.songs[0]) song = serverQueue.songs[0];
    }
  }
  if (!song || !serverQueue.voiceChannel) {
    serverQueue.playing = false;
    if (guild.members.me.voice?.channel) serverQueue?.destroy();
    return updateQueue(guild.id, serverQueue);
  }
  if (!serverQueue.player) {
    serverQueue.player = createPlayer(guild);
    serverQueue.connection?.subscribe(serverQueue.player);
  }
  if (!serverQueue.connection) try {
    if (guild.members.me.voice?.channelId === serverQueue.voiceChannel.id) serverQueue.connection = getVoiceConnection(guild.id);
    else {
      serverQueue.connection = joinVoiceChannel({ channelId: serverQueue.voiceChannel.id, guildId: guild.id, adapterCreator: createDiscordJSAdapter(serverQueue.voiceChannel) })
      serverQueue.connection.subscribe(serverQueue.player);
    }
    if (!guild.members.me.voice.selfDeaf) guild.members.me.voice.setDeaf(true).catch(() => { });
  } catch (err: any) {
    serverQueue?.destroy();
    if (serverQueue?.textChannel) {
      const msg = await serverQueue.textChannel.send("An error occured while trying to connect to the channel! Disconnecting the bot...");
      await wait(30000);
      return msg.delete().catch(() => { });
    }
  }
  const streamTime = serverQueue.getPlaybackDuration();
  const seek = serverQueue.seek || 0;
  if (seek) serverQueue.seek = undefined;
  if (streamTime) serverQueue.startTime = streamTime - seek * 1000;
  else serverQueue.startTime = -seek * 1000;
  try {
    if (!song.url) {
      const index = serverQueue.songs.indexOf(song);
      if (index !== -1) {
        serverQueue.songs.splice(index, 1);
        updateQueue(guild.id, serverQueue, false);
      }
      throw new Error("This soundtrack is missing URL! It is being removed automatically.");
    }
    const stream = await getStream(song, { type: "server", guild, serverQueue });
    if (seek) {
      const command = Ffmpeg(stream);
      const passthru = new Stream.PassThrough();
      command.on("error", err => console.error(err.message)).seekInput(seek).format("wav").output(passthru, { end: true }).run();
      serverQueue.player.play(await probeAndCreateResource(passthru));
    } else serverQueue.player.play(await probeAndCreateResource(stream));
    await entersState(serverQueue.player, AudioPlayerStatus.Playing, 5e3);
  } catch (err: any) {
    console.error(err);
    serverQueue.player?.emit("error", new AudioPlayerError(err instanceof Error ? err : new Error(err), serverQueue.resource));
  }
}

class PlayCommand implements SlashCommand {
  name = "play"
  description = "Plays music with the link or keywords provided."
  aliases = ["p"]
  usage = "[link | keywords]"
  category = 0
  options = [
    {
      name: "link",
      description: "The link of the soundtrack or keywords to search for.",
      required: false,
      type: "STRING"
    },
    {
        name: "attachment",
        description: "An attachment of the audio file.",
        required: false,
        type: "ATTACHMENT"
    }
  ]

  async execute(interaction: Discord.ChatInputCommandInteraction) {
    await interaction.deferReply();
    await this.logic(interaction, interaction.options.getString("link"), interaction.options.getAttachment("attachment"));
  }

  async logic(interaction: Discord.ChatInputCommandInteraction, str: string, att: Discord.Attachment) {
    let serverQueue = getQueue(interaction.guild.id);
    const voiceChannel = <Discord.VoiceChannel>(<Discord.GuildMember>interaction.member).voice.channel;
    if (!voiceChannel) return await interaction.editReply("You need to be in a voice channel to play music!");
    if (!voiceChannel.permissionsFor(interaction.guild.members.me).has(BigInt(3145728))) return await interaction.editReply("I can't play in your voice channel!");
    if (!str && !att) {
      if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
      if (serverQueue.songs.length < 1) return await interaction.editReply("The queue is empty for this server! Please provide a link or keywords to get a music played!");
      if ((serverQueue.playing && interaction.guild.members.me.voice?.channelId) || NorthClient.storage.migrating.find(x => x === interaction.guild.id)) return await music(interaction);
      try {
        if (interaction.guild.members.me.voice?.channelId === voiceChannel.id) serverQueue.connection = getVoiceConnection(interaction.guild.id);
        else {
          serverQueue?.destroy();
          serverQueue.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guild.id, adapterCreator: createDiscordJSAdapter(voiceChannel) });
        }
        if (interaction.guild.members.me.voice?.channelId && !interaction.guild.members.me.voice.selfDeaf) interaction.guild.members.me.voice.setDeaf(true).catch(() => { });
      } catch (err: any) {
        await interaction.editReply("There was an error trying to connect to the voice channel!");
        if (err.message) await interaction.channel.send(err.message);
        console.error(err);
        return serverQueue?.destroy();
      }
      serverQueue.voiceChannel = voiceChannel;
      serverQueue.playing = true;
      serverQueue.textChannel = <Discord.TextChannel>interaction.channel;
      serverQueue.callers.add(interaction.member.user.id);
      if (!serverQueue.player) serverQueue.player = createPlayer(interaction.guild);
      await entersState(serverQueue.connection, VoiceConnectionStatus.Ready, 30e3);
      serverQueue.connection.subscribe(serverQueue.player);
      updateQueue(interaction.guild.id, serverQueue);
      if (!serverQueue.random) await play(interaction.guild, serverQueue.songs[0]);
      else {
        const int = Math.floor(Math.random() * serverQueue.songs.length);
        const pending = serverQueue.songs[int];
        serverQueue.songs = moveArray(serverQueue.songs, int);
        updateQueue(interaction.guild.id, serverQueue);
        await play(interaction.guild, pending);
      }
      if (interaction instanceof Discord.ChatInputCommandInteraction) await interaction.deleteReply();
      return;
    }
    try {
      let result = { error: true, songs: [], msg: null, message: "No link/keywords/attachments!" };
      if (att) result = await addAttachment(att);
      else if (validYTPlaylistURL(str)) result = await addYTPlaylist(str);
      else if (validYTURL(str)) result = await addYTURL(str);
      else if (validSPURL(str)) result = await addSPURL(interaction, str);
      else if (validSCURL(str)) result = await addSCURL(str);
      else if (validGDFolderURL(str)) {
        const msg = await interaction.editReply("Processing track: (Initializing)");
        result = await addGDFolderURL(str, async (i, l) => await msg.edit(`Processing track: **${i}/${l}**`));
        await msg.delete();
      } else if (validGDURL(str) || validGDDLURL(str)) result = await addGDURL(str);
      else if (validMSSetURL(str)) result = await addMSSetURL(str);
      else if (validMSURL(str)) result = await addMSURL(str);
      else if (validURL(str)) result = await addURL(str);
      else result = await search(interaction, str);
      if (result.error) return await interaction.editReply(result.message || "Failed to add soundtracks");
      const songs = result.songs;
      if (!songs || songs.length < 1) return await interaction.editReply("There was an error trying to add the soundtrack!");
      const Embed = createEmbed(songs);
      if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, songs, false, false);
      else serverQueue.songs = ((!interaction.guild.members.me.voice.channel || !serverQueue.playing) ? songs : serverQueue.songs).concat((!interaction.guild.members.me.voice.channel || !serverQueue.playing) ? serverQueue.songs : songs);
      let msg: Discord.Message;
      if (result.msg) await result.msg.edit({ content: null, embeds: [Embed] });
      else await interaction.editReply({ embeds: [Embed] });
      setTimeout(() => { try { msg.edit({ embeds: [], content: `**[Added Track: ${songs.length > 1 ? songs.length + " in total" : songs[0]?.title}]**` }).catch(() => { }) } catch (err: any) { } }, 30000);
      updateQueue(interaction.guild.id, serverQueue);
      if (!serverQueue.player) serverQueue.player = createPlayer(interaction.guild);
      serverQueue.voiceChannel = voiceChannel;
      serverQueue.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guild.id, adapterCreator: createDiscordJSAdapter(voiceChannel) });
      serverQueue.textChannel = <Discord.TextChannel>interaction.channel;
      serverQueue.callers.add(interaction.member.user.id);
      interaction.guild.members.me.voice?.setDeaf(true).catch(() => { });
      await entersState(serverQueue.connection, VoiceConnectionStatus.Ready, 30e3);
      serverQueue.connection.subscribe(serverQueue.player);
      updateQueue(interaction.guild.id, serverQueue, false);
      if (!serverQueue.playing) {
        if (!serverQueue.random) await play(interaction.guild, serverQueue.songs[0]);
        else {
          const int = Math.floor(Math.random() * serverQueue.songs.length);
          const pending = serverQueue.songs[int];
          serverQueue.songs = moveArray(serverQueue.songs, int);
          updateQueue(interaction.guild.id, serverQueue);
          await play(interaction.guild, pending);
        }
      }
    } catch (err: any) {
      await interaction.editReply("There was an error trying to connect to the voice channel!");
      if (err.message) await interaction.channel.send(err.message);
      if (serverQueue) {
        serverQueue.destroy();
        serverQueue.clean();
      }
      console.error(err);
    }
  }
}

const cmd = new PlayCommand();
export default cmd;