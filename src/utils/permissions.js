const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

/**
 * Üye yetkili mi? (Yönetici yetkisi VEYA staff rolü)
 */
function isStaff(member) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const staffRole = member.guild.roles.cache.find(r => r.name === config.staffRoleName);
    return staffRole ? member.roles.cache.has(staffRole.id) : false;
}

/**
 * Üye SADECE Administrator yetkisine sahip mi? (staff rolü yetmez)
 */
function isAdmin(member) {
    return !!member && member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Moderatör, hedef üyeye işlem yapabilir mi?
 * (Kendine, bota, daha yüksek/eşit rütbeye işlem engellenir.)
 * Hata varsa sebep string'i, sorun yoksa null döner.
 */
function canModerate(moderator, target) {
    if (!target) return 'Kullanıcı sunucuda bulunamadı.';
    if (target.id === moderator.id) return 'Kendine işlem uygulayamazsın.';
    if (target.id === moderator.guild.ownerId) return 'Sunucu sahibine işlem uygulanamaz.';
    if (target.user.bot) return 'Botlara bu işlem uygulanamaz.';
    if (moderator.id !== moderator.guild.ownerId &&
        target.roles.highest.position >= moderator.roles.highest.position) {
        return 'Bu kişi seninle eşit veya daha yüksek rütbede, işlem yapamazsın.';
    }
    return null;
}

module.exports = { isStaff, isAdmin, canModerate };
