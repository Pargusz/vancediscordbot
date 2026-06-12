const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        // İsim (nickname) değişimi
        if (oldMember.nickname !== newMember.nickname) {
            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('📝 İsim Değiştirildi')
                .addFields(
                    { name: 'Kullanıcı', value: `<@${newMember.id}>`, inline: true },
                    { name: 'Önceki', value: oldMember.nickname || '*(yok)*', inline: true },
                    { name: 'Yeni', value: newMember.nickname || '*(yok)*', inline: true }
                )
                .setTimestamp();
            await sendLog(newMember.guild, 'member', embed);
        }

        // Rol değişimi
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const added = newRoles.filter(r => !oldRoles.has(r.id));
        const removed = oldRoles.filter(r => !newRoles.has(r.id));

        if (added.size > 0 || removed.size > 0) {
            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('🎭 Rol Değişikliği')
                .addFields({ name: 'Kullanıcı', value: `<@${newMember.id}> (${newMember.user.tag})` })
                .setTimestamp();
            if (added.size > 0) embed.addFields({ name: '➕ Eklenen', value: [...added.values()].map(r => `<@&${r.id}>`).join(', ').slice(0, 1024) });
            if (removed.size > 0) embed.addFields({ name: '➖ Alınan', value: [...removed.values()].map(r => `<@&${r.id}>`).join(', ').slice(0, 1024) });
            await sendLog(newMember.guild, 'member', embed);
        }
    }
};
