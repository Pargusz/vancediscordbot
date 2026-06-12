const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { formatDuration } = require('../utils/duration');
const { addWarning } = require('../utils/store');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyar')
        .setDescription('Bir kullanıcıyı uyarır.')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Uyarılacak kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Uyarı sebebi').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep');
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (target) {
            const err = canModerate(interaction.member, target);
            if (err) return interaction.reply({ content: `❌ ${err}`, ephemeral: true });
        }

        await interaction.deferReply();

        const { count } = addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
        await user.send(`**${interaction.guild.name}** sunucusunda uyarı aldın. (Toplam: ${count})\n**Sebep:** ${reason}`).catch(() => {});

        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('⚠️ Kullanıcı Uyarıldı')
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Toplam Uyarı', value: `${count}`, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setTimestamp();

        // Otomatik ceza eşiği kontrolü
        const rule = config.warnActions.find(a => a.count === count);
        let autoMsg = '';
        if (rule && target) {
            try {
                if (rule.action === 'mute' && target.moderatable) {
                    await target.timeout(rule.duration, `Otomatik: ${count} uyarı`);
                    autoMsg = `🔇 Otomatik olarak **${formatDuration(rule.duration)}** susturuldu.`;
                } else if (rule.action === 'kick' && target.kickable) {
                    await target.kick(`Otomatik: ${count} uyarı`);
                    autoMsg = '👢 Otomatik olarak sunucudan atıldı.';
                } else if (rule.action === 'ban' && target.bannable) {
                    await interaction.guild.members.ban(user.id, { reason: `Otomatik: ${count} uyarı` });
                    autoMsg = '🔨 Otomatik olarak yasaklandı.';
                }
            } catch (e) {
                console.error('[uyar] Otomatik ceza uygulanamadı:', e.message);
            }
            if (autoMsg) embed.addFields({ name: 'Otomatik Ceza', value: autoMsg, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
        await sendLog(interaction.guild, 'moderation', embed);
    }
};
