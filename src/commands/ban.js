const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bir kullanıcıyı sunucudan yasaklar.')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Yasaklanacak kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Yasaklama sebebi').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (target) {
            const err = canModerate(interaction.member, target);
            if (err) return interaction.reply({ content: `❌ ${err}`, ephemeral: true });
            if (!target.bannable) return interaction.reply({ content: '❌ Bu kullanıcıyı yasaklayamıyorum (rol hiyerarşisi/yetki).', ephemeral: true });
        }

        await interaction.deferReply();

        // DM ile bilgilendir (kapalıysa sorun değil)
        await user.send(`**${interaction.guild.name}** sunucusundan yasaklandın.\n**Sebep:** ${reason}`).catch(() => {});

        try {
            await interaction.guild.members.ban(user.id, { reason: `${interaction.user.tag}: ${reason}` });
        } catch {
            return interaction.editReply('❌ Yasaklama başarısız oldu.');
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.danger)
            .setTitle('🔨 Kullanıcı Yasaklandı')
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
