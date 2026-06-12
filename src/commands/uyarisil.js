const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { removeWarning, clearWarnings } = require('../utils/store');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyarisil')
        .setDescription('Bir uyarıyı veya kullanıcının tüm uyarılarını siler.')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('uyari_id').setDescription('Silinecek uyarı ID (boşsa hepsi silinir)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const warningId = interaction.options.getString('uyari_id');

        let resultText;
        if (warningId) {
            const ok = removeWarning(interaction.guild.id, user.id, warningId);
            if (!ok) return interaction.reply({ content: `❌ \`${warningId}\` ID'li uyarı bulunamadı.`, ephemeral: true });
            resultText = `\`${warningId}\` ID'li uyarı silindi.`;
        } else {
            const count = clearWarnings(interaction.guild.id, user.id);
            if (count === 0) return interaction.reply({ content: 'ℹ️ Bu kullanıcının silinecek uyarısı yok.', ephemeral: true });
            resultText = `Tüm uyarılar silindi (${count} adet).`;
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('🗑️ Uyarı Silindi')
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'İşlem', value: resultText, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await sendLog(interaction.guild, 'moderation', embed);
    }
};
