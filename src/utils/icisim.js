/**
 * IC isim sistemi için ortak yardımcılar.
 */

/**
 * İsmi düzgün biçime getirir: fazla boşlukları temizler, her kelimenin
 * baş harfini büyütür. ("john   DOE" -> "John Doe")
 */
function formatName(input) {
    return input
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
        .join(' ');
}

/**
 * İsmi doğrular. { ok, formatted, error } döner.
 * Kural: sadece harf+boşluk, 2-4 kelime (ad soyad), 3-32 karakter.
 */
function validateName(raw) {
    const text = (raw || '').trim();
    const validChars = /^[A-Za-zÇĞİıÖŞÜçğöşü ]+$/.test(text);
    const words = text.split(/\s+/).filter(Boolean);
    const formatted = formatName(text);

    let error = null;
    if (!text) error = 'İsim boş olamaz.';
    else if (!validChars) error = 'İsim sadece harflerden oluşmalı (rakam/sembol olmaz).';
    else if (words.length < 2) error = 'Lütfen **Ad Soyad** şeklinde yaz. Örn: `John Doe`';
    else if (words.length > 4) error = 'İsim en fazla 4 kelime olabilir.';
    else if (formatted.length < 3 || formatted.length > 32) error = 'İsim 3-32 karakter arasında olmalı.';

    return { ok: !error, formatted, error };
}

module.exports = { formatName, validateName };
