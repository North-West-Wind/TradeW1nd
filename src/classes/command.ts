import { ChatInputCommandInteraction } from "discord.js";

export abstract class ISlash {
	options?: any[];
	
	abstract execute(interaction: ChatInputCommandInteraction): Promise<any> | any;
}

abstract class Command {
	name: string;
	description: string;
	category?: number;
	permissions?: { guild?: { user?: number, me?: number }, channel?: { user?: number, me?: number } };
}

export abstract class SlashCommand extends Command implements ISlash {
	options?: any[];

	abstract execute(interaction: ChatInputCommandInteraction): Promise<any> | any;
}