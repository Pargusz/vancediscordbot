require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const discordTranscripts = require('discord-html-transcripts');
const { startWebPanel } = require('./webpanel');
const startWebServer = require('./web');
const { saveTicketLog, updateAdminStats, saveApplication } = require('./firebase');

global.ticketClosingData = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User, Partials.Reaction]
});

client.commands = new Collection();
const commandsArray = [];

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsArray.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load events (logging, welcome, etc.)
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (!event.name || !event.execute) continue;
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('Vance Roleplay Yönetim', { type: 0 });

    // Web paneli başlat
    startWebPanel(client);
    startWebServer(client);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log(`Started refreshing ${commandsArray.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsArray },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Bir hata oluştu!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true });
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select') {
            const secilenDeger = interaction.values[0];
            if (secilenDeger === 'ticket_sifirla') {
                await interaction.deferUpdate();
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            const category = guild.channels.cache.find(c => c.name === 'TICKET SİSTEMİ' && c.type === 4);
            const staffRole = guild.roles.cache.find(r => r.name === 'V・Staff');
            const everyoneRole = guild.roles.everyone;

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
            if (existingChannel) {
                return interaction.editReply(`Zaten açık bir destek talebiniz bulunuyor: <#${existingChannel.id}>`);
            }

            try {
                const permissionOverwrites = [
                    { id: everyoneRole.id, deny: [1024n] },
                    { id: interaction.user.id, allow: [1024n, 2048n, 8192n, 65536n] } // ViewChannel, SendMessages, ManageMessages, ReadMessageHistory
                ];

                if (staffRole) {
                    permissionOverwrites.push({ id: staffRole.id, allow: [1024n, 2048n, 8192n, 65536n] });
                }

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: 0,
                    parent: category ? category.id : null,
                    permissionOverwrites: permissionOverwrites,
                    topic: `Açan: ${interaction.user.id}`
                });

                const embed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('Destek Talebi')
                    .setDescription(`Merhaba <@${interaction.user.id}>, destek talebiniz başarıyla oluşturuldu.\nLütfen sorununuzu detaylı bir şekilde açıklayın. Yetkililerimiz en kısa sürede size yardımcı olacaktır.`)
                    .addFields({ name: 'Kategori', value: secilenDeger === 'ticket_teknik' ? 'Destek, Bug & Teknik Sorunlar' : secilenDeger === 'ticket_oyunici' ? 'Oyun içi Sorunlar' : secilenDeger === 'ticket_anticheat' ? 'AntiCheat' : 'Diğer Kategoriler', inline: true });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Ticketi Üstlen').setStyle(ButtonStyle.Success).setEmoji('✋'),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket\'ı Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({ content: `<@${interaction.user.id}> ${staffRole ? `<@&${staffRole.id}>` : ''}`, embeds: [embed], components: [buttons] });
                await interaction.editReply(`Destek talebiniz başarıyla oluşturuldu: <#${ticketChannel.id}>`);
            } catch (error) {
                console.error(error);
                await interaction.editReply('Ticket kanalı oluşturulurken bir hata meydana geldi.');
            }
        }
    } else if (interaction.isButton()) {
        // --- Başvuru sistemi: form açma ---
        if (['basvuru_polis', 'basvuru_ems', 'basvuru_whitelist'].includes(interaction.customId)) {
            const tip = interaction.customId.replace('basvuru_', '');
            const baslik = tip === 'polis' ? 'Polis (LSPD) Başvurusu' : tip === 'ems' ? 'Sağlık (EMS) Başvurusu' : 'Whitelist Başvurusu';

            const modal = new ModalBuilder().setCustomId(`basvuru_modal_${tip}`).setTitle(baslik.slice(0, 45));
            const isim = new TextInputBuilder().setCustomId('b_isim').setLabel('Ad Soyad / Yaş').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Örn: John Doe / 18');
            const karakter = new TextInputBuilder().setCustomId('b_karakter').setLabel('Karakter İsmi (IC)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Oyun içi karakter ismin');
            const deneyim = new TextInputBuilder().setCustomId('b_deneyim').setLabel('RP Deneyimin').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Daha önce nerelerde oynadın?');
            const sebep = new TextInputBuilder().setCustomId('b_sebep').setLabel('Neden başvuruyorsun?').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(isim),
                new ActionRowBuilder().addComponents(karakter),
                new ActionRowBuilder().addComponents(deneyim),
                new ActionRowBuilder().addComponents(sebep)
            );
            return interaction.showModal(modal);
        }

        // --- Başvuru sistemi: onay / red ---
        if (interaction.customId.startsWith('basvuru_onayla_') || interaction.customId.startsWith('basvuru_reddet_')) {
            const staffRole = interaction.guild.roles.cache.find(r => r.name === 'V・Staff');
            if (!staffRole || (!interaction.member.roles.cache.has(staffRole.id) && !interaction.member.permissions.has(8n))) {
                return interaction.reply({ content: 'Bu başvuruyu sadece yetkililer değerlendirebilir!', ephemeral: true });
            }

            const onaylandi = interaction.customId.startsWith('basvuru_onayla_');
            const applicantId = interaction.customId.split('_').pop();

            const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(onaylandi ? '#23a55a' : '#e74c3c')
                .addFields({ name: onaylandi ? '✅ Onaylandı' : '❌ Reddedildi', value: `Yetkili: <@${interaction.user.id}>` });

            await interaction.update({ embeds: [oldEmbed], components: [] });

            const applicant = await client.users.fetch(applicantId).catch(() => null);
            if (applicant) {
                await applicant.send(
                    onaylandi
                        ? `🎉 **${interaction.guild.name}** başvurun **onaylandı**! Tebrikler.`
                        : `😔 **${interaction.guild.name}** başvurun maalesef **reddedildi**. Tekrar deneyebilirsin.`
                ).catch(() => {});
            }
            return;
        }

        if (interaction.customId === 'claim_ticket') {
            const staffRole = interaction.guild.roles.cache.find(r => r.name === 'V・Staff');
            if (!staffRole || !interaction.member.roles.cache.has(staffRole.id) && !interaction.member.permissions.has(8n)) {
                return interaction.reply({ content: 'Bu butonu sadece yetkililer kullanabilir!', ephemeral: true });
            }

            await interaction.deferReply();
            
            // Kullanıcı dışındaki herkesin (V・Staff dahil) görmesini engelle, sadece butona basan yetkiliye ve ticketı açana izin ver.
            // Ticketı açanın kim olduğunu topic'den bulalım.
            const creatorIdMatch = interaction.channel.topic ? interaction.channel.topic.match(/Açan: (\d+)/) : null;
            const creatorId = creatorIdMatch ? creatorIdMatch[1] : null;

            const newPerms = [
                { id: interaction.guild.roles.everyone.id, deny: [1024n] },
                { id: interaction.user.id, allow: [1024n, 2048n, 8192n, 65536n] } // Yetkili
            ];
            
            if (creatorId) {
                newPerms.push({ id: creatorId, allow: [1024n, 2048n, 8192n, 65536n] }); // Ticket sahibi
            }

            try {
                await interaction.channel.permissionOverwrites.set(newPerms);
                
                // Butonu deaktif yapalım
                const oldEmbed = interaction.message.embeds[0];
                const newButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket_disabled').setLabel(`Üstlenen: ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket\'ı Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await interaction.message.edit({ components: [newButtons] });
                await interaction.editReply({ content: `✅ Bu bilet <@${interaction.user.id}> tarafından üstlenildi!` });
                // Store claimer in channel topic
                await interaction.channel.setTopic((interaction.channel.topic || '') + ` | Üstlenen: ${interaction.user.id}`);
            } catch (e) {
                console.error(e);
                await interaction.editReply('İzinler ayarlanırken bir hata oluştu.');
            }
        } else if (interaction.customId === 'close_ticket') {
            const staffRole = interaction.guild.roles.cache.find(r => r.name === 'V・Staff');
            if (!staffRole || (!interaction.member.roles.cache.has(staffRole.id) && !interaction.member.permissions.has(8n))) {
                return interaction.reply({ content: 'Bu bileti sadece yetkililer kapatabilir!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('close_ticket_modal')
                .setTitle('Bileti Kapat');

            const reasonInput = new TextInputBuilder()
                .setCustomId('close_reason')
                .setLabel('Kapatma Sebebi')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Bu bileti neden kapatıyorsunuz?');

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        } else if (interaction.customId.startsWith('rate_')) {
            const channelId = interaction.channel.id;
            const ticketData = global.ticketClosingData[channelId];
            
            if (!ticketData) {
                return interaction.reply({ content: 'Bu biletin değerlendirme süresi dolmuş veya bir hata oluşmuş.', ephemeral: true });
            }

            if (interaction.user.id !== ticketData.creatorId) {
                return interaction.reply({ content: 'Bu bileti sadece açan kişi değerlendirebilir! Yetkililer kendilerini veya başka yetkilileri değerlendiremez.', ephemeral: true });
            }

            await interaction.deferUpdate();

            const rating = parseInt(interaction.customId.split('_')[1]);
            const { reason, creatorId, creatorName, claimerId, claimerName, closerId, closerName, channelName } = ticketData;

            try {
                // 1. Firebase'e admin istatistiklerini kaydet
                if (claimerId !== 'Üstlenilmedi' && claimerId !== 'Bilinmiyor') {
                    await updateAdminStats(claimerId, claimerName, rating);
                }

                // 2. Transkript oluştur
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                let transcriptText = `--- BİLET LOG KAYDI: ${channelName} ---\n\n`;
                messages.reverse().forEach(m => {
                    const date = m.createdAt.toLocaleString('tr-TR');
                    transcriptText += `[${date}] ${m.author.tag}: ${m.content || '(Mesaj Yok)'}\n`;
                    if (m.attachments.size > 0) {
                        m.attachments.forEach(a => {
                            transcriptText += `   -> [Dosya Eki: ${a.url}]\n`;
                        });
                    }
                });

                // 3. Ticket logunu Firebase'e kaydet
                await saveTicketLog({
                    channelName: channelName,
                    creatorId: creatorId,
                    creatorName: creatorName,
                    claimerId: claimerId,
                    claimerName: claimerName,
                    closerId: closerId,
                    closerName: closerName,
                    closeReason: reason,
                    rating: rating,
                    transcript: transcriptText,
                    createdAt: new Date().toLocaleString('tr-TR')
                });

                // Bellekten sil ve kanalı kapat
                delete global.ticketClosingData[channelId];
                await interaction.channel.delete().catch(console.error);

            } catch (error) {
                console.error('Rating kayit hatasi:', error);
                await interaction.channel.delete().catch(console.error);
            }
        }
    } else if (interaction.isModalSubmit()) {
        // --- Başvuru formu gönderimi ---
        if (interaction.customId.startsWith('basvuru_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const tip = interaction.customId.replace('basvuru_modal_', '');
            const tipAd = tip === 'polis' ? '🚓 Polis (LSPD)' : tip === 'ems' ? '🚑 Sağlık (EMS)' : '✅ Whitelist';

            const config = require('./config');
            let reviewChannel = config.basvuru.reviewChannelId
                ? interaction.guild.channels.cache.get(config.basvuru.reviewChannelId)
                : null;
            if (!reviewChannel) {
                reviewChannel = interaction.guild.channels.cache.find(c => c.name === config.basvuru.reviewChannelName || c.name.includes('başvuru-onay') || c.name.includes('basvuru'));
            }
            if (!reviewChannel || !reviewChannel.isTextBased()) {
                return interaction.editReply('❌ Başvuru kanalı bulunamadı. Lütfen bir yetkiliye bildir.');
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`${tipAd} Başvurusu`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: 'Başvuran', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                    { name: 'Ad Soyad / Yaş', value: interaction.fields.getTextInputValue('b_isim').slice(0, 1024) },
                    { name: 'Karakter İsmi (IC)', value: interaction.fields.getTextInputValue('b_karakter').slice(0, 1024) },
                    { name: 'RP Deneyimi', value: interaction.fields.getTextInputValue('b_deneyim').slice(0, 1024) },
                    { name: 'Başvuru Sebebi', value: interaction.fields.getTextInputValue('b_sebep').slice(0, 1024) }
                )
                .setTimestamp();

            const appData = {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                avatar: interaction.user.displayAvatarURL(),
                type: tipAd,
                isim: interaction.fields.getTextInputValue('b_isim'),
                karakter: interaction.fields.getTextInputValue('b_karakter'),
                deneyim: interaction.fields.getTextInputValue('b_deneyim'),
                sebep: interaction.fields.getTextInputValue('b_sebep')
            };

            try {
                await saveApplication(appData);
            } catch (error) {
                console.error("Firebase'e başvuru kaydedilirken hata oluştu:", error);
            }

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`basvuru_onayla_${interaction.user.id}`).setLabel('Onayla').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`basvuru_reddet_${interaction.user.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

            await reviewChannel.send({ embeds: [embed], components: [buttons] });
            return interaction.editReply('✅ Başvurun alındı! Yetkililer değerlendirdikten sonra sana DM ile bilgi verilecek.');
        }

        if (interaction.customId === 'close_ticket_modal') {
            await interaction.deferReply({ ephemeral: false });
            const reason = interaction.fields.getTextInputValue('close_reason');

            try {
                const creatorIdMatch = interaction.channel.topic ? interaction.channel.topic.match(/Açan: (\d+)/) : null;
                const creatorId = creatorIdMatch ? creatorIdMatch[1] : 'Bilinmiyor';
                
                const claimerIdMatch = interaction.channel.topic ? interaction.channel.topic.match(/Üstlenen: (\d+)/) : null;
                const claimerId = claimerIdMatch ? claimerIdMatch[1] : 'Üstlenilmedi';

                // Yetkilinin ismini al
                let claimerName = 'Bilinmiyor';
                if (claimerId !== 'Üstlenilmedi') {
                    try {
                        const member = await interaction.guild.members.fetch(claimerId);
                        claimerName = member.user.username;
                    } catch(e) {}
                }
                
                let creatorName = 'Bilinmiyor';
                if (creatorId !== 'Bilinmiyor') {
                    try {
                        const member = await interaction.guild.members.fetch(creatorId);
                        creatorName = member.user.username;
                    } catch(e) {}
                }

                // Verileri belleğe kaydet
                global.ticketClosingData[interaction.channel.id] = {
                    reason: reason,
                    creatorId: creatorId,
                    creatorName: creatorName,
                    claimerId: claimerId,
                    claimerName: claimerName,
                    closerId: interaction.user.id,
                    closerName: interaction.user.username,
                    channelName: interaction.channel.name
                };

                const ratingEmbed = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setTitle('Bilet Değerlendirmesi')
                    .setDescription(`Bilet, **${interaction.user.username}** tarafından şu sebeple kapatılmak üzere:\n> ${reason}\n\nLütfen bilet tamamen silinmeden önce yetkilimizi 1 ile 5 yıldız arasında değerlendirin.`);

                const ratingButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('rate_1').setLabel('1').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
                    new ButtonBuilder().setCustomId('rate_2').setLabel('2').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
                    new ButtonBuilder().setCustomId('rate_3').setLabel('3').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
                    new ButtonBuilder().setCustomId('rate_4').setLabel('4').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
                    new ButtonBuilder().setCustomId('rate_5').setLabel('5').setStyle(ButtonStyle.Secondary).setEmoji('⭐')
                );

                await interaction.editReply({ embeds: [ratingEmbed], components: [ratingButtons] });

                const channelIdToClose = interaction.channel.id;
                // 60 saniye içinde cevap gelmezse varsayılan olarak sil (puanlanmadı)
                setTimeout(async () => {
                    if (global.ticketClosingData[channelIdToClose]) {
                        try {
                            const ch = await interaction.guild.channels.fetch(channelIdToClose);
                            if (ch) await ch.delete();
                        } catch(e) {}
                        delete global.ticketClosingData[channelIdToClose];
                    }
                }, 60000);

            } catch (error) {
                console.error(error);
                await interaction.editReply('Bilet değerlendirme aşamasına geçerken hata oluştu.');
            }
        }
    }
});
// Ses kanalına girip çıkma event'i (Dinamik Aktif Yetkili Odaları)
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Sadece bir kanala girildiğinde veya çıkıldığında çalışır (susturma vb. işlemler yok sayılır)
    if (oldState.channelId === newState.channelId) return;

    try {
        // Yeni girilen kanalı kontrol et (Kırmızıdan Yeşile)
        if (newState.channel) {
            const channel = newState.channel;
            if (channel.name.includes('Aktif Yetkili') && channel.name.includes('🔴')) {
                const newName = channel.name.replace('🔴', '🟢');
                await channel.setName(newName, 'Bir yetkili odaya girdi.').catch(err => {
                    if (err.code !== 50013) console.error(`İsim değiştirme hatası (Rate limit olabilir): ${err.message}`);
                });
            }
        }

        // Çıkılan kanalı kontrol et (Yeşilden Kırmızıya)
        if (oldState.channel) {
            const channel = oldState.channel;
            if (channel.name.includes('Aktif Yetkili') && channel.name.includes('🟢')) {
                // Odada başka kimse kalmadıysa
                if (channel.members.size === 0) {
                    const newName = channel.name.replace('🟢', '🔴');
                    await channel.setName(newName, 'Odadaki son yetkili de çıktı.').catch(err => {
                        if (err.code !== 50013) console.error(`İsim değiştirme hatası (Rate limit olabilir): ${err.message}`);
                    });
                }
            }
        }
    } catch (e) {
        console.error('voiceStateUpdate hatası:', e);
    }
});

client.login(process.env.DISCORD_TOKEN);
