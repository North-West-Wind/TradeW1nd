import { Attachment, ChatInputCommandInteraction, Message } from "discord.js";

import { SlashCommand } from "../../classes/NorthClient.js";
import { validYTPlaylistURL, validYTURL, validSPURL, validSCURL, validGDFolderURL, validGDURL, validGDDLURL, validMSURL, validURL, wait, validMSSetURL } from "../../function.js";
import { addYTPlaylist, addYTURL, addSPURL, addSCURL, addGDFolderURL, addGDURL, addMSURL, addURL, addAttachment, search, addMSSetURL } from "../../helpers/addTrack.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { createEmbed } from "./play.js";

class AddCommand implements SlashCommand {
    name = "add"
    description = "Adds soundtracks to the queue without playing it."
    usage = "[link | keywords]"
    category = 0
    options = [
        {
            name: "link",
            description: "The link of the soundtrack or the keywords to search for.",
            required: true,
            type: "STRING"
        },
        {
            name: "attachment",
            description: "An attachment of the audio file.",
            required: false,
            type: "ATTACHMENT"
        }
    ]

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        await this.add(interaction, interaction.options.getString("link"), interaction.options.getAttachment("attachment"));
    }

    async add(interaction: ChatInputCommandInteraction, str: string, att: Attachment) {
        let serverQueue = getQueue(interaction.guild.id);
        try {
            let result = { error: true, message: "No link/keywords/attachments!", songs: [], msg: null };
            if (att) result = await addAttachment(att);
            else if (validYTPlaylistURL(str)) result = await addYTPlaylist(str);
            else if (validYTURL(str)) result = await addYTURL(str);
            else if (validSPURL(str)) result = await addSPURL(interaction, str);
            else if (validSCURL(str)) result = await addSCURL(str);
            else if (validGDFolderURL(str)) {
                const msg = await interaction.editReply("Processing track: (Initializing)");
                result = await addGDFolderURL(str, async (i, l) => await msg.edit(`Processing track: **${i}/${l}**`));
                result.msg = msg;
            } else if (validGDURL(str) || validGDDLURL(str)) result = await addGDURL(str);
            else if (validMSSetURL(str)) result = await addMSSetURL(str);
            else if (validMSURL(str)) result = await addMSURL(str);
            else if (validURL(str)) result = await addURL(str);
            else result = await search(interaction, str);
            if (result.error) return await interaction.editReply(result.message || "Failed to add soundtrack");
            const songs = result.songs;
            if (!songs || songs.length < 1) return await interaction.editReply("There was an error trying to add the soundtrack!");
            const Embed = createEmbed(songs);
            if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, songs, false, false);
            else serverQueue.songs = serverQueue.songs.concat(songs);
            updateQueue(interaction.guild.id, serverQueue);
            let msg: Message;
            if (result.msg) msg = await result.msg.edit({ content: null, embeds: [Embed] });
            else msg = await interaction.editReply({ embeds: [Embed] });
            await wait(30000);
            msg.edit({ embeds: [], content: `**[Added Track: ${songs.length > 1 ? songs.length + " in total" : songs[0].title}]**` }).catch(() => { });
        } catch (err) {
            await interaction.reply("There was an error trying to add the soundtrack to the queue!");
            console.error(err);
        }
    }
}

const cmd = new AddCommand();
export default cmd;