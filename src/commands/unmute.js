const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Bir kullanıcının susturmasını kaldırır.')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Susturması kaldırılacak kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!target) return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: true });
        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ content: 'ℹ️ Bu kullanıcı zaten susturulmuş değil.', ephemeral: true });
        }

        await interaction.deferReply();
        try {
            await target.timeout(null, `${interaction.user.tag}: ${reason}`);
        } catch {
            return interaction.editReply('❌ İşlem başarısız oldu.');
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('🔊 Susturma Kaldırıldı')
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await sendLog(interaction.guild, 'moderation', embed);
    }
};
