const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temizle')
        .setDescription('Kanaldaki mesajları toplu siler (max 100).')
        .addIntegerOption(o => o.setName('miktar').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('kullanıcı').setDescription('Sadece bu kullanıcının mesajları').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const amount = interaction.options.getInteger('miktar');
        const user = interaction.options.getUser('kullanıcı');

        await interaction.deferReply({ ephemeral: true });

        let messages = await interaction.channel.messages.fetch({ limit: 100 });
        // 14 günden eski mesajlar toplu silinemez
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);
        if (user) messages = messages.filter(m => m.author.id === user.id);

        const toDelete = [...messages.values()].slice(0, amount);
        if (toDelete.length === 0) {
            return interaction.editReply('ℹ️ Silinecek uygun mesaj bulunamadı (14 günden eski mesajlar silinemez).');
        }

        let deleted;
        try {
            deleted = await interaction.channel.bulkDelete(toDelete, true);
        } catch {
            return interaction.editReply('❌ Mesajlar silinemedi.');
        }

        await interaction.editReply(`✅ **${deleted.size}** mesaj silindi.${user ? ` (Sadece ${user.tag})` : ''}`);

        const embed = new EmbedBuilder()
            .setColor(config.colors.neutral)
            .setTitle('🧹 Mesajlar Temizlendi')
            .addFields(
                { name: 'Kanal', value: `<#${interaction.channel.id}>`, inline: true },
                { name: 'Adet', value: `${deleted.size}`, inline: true },
                { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
        if (user) embed.addFields({ name: 'Hedef Kullanıcı', value: user.tag, inline: true });

        await sendLog(interaction.guild, 'moderation', embed);
    }
};
