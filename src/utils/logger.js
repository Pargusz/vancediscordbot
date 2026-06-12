const config = require('../config');

/**
 * Log kanalını bulur. Önce config'deki ID'ye, sonra isme bakar.
 * @param {Guild} guild
 * @param {'moderation'|'message'|'member'|'voice'} type
 */
function getLogChannel(guild, type) {
    if (!guild) return null;
    const conf = config.logChannels[type];
    if (!conf) return null;

    let channel = null;
    if (conf.id) {
        channel = guild.channels.cache.get(conf.id);
    }
    if (!channel && conf.name) {
        channel = guild.channels.cache.find(
            c => c.name === conf.name || c.name.includes(conf.name)
        );
    }
    return channel || null;
}

/**
 * Belirtilen log kanalına embed gönderir (kanal yoksa sessizce geçer).
 */
async function sendLog(guild, type, embed) {
    try {
        const channel = getLogChannel(guild, type);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error(`[Logger] ${type} logu gönderilemedi:`, err.message);
    }
}

module.exports = { getLogChannel, sendLog };
