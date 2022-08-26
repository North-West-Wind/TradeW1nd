import { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { SlashCommand } from "../../classes/NorthClient.js";
import { addBot } from "../../main.js";

class NewCommand implements SlashCommand {
	name = "new";
	description = "Adds a new bot to the list.";

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
		await this.addBot(interaction);
	}

	async addBot(interaction: ChatInputCommandInteraction) {
		const modal = new ModalBuilder().setCustomId("new").setTitle("Add a new bot");
		const tokenInput = new TextInputBuilder().setCustomId("token").setLabel("Token").setStyle(TextInputStyle.Short);
		modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(tokenInput));
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