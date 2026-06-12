const { Events } = require('discord.js');
const config = require('../config');
const { validateName } = require('../utils/icisim');
const { saveDirectMessage } = require('../firebase');

// Geçici onay/uyarı mesajını bir süre sonra siler
function autoDelete(msg, ms) {
    if (msg) setTimeout(() => msg.delete().catch(() => {}), ms);
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        if (!message.guild) {
            try {
                let content = message.content;
                let attachments = [];
                if (message.attachments.size > 0) {
                    attachments = message.attachments.map(a => a.url);
                    if (!content) content = '📷 Medya';
                }

                await saveDirectMessage(
                    message.author.id,
                    message.author.tag,
                    message.author.displayAvatarURL(),
                    content,
                    'incoming',
                    attachments
                );
            } catch (err) {
                console.error('[DM] Mesaj kaydedilemedi:', err.message);
            }
            return;
        }

        // Bu mesaj IC isim kanalında mı?
        const conf = config.icIsim;
        const inChannel = conf.channelId
            ? message.channel.id === conf.channelId
            : (message.channel.name === conf.channelName || message.channel.name.includes('ic-isim'));
        if (!inChannel) return;

        // Doğrulama
        const { ok, formatted, error } = validateName(message.content);
        if (!ok) {
            await message.react('⚠️').catch(() => {});
            const warn = await message.reply(`⚠️ ${error}`).catch(() => null);
            autoDelete(warn, 8000);
            autoDelete(message, 8000);
            return;
        }

        // Bot bu üyeyi yeniden adlandırabilir mi?
        const member = message.member;
        if (member && !member.manageable) {
            const sahip = member.id === message.guild.ownerId;
            const sebep = sahip
                ? 'Sunucu **sahibinin** ismini hiçbir bot değiştiremez (Discord kuralı). İsmini elle ayarlaman gerekiyor.'
                : 'Senin rolün botun rolünden yüksek olduğu için ismini değiştiremiyorum. Bir yetkili botun rolünü senin rolünün üstüne almalı.';
            const warn = await message.reply(`⚠️ ${sebep}`).catch(() => null);
            autoDelete(warn, 12000);
            return;
        }

        // --- Onay gerekmiyorsa: direkt ayarla ---
        if (!conf.requireApproval) {
            try {
                await member.setNickname(formatted, 'IC isim sistemi');
                await message.react('✅').catch(() => {});
                const okMsg = await message.reply(`✅ İsmin **${formatted}** olarak ayarlandı.`).catch(() => null);
                autoDelete(okMsg, 5000);
                autoDelete(message, 5000);
            } catch (err) {
                console.error('[IC İsim] Nickname ayarlanamadı:', err.message);
                const warn = await message.reply('❌ İsim ayarlanırken bir hata oluştu.').catch(() => null);
                autoDelete(warn, 8000);
            }
            return;
        }

        // --- Onay gerekiyorsa: mesajın altına onay/red emojileri ekle ---
        // Bir yetkili ✅ veya ❌ basınca messageReactionAdd event'i devreye girer.
        try {
            await message.react('✅');
            await message.react('❌');
        } catch (err) {
            console.error('[IC İsim] Emoji eklenemedi:', err.message);
        }
    }
};
