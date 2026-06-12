const express = require('express');
const path = require('path');
const { getAdminLeaderboard, getAllTickets, getAllPendingApplications, updateApplicationStatus, getDirectMessages, saveDirectMessage } = require('./firebase');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { addWarning } = require('./utils/store');
const { sendLog } = require('./utils/logger');
const { formatDuration } = require('./utils/duration');
const config = require('./config');

function startWebServer(client) {
    const app = express();
    const port = 3001;

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'web/views'));
    
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    app.use(express.json({ limit: '50mb' }));

    // Basic styling inside the views directly or static folder, we'll use a CDN in EJS for simplicity (Tailwind or similar)

    app.get('/', async (req, res) => {
        const leaderboard = await getAdminLeaderboard();
        res.render('dashboard', { leaderboard });
    });

    app.get('/logs', async (req, res) => {
        const tickets = await getAllTickets();
        res.render('logs', { tickets });
    });

    app.get('/send', (req, res) => {
        res.render('send_message', { success: null, error: null });
    });

    app.post('/send', async (req, res) => {
        const { channelId, messageContent, embedTitle, embedDesc, embedColor, embedFooter, embedImage } = req.body;
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                return res.render('send_message', { success: null, error: 'Kanal bulunamadı veya metin kanalı değil.' });
            }
            
            let messagePayload = {};
            if (messageContent && messageContent.trim() !== '') {
                messagePayload.content = messageContent;
            }

            if (embedTitle || embedDesc || embedImage) {
                const embed = new EmbedBuilder();
                if (embedTitle) embed.setTitle(embedTitle);
                if (embedDesc) embed.setDescription(embedDesc);
                if (embedColor) embed.setColor(embedColor);
                if (embedFooter) embed.setFooter({ text: embedFooter });
                if (embedImage) embed.setImage(embedImage);
                messagePayload.embeds = [embed];
            }

            if (!messagePayload.content && !messagePayload.embeds) {
                return res.render('send_message', { success: null, error: 'Mesaj içeriği veya Embed girmelisiniz.' });
            }
            
            await channel.send(messagePayload);
            res.render('send_message', { success: 'Mesaj başarıyla gönderildi!', error: null });
        } catch (error) {
            console.error(error);
            res.render('send_message', { success: null, error: 'Mesaj gönderilirken bir hata oluştu: ' + error.message });
        }
    });

    // --- Başvurular Sayfası ---
    app.get('/applications', async (req, res) => {
        try {
            const apps = await getAllPendingApplications();
            res.render('applications', { apps, success: null, error: null });
        } catch (err) {
            console.error(err);
            res.render('applications', { apps: [], success: null, error: 'Başvurular yüklenirken hata oluştu.' });
        }
    });

    app.post('/api/application/:id/action', async (req, res) => {
        const { actionType, userId } = req.body;
        const appId = req.params.id;
        try {
            const status = actionType === 'approve' ? 'approved' : 'rejected';
            await updateApplicationStatus(appId, status);
            
            const applicant = await client.users.fetch(userId).catch(() => null);
            if (applicant) {
                const guildName = client.guilds.cache.first()?.name || 'Vance Roleplay';
                await applicant.send(
                    status === 'approved'
                        ? `🎉 **${guildName}** başvurun **onaylandı**! Tebrikler.`
                        : `😔 **${guildName}** başvurun maalesef **reddedildi**. Tekrar deneyebilirsin.`
                ).catch(() => {});
            }
            
            const apps = await getAllPendingApplications();
            res.render('applications', { apps, success: `Başvuru başarıyla ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.`, error: null });
        } catch (error) {
            console.error(error);
            const apps = await getAllPendingApplications();
            res.render('applications', { apps, success: null, error: 'İşlem sırasında hata oluştu: ' + error.message });
        }
    });

    // --- Uyarı Sistemi Sayfası ---
    app.get('/warn', (req, res) => {
        res.render('warn', { success: null, error: null });
    });

    app.post('/api/warn', async (req, res) => {
        const { userId, reason } = req.body;
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return res.render('warn', { success: null, error: 'Bot hiçbir sunucuda bulunmuyor.' });
            
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) return res.render('warn', { success: null, error: 'Kullanıcı bulunamadı (ID hatalı olabilir).' });

            const target = await guild.members.fetch(user.id).catch(() => null);

            // Web panelden atılan uyarıları panel yetkilisi (botun kendisi veya web admin) adına atıyoruz
            // Burada interaction.user.id olmadığı için botun kendi ID'sini admin olarak gönderiyoruz.
            const { count } = addWarning(guild.id, user.id, client.user.id, reason);
            await user.send(`**${guild.name}** sunucusunda uyarı aldın. (Toplam: ${count})\n**Sebep:** ${reason}`).catch(() => {});

            const embed = new EmbedBuilder()
                .setColor(config.colors.warning)
                .setTitle('⚠️ Kullanıcı Uyarıldı (Web Panel)')
                .addFields(
                    { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Yetkili', value: `Web Panel`, inline: true },
                    { name: 'Toplam Uyarı', value: `${count}`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            // Otomatik ceza eşiği kontrolü
            const rule = config.warnActions.find(a => a.count === count);
            let autoMsg = '';
            if (rule && target) {
                try {
                    if (rule.action === 'mute' && target.moderatable) {
                        await target.timeout(rule.duration, `Otomatik (Web): ${count} uyarı`);
                        autoMsg = `🔇 Otomatik olarak **${formatDuration(rule.duration)}** susturuldu.`;
                    } else if (rule.action === 'kick' && target.kickable) {
                        await target.kick(`Otomatik (Web): ${count} uyarı`);
                        autoMsg = '👢 Otomatik olarak sunucudan atıldı.';
                    } else if (rule.action === 'ban' && target.bannable) {
                        await guild.members.ban(user.id, { reason: `Otomatik (Web): ${count} uyarı` });
                        autoMsg = '🔨 Otomatik olarak yasaklandı.';
                    }
                } catch (e) {
                    console.error('[web-uyar] Otomatik ceza uygulanamadı:', e.message);
                }
                if (autoMsg) embed.addFields({ name: 'Otomatik Ceza', value: autoMsg, inline: false });
            }

            await sendLog(guild, 'moderation', embed);
            res.render('warn', { success: `${user.tag} başarıyla uyarıldı! (Toplam uyarı: ${count})`, error: null });

        } catch (error) {
            console.error(error);
            res.render('warn', { success: null, error: 'Uyarı gönderilirken bir hata oluştu: ' + error.message });
        }
    });

    // --- Özel Mesaj (DM) Sayfası ---
    function formatMessageContent(text) {
        if (!text) return '';
        let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        escaped = escaped.replace(/&lt;a:(\w+):(\d+)&gt;/g, '<img src="https://cdn.discordapp.com/emojis/$2.gif" alt=":$1:" class="inline-block w-6 h-6 align-middle" title=":$1:">');
        escaped = escaped.replace(/&lt;:(\w+):(\d+)&gt;/g, '<img src="https://cdn.discordapp.com/emojis/$2.png" alt=":$1:" class="inline-block w-6 h-6 align-middle" title=":$1:">');
        return escaped;
    }

    app.get('/dm', async (req, res) => {
        try {
            const dms = await getDirectMessages();
            const activeUser = req.query.u || null;
            let activeChat = null;

            if (req.query.newId) {
                return res.redirect('/dm?u=' + req.query.newId.trim());
            }

            if (activeUser) {
                activeChat = dms.find(d => d.userId === activeUser);
                if (!activeChat) {
                    try {
                        const userFetch = await client.users.fetch(activeUser);
                        if (userFetch) {
                            activeChat = {
                                userId: activeUser,
                                meta: { userTag: userFetch.tag, avatar: userFetch.displayAvatarURL() },
                                messages: []
                            };
                            dms.unshift(activeChat);
                        }
                    } catch (e) {
                        // Kullanıcı bulunamadı
                    }
                }
            }

            res.render('dm', { dms, activeUser, activeChat, formatMessageContent });
        } catch (err) {
            console.error(err);
            res.render('dm', { dms: [], activeUser: null, activeChat: null, formatMessageContent });
        }
    });

    app.post('/api/dm/:userId/send', upload.single('attachment'), async (req, res) => {
        const userId = req.params.userId;
        const content = req.body.message || '';
        const file = req.file;
        
        if (!content.trim() && !file) return res.redirect('/dm?u=' + userId);

        try {
            const user = await client.users.fetch(userId);
            if (!user) throw new Error("Kullanıcı bulunamadı.");

            const payload = { content };
            if (file) {
                const attachment = new AttachmentBuilder(file.buffer, { name: file.originalname });
                payload.files = [attachment];
            }

            const sentMessage = await user.send(payload);
            
            let attachments = [];
            if (sentMessage.attachments.size > 0) {
                attachments = sentMessage.attachments.map(a => a.url);
            }
            
            await saveDirectMessage(
                userId, 
                user.tag, 
                user.displayAvatarURL(), 
                content || '📷 Medya', 
                'outgoing',
                attachments
            );
            
        } catch (error) {
            console.error('[DM GÖNDERME HATASI]:', error.message);
        }

        res.redirect('/dm?u=' + userId);
    });

    app.listen(port, () => {
        console.log(`Web panel çalışıyor: http://localhost:${port}`);
    });
}

module.exports = startWebServer;
