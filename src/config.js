/**
 * Merkezi ayar dosyası.
 * Kanal ve rol ayarlarını buradan yönetebilirsin.
 * ID girersen ID'ye göre, girmezsen aşağıdaki isimlere göre kanal/rol bulunur.
 */
module.exports = {
    // Yetkili rolü (ceza komutlarını kullanabilir; yoksa Yönetici yetkisi aranır)
    staffRoleName: 'V・Staff',

    // Log kanalları — .env'de ID verebilirsin, yoksa isimle aranır
    logChannels: {
        // Ceza/moderasyon logları
        moderation: { id: process.env.MOD_LOG_CHANNEL_ID || '', name: '🔴・ceza-kaydı' },
        // Silinen/düzenlenen mesaj logları
        message: { id: process.env.MESSAGE_LOG_CHANNEL_ID || '', name: 'mesaj-log' },
        // Üye giriş/çıkış, rol, isim logları
        member: { id: process.env.MEMBER_LOG_CHANNEL_ID || '', name: 'üye-log' },
        // Ses kanalı hareketleri
        voice: { id: process.env.VOICE_LOG_CHANNEL_ID || '', name: 'ses-log' }
    },

    // Hoşgeldin sistemi
    welcome: {
        enabled: process.env.WELCOME_ENABLED !== 'false',
        channelId: process.env.WELCOME_CHANNEL_ID || '',
        channelName: '👋・hoşgeldin',
        // Otomatik verilecek rol (boşsa verilmez)
        autoRoleId: process.env.AUTO_ROLE_ID || '',
        autoRoleName: ''
    },

    // Başvuru sistemi: doldurulardan başvurular bu kanala düşer
    basvuru: {
        reviewChannelId: process.env.BASVURU_CHANNEL_ID || '',
        reviewChannelName: '📢・form-başvuru-onay'
    },

    // IC isim sistemi: bu kanala isim yazan kullanıcının nickname'i ayarlanır
    icIsim: {
        channelId: process.env.IC_ISIM_CHANNEL_ID || '',
        channelName: '🪪・ic-isim',
        // true: yetkili ✅/❌ ile onaylar | false: direkt otomatik ayarlanır
        requireApproval: process.env.IC_ISIM_REQUIRE_APPROVAL !== 'false',
        // Onaylanınca verilecek whitelist rolü (diğer kanalları açar)
        whitelistRoleId: process.env.WHITELIST_ROLE_ID || '',
        // IC isim onaylanana kadar kişilerin nickname'i bu olur
        placeholder: process.env.IC_ISIM_PLACEHOLDER || 'IC İSİM'
        // Not: onaylanınca "Kayıtsız" rolü (welcome.autoRoleId) otomatik geri alınır
    },

    // Kayıtsız kişilerin (whitelist almamış) ic-isim dışında görebileceği
    // kategoriler. Kategori veya kanal adı bu anahtarlardan birini içeriyorsa
    // /whitelist-kur kayıtsız role de görüntüleme izni verir.
    publicCategoryKeywords: ['KURAL', 'DUYURU', 'DONATE', 'TICKET', 'DESTEK'],

    // Uyarı sistemi: belirli uyarı sayısına ulaşınca otomatik ceza
    // action: 'mute' | 'kick' | 'ban'  |  duration: mute için ms cinsinden
    warnActions: [
        { count: 3, action: 'mute', duration: 60 * 60 * 1000 }, // 3 uyarı -> 1 saat susturma
        { count: 5, action: 'ban' }                              // 5 uyarı -> ban
    ],

    // Renkler
    colors: {
        success: '#23a55a',
        danger: '#e74c3c',
        warning: '#f1c40f',
        info: '#5865F2',
        neutral: '#2b2d31'
    }
};
