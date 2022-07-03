import { ServerQueue, SlashCommand, SoundTrack } from "../../classes/NorthClient.js";
import * as Discord from "discord.js";
import { color, createEmbedScrolling, duration, msgOrRes, query } from "../../function.js";
import { getQueue, setQueue, updateQueue } from "../../helpers/music.js";
import { globalClient as client } from "../../common.js";

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
            type: "SUB_COMMAND"
        },
        {
            name: "save",
            description: "Saves the current queue to the database.",
            type: "SUB_COMMAND",
            options: [{
                name: "name",
                description: "The name of the queue.",
                required: true,
                type: "STRING"
            }]
        },
        {
            name: "load",
            description: "Loads a queue from the database.",
            type: "SUB_COMMAND",
            options: [{
                name: "name",
                description: "The name of the queue.",
                required: true,
                type: "STRING"
            }]
        },
        {
            name: "delete",
            description: "Deletes a queue from the database.",
            type: "SUB_COMMAND",
            options: [{
                name: "name",
                description: "The name of the queue.",
                required: true,
                type: "STRING"
            }]
        },
        {
            name: "list",
            description: "Lists all the queues of a user.",
            type: "SUB_COMMAND"
        },
        {
            name: "sync",
            description: "Synchronizes the queue with another server you are in.",
            type: "SUB_COMMAND",
            options: [{
                name: "name",
                description: "The name of the server.",
                required: true,
                type: "STRING"
            }]
        },
    ]


    async execute(interaction: Discord.CommandInteraction) {
        var serverQueue = getQueue(interaction.guild.id);
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
    
    async run(message: Discord.Message, args: string[]) {
        var serverQueue = getQueue(message.guild.id);
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(message.guild.id, [], false, false);
        if (args[0] && (args[0].toLowerCase() === "save" || args[0].toLowerCase() === "s")) return await this.save(message, serverQueue, args.slice(1).join(" "));
        if (args[0] && (args[0].toLowerCase() === "load" || args[0].toLowerCase() === "l")) return await this.load(message, serverQueue, args.slice(1).join(" "));
        if (args[0] && (args[0].toLowerCase() === "delete" || args[0].toLowerCase() === "d")) return await this.delete(message, args.slice(1).join(" "));
        if (args[0] && (args[0].toLowerCase() === "list" || args[0].toLowerCase() === "li")) return await this.list(message);
        if (args[0] && (args[0].toLowerCase() === "sync" || args[0].toLowerCase() === "sy")) return await this.sync(message, serverQueue, args.slice(1).join(" "));
        await this.viewQueue(message, serverQueue);
    }

    async viewQueue(message: Discord.Message | Discord.CommandInteraction, serverQueue: ServerQueue) {
        if (serverQueue.songs.length < 1) return await msgOrRes(message, "Nothing is in the queue now.");
        const filtered = serverQueue.songs.filter(song => !!song);
        if (serverQueue.songs.length !== filtered.length) {
            serverQueue.songs = filtered;
            updateQueue(message.guild.id, serverQueue);
        }
        var index = 0;
        const songArray = serverQueue.songs.map(song => `**${++index} - ** **[${song.title}](${song.type === 1 ? song.spot : song.url})** : **${!song.time ? "∞" : duration(song.time, "seconds")}**`);
        const allEmbeds = [];
        for (let i = 0; i < Math.ceil(songArray.length / 10); i++) {
            const pageArray = songArray.slice(i * 10, i * 10 + 10);
            const queueEmbed = new Discord.MessageEmbed()
                .setColor(color())
                .setTitle(`Song queue for ${message.guild.name} [${i + 1}/${Math.ceil(songArray.length / 10)}]`)
                .setDescription(`There are ${songArray.length} tracks in total.\n\n${pageArray.join("\n")}`)
                .setTimestamp()
                .setFooter({ text: `Now playing: ${(serverQueue.songs[0] ? serverQueue.songs[0].title : "Nothing")} | LP: ${serverQueue.looping ? "Y" : "N"} | RP: ${serverQueue.repeating ? "Y" : "N"} | RD: ${serverQueue.random ? "Y" : "N"}`, iconURL: message.client.user.displayAvatarURL() });
            allEmbeds.push(queueEmbed);
        }
        if (allEmbeds.length == 1) await msgOrRes(message, allEmbeds[0]).then(msg => setTimeout(() => msg.edit({ embeds: [], content: `**[Queue: ${songArray.length} tracks in total]**` }).catch(() => {}), 60000));
        else await createEmbedScrolling(message, allEmbeds, (msg: Discord.Message) => setTimeout(() => msg.edit({ embeds: [], content: `**[Queue: ${songArray.length} tracks in total]**` }).catch(() => {}), 60000));
    }

    async save(message: Discord.Message | Discord.CommandInteraction, serverQueue: ServerQueue, name: string) {
        const guild = message.guild;
        const author = message.member.user;
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(guild.id, [], false, false);
        if (serverQueue.songs.length < 1) return await msgOrRes(message, "There is no queue playing in this server right now!");
        const results = await query(`SELECT * FROM queue WHERE user = '${author.id}'`);
        if (results.length >= 10) return await msgOrRes(message, "You have already stored 10 queues! Delete some of them to save this queue.");
        if (!name) return await msgOrRes(message, "Please provide the name of the queue.");
        var q = `INSERT INTO queue(user, name, queue) VALUES('${author.id}', '${name}', '${escape(JSON.stringify(serverQueue.songs))}')`;
        for (const result of results) {
            if (result.name === name) {
                return await msgOrRes(message, `The queue with the name ${name} already exists.`);
            }
        }
        await query(q);
        return await msgOrRes(message, `The song queue has been stored with the name **${name}**!\nSlots used: **${results.length || 1}/10**`);
    }

    async load(message: Discord.Message | Discord.CommandInteraction, serverQueue: ServerQueue, name: string) {
        const guild = message.guild;
        const author = message instanceof Discord.Message ? message.author : message.user;
        if (serverQueue?.playing) return await msgOrRes(message, "Someone is listening to the music. Don't ruin their day.");
        if (!name) return await msgOrRes(message, "Please provide the name of the queue.");
        const results = await query(`SELECT * FROM queue WHERE name = '${name}' AND user = '${author.id}'`);
        if (results.length == 0) return await msgOrRes(message, "No queue was found!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(guild.id, JSON.parse(unescape(results[0].queue)), false, false);
        else serverQueue.songs = JSON.parse(unescape(results[0].queue));
        updateQueue(guild.id, serverQueue);
        return await msgOrRes(message, `The queue **${results[0].name}** has been loaded.`);
    }

    async delete(message: Discord.Message | Discord.CommandInteraction, name: string) {
        const author = message.member.user;
        if (!name) return await msgOrRes(message, "Please provide the name of the queue.");
        const results = await query(`SELECT * FROM queue WHERE name = '${name}' AND user = '${author.id}'`);
        if (results.length == 0) return await msgOrRes(message, "No queue was found!");
        await query(`DELETE FROM queue WHERE id = ${results[0].id}`);
        return await msgOrRes(message, `The stored queue **${results[0].name}** has been deleted.`);
    }

    async list(message: Discord.Message | Discord.CommandInteraction) {
        const author = message instanceof Discord.Message ? message.author : message.user;
        const results = await query(`SELECT * FROM queue WHERE user = '${author.id}'`);
        const queues = [];
        var num = 0;
        const allEmbeds = [];
        const menu = new Discord.MessageSelectMenu().setCustomId("menu");
        for (let ii = 0; ii < results.length; ii++) {
            const result = results[ii];
            const queue = <SoundTrack[]> JSON.parse(unescape(result.queue));
            queues.push(`${++num}. **${result.name}** : **${queue.length} tracks**`);
            menu.addOptions({ label: result.name, value: (ii + 1).toString() });
            var queueNum = 0;
            var pageArray = queue.map(song => {
                var str: string;
                const songLength = !song.time ? "∞" : duration(song.time, "seconds");
                if (song.type === 1) str = `**${++queueNum} - ** **[${song.title}](${song.spot})** : **${songLength}**`;
                else str = `**${++queueNum} - ** **[${song.title}](${song.url})** : **${songLength}**`;
                return str;
            }).slice(0, 10);
            const queueEmbed = new Discord.MessageEmbed()
                .setColor(color())
                .setTitle(`Queue - ${result.name}`)
                .setDescription(`There are ${queue.length} tracks in total.\n\n${pageArray.join("\n")}`)
                .setTimestamp()
                .setFooter({ text: queue.length > pageArray.length ? "Cannot show all soundtracks here..." : "Here are all the soundtracks in this queue.", iconURL: message.client.user.displayAvatarURL() });
            allEmbeds.push(queueEmbed);
        }
        const em = new Discord.MessageEmbed()
            .setColor(color())
            .setTitle(`Stored queues of **${author.tag}**`)
            .setDescription(`Slots used: **${results.length}/10**\n\n${queues.join("\n")}`)
            .setTimestamp()
            .setFooter({ text: "Choose a queue in the menu to view it.", iconURL: client.user.displayAvatarURL() });
        allEmbeds.unshift(em);
        const backButton = new Discord.MessageButton({ label: "Back", emoji: "⬅", style: "SECONDARY", disabled: true, customId: "back" });
        const stopButton = new Discord.MessageButton({ label: "Stop", emoji: "✖️", style: "DANGER", customId: "stop" });
        var msg = await msgOrRes(message, { embeds: [em], components: [new Discord.MessageActionRow().addComponents(menu), new Discord.MessageActionRow().addComponents(backButton, stopButton)] });
        const collector = msg.createMessageComponentCollector({ filter: interaction => interaction.user.id === author.id, idle: 60000 });
        collector.on("collect", async function (interaction) {
            if (interaction.isButton()) {
                if (interaction.customId === "stop") collector.emit("end");
                else if (interaction.customId === "back") {
                    backButton.setDisabled(true);
                    await interaction.update({ embeds: [allEmbeds[0]], components: [new Discord.MessageActionRow().addComponents(menu), new Discord.MessageActionRow().addComponents(backButton, stopButton)] });
                }
            } else if (interaction.isSelectMenu()) {
                const index = parseInt(interaction.values[0]);
                backButton.setDisabled(false);
                await interaction.update({ embeds: [allEmbeds[index]], components: [new Discord.MessageActionRow().addComponents(menu), new Discord.MessageActionRow().addComponents(backButton, stopButton)] });
            }
        });
        collector.on("end", function () {
            msg.edit({ embeds: [allEmbeds[0]], components: [] }).catch(() => {});
            setTimeout(() => msg.edit({ embeds: [], content: `**[Queues: ${results.length}/10 slots used]**` }).catch(() => {}), 60000);
        });
    }

    async sync(message: Discord.Message | Discord.CommandInteraction, serverQueue: ServerQueue, name: string) {
        const guild = message.guild;
        const author = message.member.user;
        if (serverQueue && serverQueue.playing) return await msgOrRes(message, "Someone is listening to the music. Don't ruin their day.");
        if (!name) return await msgOrRes(message, "Please provide the name or ID of the server.");
        const g = client.guilds.cache.find(x => x.name.toLowerCase() === name.toLowerCase() || x.id == name);
        if (!g) return await msgOrRes(message, "I cannot find that server! Maybe I am not in that server?");
        try {
            await g.members.fetch(author.id);
        } catch (e: any) {
            return await msgOrRes(message, "You are not in that server!");
        }
        const results = await query(`SELECT queue FROM servers WHERE id = '${g.id}'`);
        if (results.length == 0) return await msgOrRes(message, "No queue was found!");
        if (!serverQueue || !serverQueue.songs || !Array.isArray(serverQueue.songs)) serverQueue = setQueue(guild.id, JSON.parse(unescape(results[0].queue)), false, false);
        else serverQueue.songs = JSON.parse(unescape(results[0].queue));
        updateQueue(guild.id, serverQueue);
        return await msgOrRes(message, `The queue of this server has been synchronize to the queue of server **${g.name}**.`);
    }
}

const cmd = new QueueCommand();
export default cmd;