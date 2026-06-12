const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const channelInfos = require('../channelInfos.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kurulum')
        .setDescription('Sunucuyu tamamen silip baştan yapılandırır (Kanallar, Roller, İzinler ve Ticket/Durum).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const lockFilePath = path.join(__dirname, '../../kurulum.lock');
        if (fs.existsSync(lockFilePath)) {
            return interaction.reply({ content: '⛔ **Güvenlik Kilidi Devrede:** Kurulum komutu daha önce kullanılmış ve kilitlenmiştir.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('Bu komut sadece sunucularda çalışır.');
        }

        try {
            await interaction.editReply('⏳ Sunucu sıfırlanıyor (Mevcut kanallar ve roller siliniyor)... Bu işlem biraz sürebilir.');

            // 1. KANALLARI SİL
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                if (id === interaction.channelId || id === interaction.channel?.parentId) {
                    continue; // Kendi kanalını ve kategorisini silme (şimdilik)
                }
                try {
                    await channel.delete('Otomatik kurulum sıfırlaması');
                } catch (e) {}
            }

            // 2. ROLLERİ SİL (Bot rolü ve @everyone hariç)
            const roles = await guild.roles.fetch();
            const botHighestRole = guild.members.me.roles.highest.position;
            
            let silinemeyenRoller = [];
            for (const [id, role] of roles) {
                if (role.name !== '@everyone' && !role.managed) {
                    if (role.position < botHighestRole) {
                        try {
                            await role.delete('Otomatik kurulum sıfırlaması');
                        } catch (e) {
                            silinemeyenRoller.push(role.name);
                        }
                    } else {
                        silinemeyenRoller.push(`${role.name} (Botun rolü bu rolün altında!)`);
                    }
                }
            }

            let temizlikMesaji = '✅ Temizlik bitti. Roller ve yetkiler oluşturuluyor...';
            if (silinemeyenRoller.length > 0) {
                temizlikMesaji += `\n⚠️ Bazı roller silinemedi (Sunucu Ayarlarından botun rolünü en üste taşıyın!):\n${silinemeyenRoller.join(', ')}`;
            }
            await interaction.editReply(temizlikMesaji);

            // 2.5 @everyone Rolünü Kısıtla
            const everyoneRole = guild.roles.everyone;
            await everyoneRole.setPermissions([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.UseVAD
            ], 'Güvenlik için varsayılan izinleri kısıtlama');

            // 3. ROLLERİ OLUŞTUR (Aşağıdan yukarıya doğru)
            const rolesToCreate = [
                { name: '・Kayıtsız', color: '#808080', perms: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ReadMessageHistory] },
                { name: '・Whitelisted', color: '#ffffff', perms: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ChangeNickname, PermissionFlagsBits.UseVAD] },
                { name: '🌸・Ladies', color: '#ff69b4', perms: [] },
                { name: 'Haftanın İşletmesi', color: '#ffff00', perms: [] },
                { name: 'Partners', color: '#00ffff', perms: [] },
                { name: '‹•›・AC Team', color: '#ff0000', perms: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages] },
                { name: '・Creative Team', color: '#9b59b6', perms: [] },
                { name: '・Event Team', color: '#f1c40f', perms: [] },
                { name: 'V・Event Manager', color: '#e67e22', perms: [PermissionFlagsBits.ManageEvents, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers] },
                { name: 'V・Staff', color: '#3498db', perms: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageNicknames] },
                { name: 'V・Senior Staff', color: '#2ecc71', perms: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
                { name: 'V・Head Moderator', color: '#1abc9c', perms: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
                { name: 'V・Trial Admin', color: '#e74c3c', perms: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
                { name: 'V・Admin', color: '#c0392b', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Head Admin', color: '#8e44ad', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Staff Manager', color: '#d35400', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Illegal Supervisor', color: '#2c3e50', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Legal Supervisor', color: '#34495e', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Executive', color: '#7f8c8d', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Developer', color: '#16a085', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Project Manager', color: '#f39c12', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Project Leader', color: '#d35400', perms: [PermissionFlagsBits.Administrator] },
                { name: 'V・Vance Webserver', color: '#000000', perms: [PermissionFlagsBits.Administrator] }
            ];

            const createdRoles = {};
            // Diziyi tersine çevirerek oluşturuyoruz ki "Vance Webserver" en üste çıksın, "Kayıtsız" en altta kalsın
            for (const roleData of rolesToCreate.reverse()) {
                const newRole = await guild.roles.create({
                    name: roleData.name,
                    color: roleData.color,
                    permissions: roleData.perms,
                    hoist: true,
                    reason: 'Otomatik kurulum rol oluşturma'
                });
                createdRoles[roleData.name] = newRole;
            }

            // everyoneRole is already defined above
            const whitelistedRole = createdRoles['・Whitelisted'];
            const staffRoles = [
                createdRoles['V・Event Manager'],
                createdRoles['V・Staff'],
                createdRoles['V・Senior Staff'],
                createdRoles['V・Head Moderator'],
                createdRoles['V・Trial Admin']
            ];
            
            const staffPerms = staffRoles.map(role => ({
                id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
            }));

            await interaction.editReply('✅ Roller oluşturuldu. Kanallar ve kategoriler inşa ediliyor...');

            // 4. KANALLARI OLUŞTUR
            let ticketChannelObj = null;
            let statusChannelObj = null;

            const structure = [
                {
                    name: 'TICKET SİSTEMİ',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel] }
                    ],
                    channels: [
                        { name: '🔍・anticheat-bilgilendirme', type: ChannelType.GuildText, permissions: [{ id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '🎟️・ticket-oluştur', type: ChannelType.GuildText, permissions: [{ id: everyoneRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                    ]
                },
                {
                    name: 'DUYURULAR',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '📢・genel-duyurular', type: ChannelType.GuildText },
                        { name: '📢・yayın-duyuru', type: ChannelType.GuildText },
                        { name: '🎊・etkinlik-duyuru', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'DESTEK ALANI',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '📞・destek-çağrısı', type: ChannelType.GuildText },
                        { name: '🔴・ceza-kaydı', type: ChannelType.GuildText },
                        { name: '🔴・ceza-takip', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'KURALLAR',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '📚・kural-güncellemeleri', type: ChannelType.GuildText },
                        { name: '📚・kurallar-bilgilendirme', type: ChannelType.GuildText },
                        { name: '👗👶・karakter-kıyafet-kuralları', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'MOTORCYCLE CLUB',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '☠️・mc-bilgilendirme', type: ChannelType.GuildText },
                        { name: '☠️・mc-kuralları', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'IC İSİM & PERM',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: whitelistedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '🪪・ic-isim', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'Vance Roleplay',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: whitelistedRole.id, allow: [PermissionFlagsBits.ViewChannel] }
                    ],
                    channels: [
                        { name: '⚽・skor-tahmini', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📢・sunucu-durum', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '💬・genel-sohbet', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '💻・güncellemeler', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📢・form-başvuru-onay', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📰・başvuru-kanalı', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📜・bug-bildiri', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '🟠・vance-istek-öneri', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '🏎️・handling-bildiri', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📰・karakter-hikayesi', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '🔊・Sohbet I', type: ChannelType.GuildVoice, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] },
                        { name: '🔊・Sohbet II', type: ChannelType.GuildVoice, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] },
                        { name: '🔊・Sohbet III', type: ChannelType.GuildVoice, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] },
                        { name: '🔊・Sohbet IV', type: ChannelType.GuildVoice, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] },
                    ]
                },
                {
                    name: 'MEDYA',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: whitelistedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '📷・şehirden-kareler', type: ChannelType.GuildText },
                        { name: '📷・yapay-zeka-fotoğraf', type: ChannelType.GuildText },
                        { name: '🐦・birdy', type: ChannelType.GuildText },
                        { name: '📷・instapick', type: ChannelType.GuildText },
                        { name: '📷・fotoğraf-yarışması', type: ChannelType.GuildText },
                        { name: '🎥・içerik-üreticilerimiz', type: ChannelType.GuildText },
                        { name: '📷・sosyal-medya', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'WEAZEL NEWS',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: whitelistedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '📰・şehirden-haberler', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'DONATE',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
                    ],
                    channels: [
                        { name: '📄・donate-bilgilendirme', type: ChannelType.GuildText },
                    ]
                },
                {
                    name: 'LEGAL KATEGORİ',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: whitelistedRole.id, allow: [PermissionFlagsBits.ViewChannel] }
                    ],
                    channels: [
                        { name: '📄・doj-duyuru', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📰・mahkeme-bildiri', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📢・silah-ruhsatı-kuralları', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '✍️・sicil-saglik-raporu', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                    ]
                },
                {
                    name: 'İLLEGAL KATEGORİ',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: whitelistedRole.id, allow: [PermissionFlagsBits.ViewChannel] }
                    ],
                    channels: [
                        { name: '📢・illegal-duyuru', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, deny: [PermissionFlagsBits.SendMessages] }] },
                        { name: '📢・illegal-ipucu', type: ChannelType.GuildText, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.SendMessages] }] },
                        { name: '🔊・Illegal Toplantı', type: ChannelType.GuildVoice, permissions: [{ id: whitelistedRole.id, allow: [PermissionFlagsBits.Connect] }] },
                    ]
                },
                {
                    name: 'YETKİLİ ODALARI',
                    type: ChannelType.GuildCategory,
                    permissions: [
                        { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
                        ...staffPerms
                    ],
                    channels: [
                        { name: '⚜️・YETKİLİ TOPLANTISI', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 1', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 2', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 3', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 4', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 5', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 6', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 7', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 8', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 9', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 10', type: ChannelType.GuildVoice },
                        { name: '🔴・Aktif Yetkili 11', type: ChannelType.GuildVoice },
                        { name: '🌟・Event Team', type: ChannelType.GuildVoice },
                        { name: '🎧・Destek Bekleme', type: ChannelType.GuildVoice },
                        { name: '📜・ticket-log', type: ChannelType.GuildText }
                    ]
                }
            ];

            let catIndex = 0;
            for (const cat of structure) {
                const categoryObj = await guild.channels.create({
                    name: cat.name,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: cat.permissions || [],
                    position: catIndex++
                });

                for (const ch of cat.channels) {
                    const createdChannel = await guild.channels.create({
                        name: ch.name,
                        type: ch.type,
                        parent: categoryObj.id,
                        permissionOverwrites: ch.permissions ? [...(cat.permissions || []), ...ch.permissions] : (cat.permissions || [])
                    });

                    // Eğer kanalın özel bir bilgilendirme metni varsa ve metin kanalıysa
                    if ((ch.type === ChannelType.GuildText) && channelInfos[ch.name]) {
                        try {
                            const infoEmbed = new EmbedBuilder()
                                .setColor('#2b2d31')
                                .setTitle('📌 Kanal Bilgilendirmesi')
                                .setDescription(channelInfos[ch.name])
                                .setFooter({ text: 'Vance Roleplay Yönetim' });

                            const infoMessage = await createdChannel.send({ embeds: [infoEmbed] });
                            await infoMessage.pin();
                            
                            // Rate limit'e takılmamak için kısa bir bekleme süresi
                            await new Promise(r => setTimeout(r, 600));
                        } catch (err) {
                            console.error(`Bilgilendirme mesaji gonderilemedi: ${ch.name}`, err);
                        }
                    }

                    if (ch.name === '🎟️・ticket-oluştur') {
                        ticketChannelObj = createdChannel;
                    }
                    if (ch.name === '📢・sunucu-durum') {
                        statusChannelObj = createdChannel;
                    }
                }
            }

            // 5. TICKET EMBED GÖNDERİMİ (Gelişmiş Seçenekli)
            if (ticketChannelObj) {
                const ticketEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('Destek Sistemi')
                    .setDescription('**Vance Roleplay**\n\n✨ **Destek Sistemi Hakkında:**\nAşağıdaki seçeneklerden uygun olanı seçerek hemen bir ticket oluşturabilirsiniz.\n\n🔗 **Sunucu Bilgisi:**\nSunucumuzun kurallarını okumayı unutmayın.')
                    .setFooter({ text: 'Vance Roleplay Yönetim Sistemi' })
                    .setTimestamp();

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Ticket Açmak İçin Kategori Seçiniz.')
                    .addOptions(
                        {
                            label: 'Destek, Bug & Teknik Sorunlar',
                            description: 'Oyun Dışı Sorunlar için açınız.',
                            emoji: '🛠️',
                            value: 'ticket_teknik',
                        },
                        {
                            label: 'Oyun içi Sorunlar & Rol Hataları',
                            description: 'Oyun içi Sorunlar için açınız.',
                            emoji: '🎮',
                            value: 'ticket_oyunici',
                        },
                        {
                            label: 'AntiCheat',
                            description: 'AntiCheat ile ilgili konular için açınız.',
                            emoji: '🛡️',
                            value: 'ticket_anticheat',
                        },
                        {
                            label: 'Diğer Kategoriler',
                            description: 'Sebebiniz Eğer Burada Yoksa, Bu Kategoride Ticket Açın.',
                            emoji: '📁',
                            value: 'ticket_diger',
                        },
                        {
                            label: 'Seçenek Sıfırla',
                            description: 'Seçenekleri Sıfırlamanıza Yarar.',
                            emoji: '🧹',
                            value: 'ticket_sifirla',
                        },
                    );

                const ticketRow = new ActionRowBuilder().addComponents(selectMenu);
                await ticketChannelObj.send({ embeds: [ticketEmbed], components: [ticketRow] });
            }

            // 6. SUNUCU DURUM EMBED GÖNDERİMİ
            if (statusChannelObj) {
                const statusEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('Vance Roleplay')
                    .setDescription('Sunucumuz artık **Aktif**, sunucuya giriş sağlayabilirsiniz.\n\n✨ **Sunucu Durumu:** Aktif\n📡 **Sunucu IP Adresi:** `connect play.vanceroleplay.com`')
                    .setImage('https://media.discordapp.net/attachments/1194688784470650950/1194688784470650950/vance_banner.gif') // Placeholder
                    .setFooter({ text: 'Vance Roleplay Sistemleri' })
                    .setTimestamp();

                const statusRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Sunucuya Bağlan (FiveM)')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('dummy_connect_btn')
                            .setDisabled(true)
                    );

                await statusChannelObj.send({ embeds: [statusEmbed], components: [statusRow] });
            }

            try {
                await interaction.editReply('✅ Sunucu kurulumu başarıyla tamamlandı! Tüm eski kanallar silindi, yeni yetkiler ayarlandı, Ticket sistemi ve Sunucu Durum mesajı gönderildi.\n\n⚠️ **Bu kanal 5 saniye içinde kendini imha edecektir.**');
                
                setTimeout(async () => {
                    try {
                        const myChannel = await guild.channels.fetch(interaction.channelId).catch(() => null);
                        if (myChannel) {
                            const myCategory = myChannel.parentId ? await guild.channels.fetch(myChannel.parentId).catch(() => null) : null;
                            await myChannel.delete('Kurulum bitişi - Kendi kendini imha');
                            if (myCategory) await myCategory.delete('Kurulum bitişi - Kategori imhası');
                        }
                    } catch (e) {
                        console.log("Kendi kanalını silerken hata oluştu.");
                    }
                }, 5000);

                // Başarılı kurulum sonrası kilit dosyasını oluştur
                fs.writeFileSync(lockFilePath, 'Bu dosya kurulumun tekrar calismasini engellemek icin otomatik olusturulmustur.');

            } catch (e) {
                console.log("Edit reply atılamadı, ancak kurulum tamamlandı.");
            }

        } catch (error) {
            console.error('Kurulum sirasinda hata:', error);
            await interaction.editReply('Kurulum sırasında bir hata oluştu. Konsolu kontrol edin.');
        }
    },
};
