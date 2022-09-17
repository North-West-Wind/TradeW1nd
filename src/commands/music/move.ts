import { ApplicationCommandOptionType, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { moveArray, mutate } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { play } from "./play.js";

class MoveCommand implements SlashCommand {
    name = "move"
    description = "Moves a soundtrack to a specific position of the queue."
    category = 0
    options = [
        {
            name: "target",
            description: "The soundtrack to be moved.",
            required: true,
            type: ApplicationCommandOptionType.Integer
        },
        {
            name: "destination",
            description: "The new position of the soundtrack.",
            required: true,
            type: ApplicationCommandOptionType.Integer
        }
    ]

    async execute(interaction: ChatInputCommandInteraction) {
        await this.move(interaction, interaction.options.getInteger("target"), interaction.options.getInteger("destination"));
    }

    async move(interaction: ChatInputCommandInteraction, queueIndex: number, dest: number) {
        let serverQueue = getQueue(interaction.guild.id);
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to alter the queue when the bot is playing!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue.");
        const targetIndex = queueIndex - 1;
        const destIndex = dest - 1;
        if (targetIndex > serverQueue.songs.length - 1) return await interaction.reply(`You cannot move a soundtrack that doesn't exist.`);
        const title = serverQueue.songs[targetIndex].title;
        mutate(serverQueue.songs, targetIndex, destIndex);
        updateQueue(interaction.guild.id, serverQueue);
        await interaction.reply(`**${title}** has been moved from **#${queueIndex}** to **#${dest}**.`);
        if ((!targetIndex || !destIndex) && serverQueue.playing) {
            serverQueue.stop();
            if (!serverQueue.random) await play(interaction.guild, serverQueue.songs[0]);
            else {
                const int = Math.floor(Math.random() * serverQueue.songs.length);
                const pending = serverQueue.songs[int];
                serverQueue.songs = moveArray(serverQueue.songs, int);
                updateQueue(interaction.guild.id, serverQueue);
                await play(interaction.guild, pending);
            }
        }
    }
}

const cmd = new MoveCommand();
export default cmd;