const fs = require('fs');
const path = require('path');

/**
 * Basit JSON tabanlı kalıcı veri deposu (uyarılar vb. için).
 */
const dataDir = path.join(__dirname, '..', 'data');
const warningsFile = path.join(dataDir, 'warnings.json');

function ensureFile() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(warningsFile)) fs.writeFileSync(warningsFile, '{}', 'utf-8');
}

function readAll() {
    ensureFile();
    try {
        return JSON.parse(fs.readFileSync(warningsFile, 'utf-8') || '{}');
    } catch {
        return {};
    }
}

function writeAll(data) {
    ensureFile();
    fs.writeFileSync(warningsFile, JSON.stringify(data, null, 2), 'utf-8');
}

/** Bir kullanıcıya uyarı ekler, eklenen uyarıyı döner. */
function addWarning(guildId, userId, moderatorId, reason) {
    const data = readAll();
    const key = `${guildId}-${userId}`;
    if (!data[key]) data[key] = [];
    const warning = {
        id: Date.now().toString(36),
        moderatorId,
        reason: reason || 'Sebep belirtilmedi',
        date: new Date().toISOString()
    };
    data[key].push(warning);
    writeAll(data);
    return { warning, count: data[key].length };
}

/** Kullanıcının uyarılarını döner. */
function getWarnings(guildId, userId) {
    const data = readAll();
    return data[`${guildId}-${userId}`] || [];
}

/** Tek bir uyarıyı siler. Silindiyse true döner. */
function removeWarning(guildId, userId, warningId) {
    const data = readAll();
    const key = `${guildId}-${userId}`;
    if (!data[key]) return false;
    const before = data[key].length;
    data[key] = data[key].filter(w => w.id !== warningId);
    writeAll(data);
    return data[key].length < before;
}

/** Kullanıcının tüm uyarılarını temizler. */
function clearWarnings(guildId, userId) {
    const data = readAll();
    const key = `${guildId}-${userId}`;
    const count = data[key] ? data[key].length : 0;
    delete data[key];
    writeAll(data);
    return count;
}

module.exports = { addWarning, getWarnings, removeWarning, clearWarnings };
