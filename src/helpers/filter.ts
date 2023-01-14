import { ActivityType, ChatInputCommandInteraction, GuildMember, PermissionsBitField, TextChannel } from "discord.js";
import { NorthClient, SlashCommand } from "../classes/index.js";
import { genPermMsg, getOwner } from "../function.js";
import { getQueue } from "./music.js";
import { isPlaying } from "./radio.js";

let timeout: NodeJS.Timeout;

export function canReset() {
    return !timeout;
}

export async function all(command: SlashCommand, interaction: ChatInputCommandInteraction) {
    if (command.permissions && interaction.guild) {
        if (command.permissions.guild) {
            if (command.permissions.guild.user && !(<GuildMember>interaction.member).permissions.has(BigInt(command.permissions.guild.user))) {
                await interaction.reply(genPermMsg(command.permissions.guild.user, 0));
                return false;
            }
            if (command.permissions.guild.me && !interaction.guild.members.me.permissions.has(BigInt(command.permissions.guild.me))) {
                await interaction.reply(genPermMsg(command.permissions.guild.me, 1));
                return false;
            }
        }
        if (command.permissions.channel) {
            if (command.permissions.channel.user && !(<TextChannel>interaction.channel).permissionsFor(<GuildMember>interaction.member).has(BigInt(command.permissions.channel.user))) {
                await interaction.reply(genPermMsg(command.permissions.channel.user, 0));
                return false;
            }
            if (command.permissions.channel.me && !(<TextChannel>interaction.channel).permissionsFor(interaction.guild.members.me).has(BigInt(command.permissions.channel.me))) {
                await interaction.reply(genPermMsg(command.permissions.channel.me, 1));
                return false;
            }
        }
    }
    if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
    } else interaction.client.user.setPresence({ activities: [{ name: `${interaction.user.username}'s Commands`, type: ActivityType.Watching }], status: "online", afk: false });
    timeout = setTimeout(() => {
        interaction.client.user.setPresence({ activities: [{ name: `AFK | ${(<NorthClient>interaction.client).prefix}help`, type: ActivityType.Playing }], status: "idle", afk: true });
        timeout = undefined;
    }, 10000);
    return true;
}

export async function music(command: SlashCommand, interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        await interaction.reply("You can only use music commands in server!");
        return false;
    }
    if (command.name !== "radio" && isPlaying(interaction.guildId)) {
        await interaction.reply("Radio is still connected! Disconnect from radio first to use other commands.");
        return false;
    }
    const serverQueue = getQueue(interaction.guildId);
    if (serverQueue?.playing && !(<PermissionsBitField> interaction.member.permissions).any(BigInt(56)) && !serverQueue.callers.has(interaction.member.user.id) && !(<GuildMember> interaction.member).roles.cache.hasAny(...serverQueue.callRoles)) {
        await interaction.reply("You don't have the permissions to alter the queue!");
        return false;
    }
    return true;
}

export async function dev(_command: SlashCommand, interaction: ChatInputCommandInteraction) {
    if (interaction.user.id != await getOwner()) {
        await interaction.reply("Please don't use Dev Commands.");
        return false;
    }
    return true;
}
