import { ApplicationCommandOptionType, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { ServerQueue, SlashCommand } from "../../classes/NorthClient.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";

class VolumeCommand implements SlashCommand {
    name = "volume"
    description = "Turns the volume of music up or down by percentage."
    usage = "[percentage]"
    aliases = ["vol"]
    category = 0
    options = [
        {
            name: "percentage",
            description: "The percentage change of the volume.",
            required: false,
            type: ApplicationCommandOptionType.Integer
        },
        {
            name: "nowplaying",
            description: "Whether or not to perform soundtrack-specific action.",
            required: false,
            type: ApplicationCommandOptionType.Boolean
        }
    ]

    async execute(interaction: ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        const pct = interaction.options.getInteger("percentage");
        if (!pct) return await interaction.reply(`The current volume is **${Math.round(serverQueue.volume * 100)}%** and the current volume of the soundtrack is **${Math.round(serverQueue.volume * (serverQueue.songs[0] && serverQueue.songs[0].volume ? serverQueue.songs[0].volume : 1) * 100)}%**`);
        await this.volume(interaction, serverQueue, pct, interaction.options.getBoolean("nowplaying"));
    }

    async volume(interaction: ChatInputCommandInteraction, serverQueue: ServerQueue, change: number, specific: boolean) {
        if (((<GuildMember> interaction.member).voice.channelId !== interaction.guild.members.me.voice.channelId) && serverQueue.playing) return await interaction.reply("You have to be in a voice channel to alter the volume when the bot is playing!");
        if (specific) {
            if (serverQueue.songs.length < 1) return await interaction.reply("There is nothing in the queue. You cannot change the volume of current soundtrack.");
            if (!isNaN(serverQueue.songs[0].volume)) serverQueue.songs[0].volume += change / 100;
            else serverQueue.songs[0].volume = 1 + (change / 100);
            if (serverQueue.songs[0].volume > 10) serverQueue.songs[0].volume = 10;
            if (serverQueue.songs[0].volume < 0) serverQueue.songs[0].volume = 0;
            await interaction.reply("Volume of the current soundtrack has been changed to **" + (serverQueue.volume * serverQueue.songs[0].volume * 100) + "%**.");
        } else {
            serverQueue.volume += change / 100;
            if (serverQueue.volume > 10) serverQueue.volume = 10;
            if (serverQueue.volume < 0) serverQueue.volume = 0;
            await interaction.reply("Volume has been changed to **" + (serverQueue.volume * 100) + "%**.");
        }
        serverQueue.resource?.volume.setVolumeLogarithmic(serverQueue.songs[0]?.volume ? serverQueue.volume * serverQueue.songs[0].volume : serverQueue.volume);
        updateQueue(interaction.guild.id, serverQueue, false);
    }
}

const cmd = new VolumeCommand();
export default cmd;