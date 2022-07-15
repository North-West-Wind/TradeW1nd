import { CommandInteraction, Modal, TextInputComponent, MessageActionRow } from "discord.js";
import { SlashCommand } from "../../classes/NorthClient.js";
import * as fs from "fs";
import { addBot } from "../../main.js";

class NewCommand implements SlashCommand {
	name = "new";
	description = "Adds a new bot to the list.";

	async execute(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
		await this.addBot(interaction);
	}

	async addBot(interaction: CommandInteraction) {
		const modal = new Modal().setCustomId("new").setTitle("Add a new bot");
		const tokenInput = new TextInputComponent().setCustomId("token").setLabel("Token").setStyle("SHORT");
		modal.addComponents(new MessageActionRow<TextInputComponent>().addComponents(tokenInput));
		await interaction.showModal(modal);
		const submit = await interaction.awaitModalSubmit({ filter: int => int.user.id === interaction.user.id, time: 60000 }).catch(() => {});
		if (!submit) return await interaction.editReply("Timed out");
		const token = submit.fields.getTextInputValue("token");
		addBot(token);
		await interaction.editReply("Added bot!");
	}
}

const cmd = new NewCommand();
export default cmd;