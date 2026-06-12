const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const roles = member.roles && member.roles.cache
            ? [...member.roles.cache.filter(r => r.id !== member.guild.id).values()].map(r => `<@&${r.id}>`).join(', ')
            : '';

        const embed = new EmbedBuilder()
            .setColor(config.colors.danger)
            .setTitle('📤 Üye Ayrıldı')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Kullanıcı', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: 'Toplam Üye', value: `${member.guild.memberCount}`, inline: true }
            )
            .setTimestamp();

        if (roles) embed.addFields({ name: 'Sahip Olduğu Roller', value: roles.slice(0, 1024) });

        await sendLog(member.guild, 'member', embed);
    }
};
