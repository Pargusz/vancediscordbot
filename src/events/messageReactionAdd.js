const { Events } = require('discord.js');
const config = require('../config');
const { validateName } = require('../utils/icisim');
const { isStaff } = require('../utils/permissions');

function autoDelete(msg, ms) {
    if (msg) setTimeout(() => msg.delete().catch(() => {}), ms);
}

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        // Sadece onay (✅) ve red (❌) emojileriyle ilgilen
        const emoji = reaction.emoji.name;
        if (emoji !== '✅' && emoji !== '❌') return;

        // Partial verileri tamamla
        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
        } catch {
            return;
        }

        const message = reaction.message;
        if (!message.guild) return;

        // IC isim kanalında mı?
        const conf = config.icIsim;
        const inChannel = conf.channelId
            ? message.channel.id === conf.channelId
            : (message.channel.name === conf.channelName || message.channel.name.includes('ic-isim'));
        if (!inChannel) return;

        // Bu mesaj geçerli bir IC isim talebi mi? (içerik doğrulanmalı)
        const { ok, formatted } = validateName(message.content);
        if (!ok) return;

        // Tepki veren yetkili mi?
        const staffMember = await message.guild.members.fetch(user.id).catch(() => null);
        if (!staffMember || !isStaff(staffMember)) {
            // Yetkisiz tepkiyi kaldır (mümkünse), işlem yapma
            await reaction.users.remove(user.id).catch(() => {});
            return;
        }

        // Talebi yazan kullanıcı
        const targetUser = message.author;
        if (!targetUser) return;

        // Tekrar işlenmesini önlemek için emojileri temizle
        await message.reactions.removeAll().catch(() => {});

        if (emoji === '✅') {
            const target = await message.guild.members.fetch(targetUser.id).catch(() => null);
            if (!target) {
                const w = await message.channel.send(`❌ <@${targetUser.id}> sunucuda bulunamadı, isim ayarlanamadı.`).catch(() => null);
                return autoDelete(w, 8000);
            }
            if (!target.manageable) {
                const w = await message.channel.send(`❌ <@${targetUser.id}> kişisinin ismini değiştiremiyorum (rol hiyerarşisi).`).catch(() => null);
                return autoDelete(w, 8000);
            }
            try {
                await target.setNickname(formatted, `IC isim onayı: ${user.tag}`);
            } catch (err) {
                console.error('[IC İsim] Onayda nickname ayarlanamadı:', err.message);
                const w = await message.channel.send('❌ İsim ayarlanırken hata oluştu.').catch(() => null);
                return autoDelete(w, 8000);
            }

            // Whitelist rolü ver, "Kayıtsız" rolünü geri al
            const whitelistRoleId = conf.whitelistRoleId;
            const kayitsizRoleId = config.welcome.autoRoleId;
            if (whitelistRoleId) {
                await target.roles.add(whitelistRoleId, 'IC isim onayı - whitelist').catch(e => console.error('[IC İsim] Whitelist rolü verilemedi:', e.message));
            }
            if (kayitsizRoleId && target.roles.cache.has(kayitsizRoleId)) {
                await target.roles.remove(kayitsizRoleId, 'IC isim onayı - kayıtsız rolü alındı').catch(e => console.error('[IC İsim] Kayıtsız rolü alınamadı:', e.message));
            }

            // Onaylanan talep kanalda kalsın (silinmez), sadece ✅ tepkisiyle işaretle
            await message.react('✅').catch(() => {});
            await message.channel.send(`✅ <@${targetUser.id}> ismin **${formatted}** olarak ayarlandı${whitelistRoleId ? ' ve whitelist rolün verildi' : ''}. (Onaylayan: <@${user.id}>)`).catch(() => null);
            await targetUser.send(`✅ **${message.guild.name}** IC isim talebin **onaylandı**! İsmin **${formatted}** olarak ayarlandı.`).catch(() => {});
        } else {
            // Reddedilen talep de kanalda kalsın, ❌ ile işaretle
            await message.react('❌').catch(() => {});
            await message.channel.send(`❌ <@${targetUser.id}> IC isim talebin reddedildi. Lütfen gerçekçi bir isimle tekrar dene. (Reddeden: <@${user.id}>)`).catch(() => null);
            await targetUser.send(`❌ **${message.guild.name}** IC isim talebin **reddedildi**. Lütfen gerçekçi bir isimle (Örn: John Doe) tekrar dene.`).catch(() => {});
        }
    }
};
