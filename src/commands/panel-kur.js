const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel-kur')
        .setDescription('Bu kanala destek talebi (ticket) panelini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('🎫 Destek Talebi Sistemi')
            .setDescription('Bir sorunun mu var? Aşağıdaki menüden ilgili kategoriyi seçerek bir destek talebi (ticket) oluşturabilirsin.\n\nYetkililerimiz en kısa sürede sana yardımcı olacaktır.')
            .setFooter({ text: 'Vance Roleplay Yönetim' });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Bir kategori seçin...')
            .addOptions(
                { label: 'Destek, Bug & Teknik Sorunlar', value: 'ticket_teknik', emoji: '🛠️' },
                { label: 'Oyun içi Sorunlar', value: 'ticket_oyunici', emoji: '🎮' },
                { label: 'AntiCheat', value: 'ticket_anticheat', emoji: '🛡️' },
                { label: 'Diğer Kategoriler', value: 'ticket_diger', emoji: '📌' }
            );

        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        await interaction.reply({ content: '✅ Ticket paneli kuruldu.', ephemeral: true });
    }
};
