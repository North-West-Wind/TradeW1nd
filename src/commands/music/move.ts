import { CommandInteraction, GuildMember, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { moveArray, msgOrRes, mutate } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { play } from "./play.js";

class MoveCommand implements SlashCommand {
    name = "move"
    description = "Moves a soundtrack to a specific position of the queue."
    usage = "<target> <destination>"
    category = 0
    args = 2
    options = [
        {
            name: "target",
            description: "The soundtrack to be moved.",
            required: true,
            type: "INTEGER"
        },
        {
            name: "destination",
            description: "The new position of the soundtrack.",
            required: true,
            type: "INTEGER"
        }
    ]

    async execute(interaction: CommandInteraction) {
        await this.move(interaction, interaction.options.getInteger("target"), interaction.options.getInteger("destination"));
    }

    async run(message: Message, args: string[]) {
        var queueIndex = parseInt(args[0]);
        var dest = parseInt(args[1]);
        if (isNaN(queueIndex)) return await message.channel.send("The target provided is not a number.");
        if (isNaN(dest)) return await message.channel.send("The destination provided is not a number.");
        await this.move(message, queueIndex, dest);
    }

    async move(message: Message | CommandInteraction, queueIndex: number, dest: number) {
        var serverQueue = getQueue(message.guild.id);
        if (((<GuildMember> message.member).voice.channelId !== message.guild.me.voice.channelId) && serverQueue.playing) return await msgOrRes(message, "You have to be in a voice channel to alter the queue when the bot is playing!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await msgOrRes(message, "There is nothing in the queue.");
        const targetIndex = queueIndex - 1;
        const destIndex = dest - 1;
        if (targetIndex > serverQueue.songs.length - 1) return await msgOrRes(message, `You cannot move a soundtrack that doesn't exist.`);
        const title = serverQueue.songs[targetIndex].title;
        mutate(serverQueue.songs, targetIndex, destIndex);
        updateQueue(message.guild.id, serverQueue);
        await msgOrRes(message, `**${title}** has been moved from **#${queueIndex}** to **#${dest}**.`);
        if ((!targetIndex || !destIndex) && serverQueue.playing) {
            serverQueue.stop();
            if (!serverQueue.random) await play(message.guild, serverQueue.songs[0]);
            else {
                const int = Math.floor(Math.random() * serverQueue.songs.length);
                const pending = serverQueue.songs[int];
                serverQueue.songs = moveArray(serverQueue.songs, int);
                updateQueue(message.guild.id, serverQueue);
                await play(message.guild, pending);
            }
        }
    }
}

const cmd = new MoveCommand();
export default cmd;