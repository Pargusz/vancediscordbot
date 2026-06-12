const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { getWarnings } = require('../utils/store');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyarilar')
        .setDescription('Bir kullanıcının uyarılarını listeler.')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Uyarıları görüntülenecek kullanıcı').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const warnings = getWarnings(interaction.guild.id, user.id);

        if (warnings.length === 0) {
            return interaction.reply({ content: `ℹ️ **${user.tag}** kullanıcısının hiç uyarısı yok.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle(`⚠️ ${user.tag} — Uyarılar (${warnings.length})`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                warnings.map((w, i) => {
                    const date = new Date(w.date).toLocaleString('tr-TR');
                    return `**${i + 1}.** \`${w.id}\` — <@${w.moderatorId}>\n┗ ${w.reason}\n┗ *${date}*`;
                }).join('\n\n').slice(0, 4000)
            )
            .setFooter({ text: 'Silmek için: /uyarisil' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
