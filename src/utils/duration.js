/**
 * "10m", "2h", "1d", "30s", "1h30m" gibi süreleri milisaniyeye çevirir.
 * Geçersizse null döner.
 */
function parseDuration(input) {
    if (!input) return null;
    const regex = /(\d+)\s*(s|sn|saniye|m|dk|dakika|h|sa|saat|d|g|gün|gun)/gi;
    let total = 0;
    let matched = false;
    let m;
    while ((m = regex.exec(input.toLowerCase())) !== null) {
        matched = true;
        const value = parseInt(m[1], 10);
        const unit = m[2];
        if (['s', 'sn', 'saniye'].includes(unit)) total += value * 1000;
        else if (['m', 'dk', 'dakika'].includes(unit)) total += value * 60 * 1000;
        else if (['h', 'sa', 'saat'].includes(unit)) total += value * 60 * 60 * 1000;
        else if (['d', 'g', 'gün', 'gun'].includes(unit)) total += value * 24 * 60 * 60 * 1000;
    }
    return matched ? total : null;
}

/** Milisaniyeyi okunabilir Türkçe metne çevirir. */
function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const min = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (d) parts.push(`${d} gün`);
    if (h) parts.push(`${h} saat`);
    if (min) parts.push(`${min} dakika`);
    if (s && !d && !h) parts.push(`${s} saniye`);
    return parts.join(' ') || '0 saniye';
}

module.exports = { parseDuration, formatDuration };
