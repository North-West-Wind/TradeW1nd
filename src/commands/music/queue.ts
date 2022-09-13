import { ServerQueue, SoundTrack, SlashCommand } from "../../classes/NorthClient.js";
import * as Discord from "discord.js";
import { color, createEmbedScrolling, duration, query } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { getClients } from "../../main.js";
import { ApplicationCommandOptionType, ButtonStyle, MessageActionRowComponentBuilder } from "discord.js";

class QueueCommand implements SlashCommand {
    name = "queue"
    description = "Displays the current song queue."
    aliases = ["q"]
    subcommands = ["save", "load", "delete", "list", "sync"]
    subdesc = ["Saves the current queue to the database.", "Loads a queue from the database.", "Deletes a queue from the database.", "Lists all the queues of a user.", "Synchronizes the queue with another server you are in."]
    subusage = ["<subcommand> <name>", 0, 0]
    subaliases = ["s", "l", "d", "li", "sy"]
    category = 0
    options = [
        {
            name: "current",
            description: "Displays the current soundtrack queue.",
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: "save",
            description: "Saves the current queue to the database.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "name",
                description: "The name of the queue.",
                required: true,
                type: ApplicationCommandOptionType.String
            }]
        },
        {
            name: "load",
            description: "Loads a queue from the database.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "name",
                description: "The name of the queue.",
                required: true,
                type: ApplicationCommandOptionType.String
            }]
        },
        {
            name: "delete",
            description: "Deletes a queue from the database.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "name",
                description: "The name of the queue.",
                required: true,
                type: ApplicationCommandOptionType.String
            }]
        },
        {
            name: "list",
            description: "Lists all the queues of a user.",
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: "sync",
            description: "Synchronizes the queue with another server you are in.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: "name",
                description: "The name of the server.",
                required: true,
                type: ApplicationCommandOptionType.String
            }]
        },
    ]


    async execute(interaction: Discord.ChatInputCommandInteraction) {
        let serverQueue = getQueue(interaction.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(interaction.guild.id, [], false, false);
        const sub = interaction.options.getSubcommand();
        if (sub === "current") return await this.viewQueue(interaction, serverQueue);
        if (sub === "save") return await this.save(interaction, serverQueue, interaction.options.getString("name"));
        if (sub === "load") return await this.load(interaction, serverQueue, interaction.options.getString("name"));
        if (sub === "delete") return await this.delete(interaction, interaction.options.getString("name"));
        if (sub === "list") return await this.list(interaction);
        if (sub === "sync") return await this.sync(interaction, serverQueue, interaction.options.getString("name"));
        await this.viewQueue(interaction, serverQueue);
    }

    async viewQueue(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue) {
        if (serverQueue.songs.length < 1) return await interaction.reply("Nothing is in the queue now.");
        const filtered = serverQueue.songs.filter(song => !!song);
        if (serverQueue.songs.length !== filtered.length) {
            serverQueue.songs = filtered;
            updateQueue(interaction.guild.id, serverQueue);
        }
        let index = 0;
        const songArray = serverQueue.songs.map(song => `**${++index} - ** **[${song.title}](${song.type === 1 ? song.spot : song.url})** : **${!song.time ? "∞" : duration(song.time, "seconds")}**`);
        const allEmbeds: Discord.EmbedBuilder[] = [];
        for (let i = 0; i < Math.ceil(songArray.length / 10); i++) {
            const pageArray = songArray.slice(i * 10, i * 10 + 10);
            const queueEmbed = new Discord.EmbedBuilder()
                .setColor(color())
                .setTitle(`Song queue for ${interaction.guild.name} [${i + 1}/${Math.ceil(songArray.length / 10)}]`)
                .setDescription(`There are ${songArray.length} tracks in total.\n\n${pageArray.join("\n")}`)
                .setTimestamp()
                .setFooter({ text: `Now playing: ${(serverQueue.songs[0] ? serverQueue.songs[0].title : "Nothing")} | LP: ${serverQueue.looping ? "Y" : "N"} | RP: ${serverQueue.repeating ? "Y" : "N"} | RD: ${serverQueue.random ? "Y" : "N"}`, iconURL: interaction.client.user.displayAvatarURL() });
            allEmbeds.push(queueEmbed);
        }
        if (allEmbeds.length == 1) await interaction.reply({ embeds: [allEmbeds[0]], fetchReply: true }).then(msg => setTimeout(() => msg.edit({ embeds: [], content: `**[Queue: ${songArray.length} tracks in total]**` }).catch(() => {}), 60000));
        else await createEmbedScrolling(interaction, allEmbeds, (msg: Discord.Message) => setTimeout(() => msg.edit({ embeds: [], content: `**[Queue: ${songArray.length} tracks in total]**` }).catch(() => {}), 60000));
    }

    async save(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue, name: string) {
        const guild = interaction.guild;
        const author = interaction.member.user;
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await interaction.reply("There is no queue playing in this server right now!");
        const results = await query(`SELECT * FROM queue WHERE user = '${author.id}'`);
        if (results.length >= 10) return await interaction.reply("You have already stored 10 queues! Delete some of them to save this queue.");
        if (!name) return await interaction.reply("Please provide the name of the queue.");
        const q = `INSERT INTO queue(user, name, queue) VALUES('${author.id}', '${name}', '${escape(JSON.stringify(serverQueue.songs))}')`;
        for (const result of results) {
            if (result.name === name) {
                return await interaction.reply(`The queue with the name ${name} already exists.`);
            }
        }
        await query(q);
        return await interaction.reply(`The song queue has been stored with the name **${name}**!\nSlots used: **${results.length || 1}/10**`);
    }

    async load(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue, name: string) {
        const guild = interaction.guild;
        const author = interaction.user;
        if (serverQueue?.playing) return await interaction.reply("Someone is listening to the music. Don't ruin their day.");
        if (!name) return await interaction.reply("Please provide the name of the queue.");
        const results = await query(`SELECT * FROM queue WHERE name = '${name}' AND user = '${author.id}'`);
        if (results.length == 0) return await interaction.reply("No queue was found!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(guild.id, JSON.parse(unescape(results[0].queue)), false, false);
        else serverQueue.songs = JSON.parse(unescape(results[0].queue));
        updateQueue(guild.id, serverQueue);
        return await interaction.reply(`The queue **${results[0].name}** has been loaded.`);
    }

    async delete(interaction: Discord.ChatInputCommandInteraction, name: string) {
        const author = interaction.member.user;
        if (!name) return await interaction.reply("Please provide the name of the queue.");
        const results = await query(`SELECT * FROM queue WHERE name = '${name}' AND user = '${author.id}'`);
        if (results.length == 0) return await interaction.reply("No queue was found!");
        await query(`DELETE FROM queue WHERE id = ${results[0].id}`);
        return await interaction.reply(`The stored queue **${results[0].name}** has been deleted.`);
    }

    async list(interaction: Discord.ChatInputCommandInteraction) {
        const author = interaction.user;
        const results = await query(`SELECT * FROM queue WHERE user = '${author.id}'`);
        const queues = [];
        let num = 0;
        const allEmbeds = [];
        const menu = new Discord.SelectMenuBuilder().setCustomId("menu");
        for (let ii = 0; ii < results.length; ii++) {
            const result = results[ii];
            const queue = <SoundTrack[]> JSON.parse(unescape(result.queue));
            queues.push(`${++num}. **${result.name}** : **${queue.length} tracks**`);
            menu.addOptions({ label: result.name, value: (ii + 1).toString() });
            var queueNum = 0;
            const pageArray = queue.map(song => {
                let str: string;
                const songLength = !song.time ? "∞" : duration(song.time, "seconds");
                if (song.type === 1) str = `**${++queueNum} - ** **[${song.title}](${song.spot})** : **${songLength}**`;
                else str = `**${++queueNum} - ** **[${song.title}](${song.url})** : **${songLength}**`;
                return str;
            }).slice(0, 10);
            const queueEmbed = new Discord.EmbedBuilder()
                .setColor(color())
                .setTitle(`Queue - ${result.name}`)
                .setDescription(`There are ${queue.length} tracks in total.\n\n${pageArray.join("\n")}`)
                .setTimestamp()
                .setFooter({ text: queue.length > pageArray.length ? "Cannot show all soundtracks here..." : "Here are all the soundtracks in this queue.", iconURL: interaction.client.user.displayAvatarURL() });
            allEmbeds.push(queueEmbed);
        }
        const em = new Discord.EmbedBuilder()
            .setColor(color())
            .setTitle(`Stored queues of **${author.tag}**`)
            .setDescription(`Slots used: **${results.length}/10**\n\n${queues.join("\n")}`)
            .setTimestamp()
            .setFooter({ text: "Choose a queue in the menu to view it.", iconURL: getClients()[0].user.displayAvatarURL() });
        allEmbeds.unshift(em);
        const backButton = new Discord.ButtonBuilder({ label: "Back", emoji: "⬅", style: ButtonStyle.Secondary, disabled: true, customId: "back" });
        const stopButton = new Discord.ButtonBuilder({ label: "Stop", emoji: "✖️", style: ButtonStyle.Danger, customId: "stop" });
        const res = await interaction.reply({ embeds: [em], components: [new Discord.ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu), new Discord.ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(backButton, stopButton)] });
        const collector = res.createMessageComponentCollector({ filter: interaction => interaction.user.id === author.id, idle: 60000 });
        collector.on("collect", async function (interaction) {
            if (interaction.isButton()) {
                if (interaction.customId === "stop") collector.emit("end");
                else if (interaction.customId === "back") {
                    backButton.setDisabled(true);
                    await interaction.update({ embeds: [allEmbeds[0]], components: [new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(menu), new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(backButton, stopButton)] });
                }
            } else if (interaction.isSelectMenu()) {
                const index = parseInt(interaction.values[0]);
                backButton.setDisabled(false);
                await interaction.update({ embeds: [allEmbeds[index]], components: [new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(menu), new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(backButton, stopButton)] });
            }
        });
        collector.on("end", function () {
            interaction.editReply({ embeds: [allEmbeds[0]], components: [] }).catch(() => {});
            setTimeout(() => interaction.editReply({ embeds: [], content: `**[Queues: ${results.length}/10 slots used]**` }).catch(() => {}), 60000);
        });
    }

    async sync(interaction: Discord.ChatInputCommandInteraction, serverQueue: ServerQueue, name: string) {
        const guild = interaction.guild;
        const author = interaction.member.user;
        if (serverQueue && serverQueue.playing) return await interaction.reply("Someone is listening to the music. Don't ruin their day.");
        if (!name) return await interaction.reply("Please provide the name or ID of the server.");
        const g = getClients()[0].guilds.cache.find(x => x.name.toLowerCase() === name.toLowerCase() || x.id == name);
        if (!g) return await interaction.reply("I cannot find that server! Maybe I am not in that server?");
        try {
            await g.members.fetch(author.id);
        } catch (e: any) {
            return await interaction.reply("You are not in that server!");
        }
        const results = await query(`SELECT queue FROM servers WHERE id = '${g.id}'`);
        if (results.length == 0) return await interaction.reply("No queue was found!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(guild.id, JSON.parse(unescape(results[0].queue)), false, false);
        else serverQueue.songs = JSON.parse(unescape(results[0].queue));
        updateQueue(guild.id, serverQueue);
        return await interaction.reply(`The queue of this server has been synchronize to the queue of server **${g.name}**.`);
    }
}

const cmd = new QueueCommand();
export default cmd;