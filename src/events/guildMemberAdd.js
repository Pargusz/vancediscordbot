const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // Üye log
        const logEmbed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('📥 Üye Katıldı')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Kullanıcı', value: `<@${member.id}> (${member.user.tag})`, inline: true },
                { name: 'Hesap Oluşturma', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Toplam Üye', value: `${member.guild.memberCount}`, inline: true }
            )
            .setTimestamp();
        await sendLog(member.guild, 'member', logEmbed);

        // Otomatik rol
        const w = config.welcome;
        if (w.autoRoleId || w.autoRoleName) {
            const role = w.autoRoleId
                ? member.guild.roles.cache.get(w.autoRoleId)
                : member.guild.roles.cache.find(r => r.name === w.autoRoleName);
            if (role) await member.roles.add(role).catch(e => console.error('[Otorol] Eklenemedi:', e.message));
        }

        // IC isim onaylanana kadar nickname'i placeholder yap
        const placeholder = config.icIsim.placeholder;
        if (placeholder && member.manageable) {
            await member.setNickname(placeholder, 'IC isim bekleniyor').catch(e => console.error('[IC İsim] Placeholder ayarlanamadı:', e.message));
        }

        // Hoşgeldin mesajı
        if (w.enabled) {
            const channel = w.channelId
                ? member.guild.channels.cache.get(w.channelId)
                : member.guild.channels.cache.find(c => c.name === w.channelName || c.name.includes('hoşgeldin') || c.name.includes('hosgeldin'));
            if (channel && channel.isTextBased()) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(config.colors.info)
                    .setTitle(`👋 Aramıza Hoş Geldin!`)
                    .setDescription(`Merhaba <@${member.id}>, **${member.guild.name}** sunucusuna hoş geldin!\nKuralları okumayı ve başvuru kanallarını incelemeyi unutma.`)
                    .setThumbnail(member.user.displayAvatarURL())
                    .setFooter({ text: `${member.guild.memberCount}. üyemizsin` })
                    .setTimestamp();
                await channel.send({ content: `<@${member.id}>`, embeds: [welcomeEmbed] }).catch(() => {});
            }
        }
    }
};
