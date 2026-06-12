const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist-kur')
        .setDescription('Kanal izinlerini whitelist sistemine göre otomatik ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const guild = interaction.guild;
        const everyone = guild.roles.everyone;
        const whitelistRoleId = config.icIsim.whitelistRoleId;
        const kayitsizRoleId = config.welcome.autoRoleId;
        const staffRole = guild.roles.cache.find(r => r.name === config.staffRoleName);

        // Roller mevcut mu?
        const whitelistRole = whitelistRoleId ? guild.roles.cache.get(whitelistRoleId) : null;
        const kayitsizRole = kayitsizRoleId ? guild.roles.cache.get(kayitsizRoleId) : null;
        if (!whitelistRole) return interaction.reply({ content: '❌ Whitelist rolü bulunamadı. `.env` içindeki `WHITELIST_ROLE_ID` doğru mu?', ephemeral: true });
        if (!kayitsizRole) return interaction.reply({ content: '❌ Kayıtsız rolü bulunamadı. `.env` içindeki `AUTO_ROLE_ID` doğru mu?', ephemeral: true });

        // IC isim kanalı
        const icIsimId = config.icIsim.channelId;
        const icChannel = icIsimId
            ? guild.channels.cache.get(icIsimId)
            : guild.channels.cache.find(c => c.name === config.icIsim.channelName || c.name.includes('ic-isim'));

        await interaction.reply({ content: '⏳ Kanal izinleri ayarlanıyor, bu biraz sürebilir...', ephemeral: true });

        // Kayıtsızın görebileceği "public" kanal mı? (kategori/kanal adına göre)
        const keywords = (config.publicCategoryKeywords || []).map(k => k.toLocaleUpperCase('tr-TR'));
        const isPublic = (channel) => {
            const catName = channel.type === ChannelType.GuildCategory
                ? channel.name
                : (channel.parent ? channel.parent.name : '');
            const text = `${catName} ${channel.name}`.toLocaleUpperCase('tr-TR');
            return keywords.some(k => text.includes(k));
        };

        let updated = 0, skipped = 0, failed = 0, publicCount = 0;

        for (const channel of guild.channels.cache.values()) {
            try {
                // Aktif ticket kanallarına dokunma (topic'inde "Açan: id" olur)
                if (channel.topic && /Açan:\s*\d+/.test(channel.topic)) { skipped++; continue; }

                // Her kanalda @everyone gizli, staff her zaman görür
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
                if (staffRole) await channel.permissionOverwrites.edit(staffRole, { ViewChannel: true });

                // IC isim kanalı: sadece kayıtsız görür+yazar
                if (icChannel && channel.id === icChannel.id) {
                    await channel.permissionOverwrites.edit(kayitsizRole, { ViewChannel: true, SendMessages: true });
                    updated++;
                    continue;
                }

                // Public kanal: hem kayıtsız hem whitelist görür
                if (isPublic(channel)) {
                    await channel.permissionOverwrites.edit(kayitsizRole, { ViewChannel: true });
                    await channel.permissionOverwrites.edit(whitelistRole, { ViewChannel: true });
                    publicCount++;
                } else {
                    // Sadece whitelist görür, kayıtsız göremez
                    await channel.permissionOverwrites.edit(whitelistRole, { ViewChannel: true });
                    await channel.permissionOverwrites.edit(kayitsizRole, { ViewChannel: false });
                }
                updated++;
            } catch (err) {
                console.error(`[whitelist-kur] ${channel.name} ayarlanamadı:`, err.message);
                failed++;
            }
        }

        const rapor = [
            '✅ **Whitelist izinleri kuruldu!**',
            `• Güncellenen kanal: **${updated}**`,
            `• Kayıtsıza açık (public): **${publicCount}**`,
            `• Atlanan (aktif ticket): **${skipped}**`,
            failed ? `• Başarısız: **${failed}** (botun rol sırası/yetkisini kontrol et)` : null,
            '',
            `🪪 IC isim + public kanallar **${kayitsizRole.name}** rolüne açık.`,
            `🔓 Diğer tüm kanallar **${whitelistRole.name}** rolüne açık.`,
            staffRole ? `🛡️ **${staffRole.name}** her kanalı görür.` : '⚠️ Staff rolü bulunamadı — yetkililerin Administrator yetkisi olduğundan emin ol.'
        ].filter(Boolean).join('\n');

        await interaction.editReply({ content: rapor });
    }
};
