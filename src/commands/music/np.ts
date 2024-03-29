import { SlashCommand } from "../../classes/index.js";
import * as Discord from "discord.js";
import { color, duration, wait } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { getClients } from "../../main.js";

const type = [
    "YouTube",
    "Spotify",
    "URL/Attachment",
    "SoundCloud",
    "Google Drive",
    "Musescore",
    "MSCZ/MSCX"
];

class NPCommand implements SlashCommand {
    name = "np"
    description = "Displays information about the soundtrack being played."
    category = 0

    async execute(interaction: Discord.ChatInputCommandInteraction) {
        await this.nowplaying(interaction);
    }

    async nowplaying(interaction: Discord.ChatInputCommandInteraction) {
        const getEmbed = this.getEmbed;
        let embed = getEmbed(interaction.guildId);
        if (!embed) return await interaction.reply("There is nothing in the queue.");
        let counter = 0;
        await interaction.reply({ embeds: [embed] });
        async function edit() {
            await wait(5000);
            counter++;
            if (counter >= 12 || !(embed = getEmbed(interaction.guildId, embed))) return await interaction.editReply({ content: "**[Outdated Now-Playing Information]**", embeds: [] });
            try {
                await interaction.editReply({ embeds: [embed] });
                await edit();
            } catch (err) { }
        }
        await edit();
    }

    getEmbed(id: Discord.Snowflake, embed: Discord.EmbedBuilder = null) {
        let serverQueue = getQueue(id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(id, [], false, false);
        if (serverQueue.songs.length < 1) return null;
        const filtered = serverQueue.songs.filter(song => !!song);
        if (serverQueue.songs.length !== filtered.length) {
            serverQueue.songs = filtered;
            updateQueue(id, serverQueue);
        }
        let position = 0;
        const streamTime = serverQueue.getPlaybackDuration();
        if (streamTime) position = Math.round((streamTime - (serverQueue.startTime || 0)) / 1000);
        const processBar = [];
        for (let i = 0; i < 20; i++) processBar.push("═");
        let progress = 0;
        const isLive = !!serverQueue?.songs[0]?.isLive;
        const length = isLive ? 0 : (serverQueue.songs[0].time || 1);
        let positionTime: string;
        if (isLive) {
            processBar.splice(19, 1, "■");
            positionTime = "∞";
        } else {
            positionTime = duration(position, "seconds");
            if (position === 0 || isNaN(position))
                positionTime = "00:00";
            progress = Math.floor((position / length) * processBar.length);
            processBar.splice(progress, 1, "■");
        }
        let info = [];
        if (!embed) embed = new Discord.EmbedBuilder().setColor(color()).setTimestamp();
        embed.setTitle("Now playing:" + (serverQueue.playing ? "" : " (Not actually)")).setFooter({ text: `Looping: ${serverQueue.looping ? "Enabled" : "Disabled"} | Repeating: ${serverQueue.repeating ? "Enabled" : "Disabled"} | Random: ${serverQueue.random ? "Enabled" : "Disabled"}`, iconURL: getClients()[0].user.displayAvatarURL() });

        const songLength = !serverQueue.songs[0].time ? "∞" : duration(serverQueue.songs[0].time, "seconds");
        if (serverQueue.songs[0].type === 1) info = [`**[${serverQueue.songs[0].title}](${serverQueue.songs[0].spot})**\nLength: **${songLength}**`, serverQueue.songs[0].thumbnail];
        else info = [`**[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})**\nLive: **${isLive ? "Yes" : "No"}**\nVolume: **${serverQueue.songs[0].volume ? (`${serverQueue.volume * serverQueue.songs[0].volume * 100}% (Local) | ${serverQueue.volume * 100}% (Global)`) : `${serverQueue.volume * 100}%`}**\nType: **${type[serverQueue.songs[0].type]}**`, serverQueue.songs[0].thumbnail];
        embed.setDescription(`${info[0]}\n\n${positionTime} \`${processBar.join("")}\` ${songLength || "Unknown"}`).setThumbnail(info[1]);
        return embed;
    }
}

const cmd = new NPCommand();
export default cmd;