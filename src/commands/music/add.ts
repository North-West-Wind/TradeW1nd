import { ChatInputCommandInteraction, Message } from "discord.js";

import { FullCommand } from "../../classes/NorthClient.js";
import { validYTPlaylistURL, validYTURL, validSPURL, validSCURL, validGDFolderURL, validGDURL, validGDDLURL, validMSURL, validURL, msgOrRes, wait, validMSSetURL } from "../../function.js";
import { addYTPlaylist, addYTURL, addSPURL, addSCURL, addGDFolderURL, addGDURL, addMSURL, addURL, addAttachment, search, addMSSetURL } from "../../helpers/addTrack.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { createEmbed } from "./play.js";

class AddCommand implements FullCommand {
    name = "add"
    description = "Adds soundtracks to the queue without playing it."
    usage = "[link | keywords]"
    category = 0
    options = [{
        name: "link",
        description: "The link of the soundtrack or the keywords to search for.",
        required: true,
        type: "STRING"
    }]

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        await this.add(interaction, interaction.options.getString("link"));
    }

    async run(message: Message, args: string[]) {
        const str = args.join(" ");
        if (!str) return await message.channel.send("You didn't provide any link or keywords!");
        await this.add(message, str);
    }

    async add(message: Message | ChatInputCommandInteraction, str: string) {
        let serverQueue = getQueue(message.guild.id);
        try {
            let songs = [];
            let result = { error: true, message: "No link/keywords/attachments!", songs: [], msg: null };
            if (validYTPlaylistURL(str)) result = await addYTPlaylist(str);
            else if (validYTURL(str)) result = await addYTURL(str);
            else if (validSPURL(str)) result = await addSPURL(message, str);
            else if (validSCURL(str)) result = await addSCURL(str);
            else if (validGDFolderURL(str)) {
                const msg = await msgOrRes(message, "Processing track: (Initializing)");
                result = await addGDFolderURL(str, async(i, l) => await msg.edit(`Processing track: **${i}/${l}**`));
                result.msg = msg;
            } else if (validGDURL(str) || validGDDLURL(str)) result = await addGDURL(str);
            else if (validMSSetURL(str)) result = await addMSSetURL(str);
            else if (validMSURL(str)) result = await addMSURL(str);
            else if (validURL(str)) result = await addURL(str);
            else if (message instanceof Message && message.attachments.size > 0) result = await addAttachment(message);
            else result = await search(message, str);
            if (result.error) return await msgOrRes(message, result.message || "Failed to add soundtrack");
            songs = result.songs;
            if (!songs || songs.length < 1) return await msgOrRes(message, "There was an error trying to add the soundtrack!");
            const Embed = createEmbed(songs);
            if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, songs, false, false);
            else serverQueue.songs = serverQueue.songs.concat(songs);
            updateQueue(message.guild.id, serverQueue);
            let msg: Message;
            if (result.msg) msg = await result.msg.edit({ content: null, embeds: [Embed] });
            else msg = await msgOrRes(message, Embed);
            await wait(30000);
            msg.edit({ embeds: [], content: `**[Added Track: ${songs.length > 1 ? songs.length + " in total" : songs[0].title}]**` }).catch(() => { });
        } catch(err) {
            await msgOrRes(message, "There was an error trying to add the soundtrack to the queue!");
            console.error(err);
        }
    }
}

const cmd = new AddCommand();
export default cmd;