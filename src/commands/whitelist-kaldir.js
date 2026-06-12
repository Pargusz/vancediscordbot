const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist-kaldir')
        .setDescription('Whitelist kanal izinlerini geri alır (kanalları tekrar görünür yapar).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu sadece Administrator yetkisi olanlar kullanabilir.', ephemeral: true });
        }

        const guild = interaction.guild;
        const everyone = guild.roles.everyone;
        const whitelistRole = config.icIsim.whitelistRoleId ? guild.roles.cache.get(config.icIsim.whitelistRoleId) : null;
        const kayitsizRole = config.welcome.autoRoleId ? guild.roles.cache.get(config.welcome.autoRoleId) : null;

        await interaction.reply({ content: '⏳ Whitelist izinleri geri alınıyor...', ephemeral: true });

        let updated = 0, skipped = 0, failed = 0;

        for (const channel of guild.channels.cache.values()) {
            try {
                // Aktif ticket kanallarına dokunma
                if (channel.topic && /Açan:\s*\d+/.test(channel.topic)) { skipped++; continue; }

                // @everyone görüntüleme kısıtını kaldır (nötr yap)
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: null });
                // Eklenen rol izinlerini nötrle
                if (whitelistRole) await channel.permissionOverwrites.edit(whitelistRole, { ViewChannel: null });
                if (kayitsizRole) await channel.permissionOverwrites.edit(kayitsizRole, { ViewChannel: null, SendMessages: null });
                updated++;
            } catch (err) {
                console.error(`[whitelist-kaldir] ${channel.name} ayarlanamadı:`, err.message);
                failed++;
            }
        }

        const rapor = [
            '✅ **Whitelist izinleri geri alındı.**',
            `• Güncellenen kanal: **${updated}**`,
            `• Atlanan (aktif ticket): **${skipped}**`,
            failed ? `• Başarısız: **${failed}**` : null,
            '',
            'Kanallar artık varsayılan görünürlüğe döndü.'
        ].filter(Boolean).join('\n');

        await interaction.editReply({ content: rapor });
    }
};
