const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('basvuru-panel')
        .setDescription('Bu kanala başvuru (whitelist/kurum) panelini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('📋 Başvuru Sistemi')
            .setDescription('Aşağıdaki butonlardan başvurmak istediğin alanı seçerek başvuru formunu doldurabilirsin. Başvurun yetkililer tarafından değerlendirilecektir.')
            .addFields(
                { name: '🚓 Polis (LSPD)', value: 'Emniyet teşkilatı başvurusu', inline: true },
                { name: '🚑 Sağlık (EMS)', value: 'Hastane / sağlık ekibi başvurusu', inline: true },
                { name: '✅ Whitelist', value: 'Sunucu giriş başvurusu', inline: true }
            )
            .setFooter({ text: 'Vance Roleplay Yönetim' });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('basvuru_polis').setLabel('Polis').setStyle(ButtonStyle.Primary).setEmoji('🚓'),
            new ButtonBuilder().setCustomId('basvuru_ems').setLabel('Sağlık').setStyle(ButtonStyle.Success).setEmoji('🚑'),
            new ButtonBuilder().setCustomId('basvuru_whitelist').setLabel('Whitelist').setStyle(ButtonStyle.Secondary).setEmoji('✅')
        );

        await interaction.channel.send({ embeds: [embed], components: [buttons] });
        await interaction.reply({ content: '✅ Başvuru paneli kuruldu.', ephemeral: true });
    }
};
