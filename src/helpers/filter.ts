import { ActivityType, ChatInputCommandInteraction, GuildMember, Message, PermissionsBitField, TextChannel } from "discord.js";
import { Command, NorthClient } from "../classes/NorthClient.js";
import { genPermMsg, getOwner, msgOrRes } from "../function.js";
import { getQueue } from "./music.js";
import { isPlaying } from "./radio.js";

let timeout: NodeJS.Timeout;

export function canReset() {
    return !timeout;
}

export async function all(command: Command, message: Message | ChatInputCommandInteraction, args: string[] = []) {
    if (message instanceof Message) {
        if (command.args && args.length < command.args) {
            await msgOrRes(message, `The command \`${command.name}\` requires ${command.args} arguments.\nHere's how you are supposed to use it: \`${command.name}${command.usage ? ` ${command.usage}` : ""}\``);
            return false;
        }
        if (message.guild && !(<TextChannel>message.channel).permissionsFor(message.guild.members.me).has(BigInt(84992))) {
            await message.author.send(`I need at least the permissions to \`${new PermissionsBitField(BigInt(84992)).toArray().join("`, `")}\` in order to run any command! Please tell your server administrator about that.`);
            return false;
        }
    }
    if (command.permissions && message.guild) {
        if (command.permissions.guild) {
            if (command.permissions.guild.user && !(<GuildMember>message.member).permissions.has(BigInt(command.permissions.guild.user))) {
                await msgOrRes(message, genPermMsg(command.permissions.guild.user, 0));
                return false;
            }
            if (command.permissions.guild.me && !message.guild.members.me.permissions.has(BigInt(command.permissions.guild.me))) {
                await msgOrRes(message, genPermMsg(command.permissions.guild.me, 1));
                return false;
            }
        }
        if (command.permissions.channel) {
            if (command.permissions.channel.user && !(<TextChannel>message.channel).permissionsFor(<GuildMember>message.member).has(BigInt(command.permissions.channel.user))) {
                await msgOrRes(message, genPermMsg(command.permissions.channel.user, 0));
                return false;
            }
            if (command.permissions.channel.me && !(<TextChannel>message.channel).permissionsFor(message.guild.members.me).has(BigInt(command.permissions.channel.me))) {
                await msgOrRes(message, genPermMsg(command.permissions.channel.me, 1));
                return false;
            }
        }
    }
    if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
    } else message.client.user.setPresence({ activities: [{ name: `${(message instanceof Message ? message.author : message.user).username}'s Commands`, type: ActivityType.Watching }], status: "online", afk: false });
    timeout = setTimeout(() => {
        message.client.user.setPresence({ activities: [{ name: `AFK | ${(<NorthClient>message.client).prefix}help`, type: ActivityType.Playing }], status: "idle", afk: true });
        timeout = undefined;
    }, 10000);
    return true;
}

export async function information(_command: Command, message: Message | ChatInputCommandInteraction) {
    if (!message.guild) return true;
    try {
        if (await message.guild.members.fetch("649611982428962819")) return false;
    } catch (err) {}
    return true;
}

export async function music(command: Command, message: Message | ChatInputCommandInteraction) {
    if (!message.guild) {
        await msgOrRes(message, "You can only use music commands in server!");
        return false;
    }
    if (command.name !== "radio" && isPlaying(message.guildId)) {
        await msgOrRes(message, "Radio is still connected! Disconnect from radio first to use other commands.");
        return false;
    }
    const serverQueue = getQueue(message.guildId);
    if (serverQueue?.playing && !(<PermissionsBitField> message.member.permissions).any(BigInt(56)) && !serverQueue.callers.has(message.member.user.id) && !(<GuildMember> message.member).roles.cache.hasAny(...serverQueue.callRoles)) {
        await msgOrRes(message, "You don't have the permissions to alter the queue!");
        return false;
    }
    return true;
}

export async function dev(_command: Command, message: Message | ChatInputCommandInteraction) {
    if ((message instanceof Message ? message.author : message.user).id != await getOwner()) {
        await msgOrRes(message, "Please don't use Dev Commands.");
        return false;
    }
    return true;
}
