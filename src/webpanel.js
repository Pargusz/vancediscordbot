const http = require('http');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// Discord ek dosya limiti (boost'suz ~25MB). Base64 şişmesi için biraz pay bırakıyoruz.
const MAX_BODY = 30 * 1024 * 1024; // 30 MB

/**
 * Bağımlılıksız web panel.
 * - Tek/çoklu kanala mesaj veya embed gönderir
 * - Dosya/görsel ekleyebilir (base64)
 * - Mesajı zamanlayabilir (sunucu açık kaldığı sürece)
 * - Sunucu istatistiklerini gösterir
 * - PANEL_PASSWORD ile basit şifre koruması
 */
function startWebPanel(client) {
    const PORT = process.env.PANEL_PORT || 3000;
    const PASSWORD = process.env.PANEL_PASSWORD || '';

    const server = http.createServer(async (req, res) => {
        try {
            if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(renderPage());
                return;
            }

            if (req.method === 'GET' && req.url === '/api/info') {
                return sendJson(res, 200, {
                    online: !!client.user,
                    tag: client.user ? client.user.tag : null,
                    avatar: client.user ? client.user.displayAvatarURL() : null,
                    passwordRequired: !!PASSWORD
                });
            }

            if (req.method === 'GET' && req.url === '/api/stats') {
                const guild = getGuild(client);
                if (!guild) return sendJson(res, 200, { ok: false });
                let online = 0;
                try {
                    online = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
                } catch {}
                return sendJson(res, 200, {
                    ok: true,
                    name: guild.name,
                    icon: guild.iconURL() || null,
                    members: guild.memberCount,
                    online,
                    channels: guild.channels.cache.size,
                    roles: guild.roles.cache.size,
                    boosts: guild.premiumSubscriptionCount || 0
                });
            }

            if (req.method === 'POST' && req.url === '/api/send') {
                const body = await readBody(req);
                let data;
                try { data = JSON.parse(body); } catch { return sendJson(res, 400, { ok: false, error: 'Geçersiz istek.' }); }

                if (PASSWORD && data.password !== PASSWORD) {
                    return sendJson(res, 401, { ok: false, error: 'Hatalı şifre.' });
                }

                // Kanal ID'leri: virgül, boşluk veya satır ile ayrılabilir
                const channelIds = String(data.channelId || '')
                    .split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
                const message = (data.message || '').trim();
                const files = Array.isArray(data.files) ? data.files : [];

                if (channelIds.length === 0) return sendJson(res, 400, { ok: false, error: 'En az bir kanal ID girin.' });
                if (!message && files.length === 0) return sendJson(res, 400, { ok: false, error: 'Mesaj veya en az bir dosya gerekli.' });

                // Zamanlama
                let delay = 0;
                if (data.scheduleAt) {
                    const when = new Date(data.scheduleAt).getTime();
                    if (isNaN(when)) return sendJson(res, 400, { ok: false, error: 'Geçersiz zamanlama tarihi.' });
                    delay = when - Date.now();
                    if (delay < 0) return sendJson(res, 400, { ok: false, error: 'Zamanlama geçmiş bir tarih olamaz.' });
                    if (delay > 2147483647) return sendJson(res, 400, { ok: false, error: 'Zamanlama çok uzak (max ~24 gün).' });
                }

                // Zamanlanmışsa hemen onay dön, arka planda gönder
                if (delay > 1000) {
                    const minutes = Math.round(delay / 60000);
                    setTimeout(() => {
                        sendToChannels(client, channelIds, message, files, data)
                            .catch(err => console.error('[WebPanel] Zamanlanmış gönderim hatası:', err));
                    }, delay);
                    return sendJson(res, 200, { ok: true, scheduled: true, minutes, channels: channelIds.length });
                }

                // Hemen gönder
                const result = await sendToChannels(client, channelIds, message, files, data);
                return sendJson(res, 200, { ok: true, results: result });
            }

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Bulunamadı');
        } catch (err) {
            console.error('[WebPanel] Sunucu hatası:', err);
            sendJson(res, 500, { ok: false, error: 'Sunucu hatası.' });
        }
    });

    server.listen(PORT, () => {
        console.log(`[WebPanel] Panel çalışıyor: http://localhost:${PORT}`);
    });

    return server;
}

/** Birden fazla kanala mesaj gönderir, her biri için sonuç döner. */
async function sendToChannels(client, channelIds, message, files, opts) {
    const attachments = buildAttachments(files);
    const results = [];

    for (const id of channelIds) {
        try {
            const channel = await client.channels.fetch(id).catch(() => null);
            if (!channel || !channel.isTextBased || !channel.isTextBased()) {
                results.push({ id, ok: false, error: 'Kanal bulunamadı veya metin kanalı değil.' });
                continue;
            }
            const payload = buildPayload(message, attachments, opts);
            await channel.send(payload);
            results.push({ id, ok: true, name: channel.name || id });
        } catch (err) {
            console.error(`[WebPanel] ${id} kanalına gönderilemedi:`, err.message);
            results.push({ id, ok: false, error: 'Gönderilemedi (yetki/boyut?).' });
        }
    }
    return results;
}

function buildAttachments(files) {
    const attachments = [];
    for (const f of files) {
        if (!f || !f.data) continue;
        const base64 = String(f.data).includes(',') ? String(f.data).split(',')[1] : String(f.data);
        const buffer = Buffer.from(base64, 'base64');
        const name = (f.name || 'dosya').replace(/[^\w.\-]/g, '_');
        attachments.push(new AttachmentBuilder(buffer, { name }));
    }
    return attachments;
}

function buildPayload(message, attachments, opts) {
    const payload = {};
    if (attachments.length) payload.files = attachments;

    if (opts.useEmbed) {
        const embed = new EmbedBuilder().setColor((opts.embedColor || '#5865F2').trim() || '#5865F2');
        if (message) embed.setDescription(message);
        if (opts.embedTitle && opts.embedTitle.trim()) embed.setTitle(opts.embedTitle.trim());
        if (opts.embedFooter && opts.embedFooter.trim()) embed.setFooter({ text: opts.embedFooter.trim() });
        if (opts.embedThumbnail && opts.embedThumbnail.trim()) embed.setThumbnail(opts.embedThumbnail.trim());
        if (opts.embedImage && opts.embedImage.trim()) {
            embed.setImage(opts.embedImage.trim());
        } else {
            const firstImage = attachments.find(a => /\.(png|jpe?g|gif|webp)$/i.test(a.name));
            if (firstImage) embed.setImage(`attachment://${firstImage.name}`);
        }
        payload.embeds = [embed];
    } else if (message) {
        payload.content = message;
    }
    return payload;
}

function getGuild(client) {
    if (process.env.GUILD_ID) {
        const g = client.guilds.cache.get(process.env.GUILD_ID);
        if (g) return g;
    }
    return client.guilds.cache.first() || null;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) { req.destroy(); reject(new Error('Body too large')); }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function sendJson(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
}

function renderPage() {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vance Roleplay - Bot Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #1e1f22; color: #dbdee1; min-height: 100vh;
    display: flex; align-items: flex-start; justify-content: center; padding: 24px;
  }
  .wrap { width: 100%; max-width: 920px; display: grid; grid-template-columns: 1fr 300px; gap: 18px; }
  @media (max-width: 800px){ .wrap { grid-template-columns: 1fr; } }
  .card { background: #2b2d31; border-radius: 12px; padding: 26px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .header img { width: 48px; height: 48px; border-radius: 50%; background: #1e1f22; }
  .header h1 { font-size: 18px; color: #fff; }
  .status { font-size: 13px; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #80848e; }
  .dot.online { background: #23a55a; }
  label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #b5bac1; margin: 16px 0 6px; }
  input[type=text], input[type=password], input[type=datetime-local], textarea, input[type=color] {
    width: 100%; background: #1e1f22; border: 1px solid #1e1f22; border-radius: 6px;
    color: #dbdee1; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none;
  }
  input:focus, textarea:focus { border-color: #5865F2; }
  textarea { resize: vertical; min-height: 110px; }
  input[type=color] { height: 42px; padding: 4px; cursor: pointer; }
  .row { display: flex; gap: 12px; }
  .row > div { flex: 1; }
  .checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
  .checkbox-row input { width: 16px; height: 16px; accent-color: #5865F2; }
  .checkbox-row label { margin: 0; text-transform: none; font-size: 14px; font-weight: 500; }
  .collapse { display: none; }
  .collapse.show { display: block; }
  button { width: 100%; margin-top: 22px; background: #5865F2; color: #fff; border: none; border-radius: 6px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .15s; }
  button:hover { background: #4752c4; }
  button:disabled { background: #4e5058; cursor: not-allowed; }
  .alert { margin-top: 16px; padding: 12px; border-radius: 6px; font-size: 14px; display: none; white-space: pre-line; }
  .alert.show { display: block; }
  .alert.success { background: #1c3329; color: #4ac776; border: 1px solid #23a55a; }
  .alert.error { background: #3a1d1d; color: #f0888a; border: 1px solid #e74c3c; }
  .hint { font-size: 12px; color: #80848e; margin-top: 4px; }
  input[type=file] { width: 100%; color: #b5bac1; font-size: 13px; padding: 8px 0; }
  input[type=file]::file-selector-button { background: #4e5058; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; margin-right: 10px; cursor: pointer; font-family: inherit; }
  input[type=file]::file-selector-button:hover { background: #6d6f78; }
  .file-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
  .file-list .file-item { font-size: 13px; color: #b5bac1; background: #1e1f22; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; }
  .file-list .file-item span:last-child { color: #80848e; }
  /* Sağ panel */
  .side h2 { font-size: 13px; text-transform: uppercase; color: #b5bac1; margin-bottom: 14px; }
  .stat { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #1e1f22; }
  .stat span:last-child { color: #fff; font-weight: 600; }
  /* Önizleme */
  .preview-title { font-size: 12px; text-transform: uppercase; color: #b5bac1; margin: 20px 0 8px; }
  .preview { background: #313338; border-radius: 8px; padding: 12px; font-size: 14px; }
  .preview .msg-content { white-space: pre-wrap; word-break: break-word; }
  .preview .embed { border-left: 4px solid #5865F2; background: #2b2d31; border-radius: 4px; padding: 10px 12px; margin-top: 6px; }
  .preview .embed .e-title { font-weight: 700; color: #fff; margin-bottom: 4px; }
  .preview .embed .e-desc { white-space: pre-wrap; word-break: break-word; color: #dbdee1; }
  .preview .embed .e-footer { font-size: 12px; color: #80848e; margin-top: 8px; }
  .preview .empty { color: #80848e; font-style: italic; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <img id="botAvatar" src="" alt="">
      <div>
        <h1 id="botName">Bot Panel</h1>
        <div class="status"><span class="dot" id="statusDot"></span><span id="statusText">Bağlanıyor...</span></div>
      </div>
    </div>

    <div id="passwordField" style="display:none;">
      <label>Panel Şifresi</label>
      <input type="password" id="password" placeholder="Şifre">
    </div>

    <label>Kanal ID('leri)</label>
    <input type="text" id="channelId" placeholder="Tek: 123  |  Çoklu: 123, 456, 789">
    <div class="hint">Toplu duyuru için birden fazla ID'yi virgül veya boşlukla ayır.</div>

    <label>Mesaj</label>
    <textarea id="message" placeholder="Göndermek istediğiniz mesajı yazın..." oninput="updatePreview()"></textarea>

    <div class="checkbox-row">
      <input type="checkbox" id="useEmbed" onchange="onEmbedToggle()">
      <label for="useEmbed">Embed olarak gönder</label>
    </div>

    <div class="collapse" id="embedOptions">
      <div class="row">
        <div>
          <label>Embed Başlığı (opsiyonel)</label>
          <input type="text" id="embedTitle" placeholder="Başlık" oninput="updatePreview()">
        </div>
        <div style="flex:0 0 90px;">
          <label>Renk</label>
          <input type="color" id="embedColor" value="#5865F2" oninput="updatePreview()">
        </div>
      </div>
      <label>Footer / Alt Yazı (opsiyonel)</label>
      <input type="text" id="embedFooter" placeholder="Örn: Vance Roleplay Yönetim" oninput="updatePreview()">
      <div class="row">
        <div>
          <label>Görsel URL (opsiyonel)</label>
          <input type="text" id="embedImage" placeholder="https://...">
          <div class="hint">Boş bırakırsan yüklenen ilk resim embed görseli olur.</div>
        </div>
        <div>
          <label>Küçük Resim URL (opsiyonel)</label>
          <input type="text" id="embedThumbnail" placeholder="https://...">
        </div>
      </div>
    </div>

    <label>Dosya / Görsel Ekle (opsiyonel)</label>
    <input type="file" id="files" multiple>
    <div class="hint">Birden fazla dosya seçebilirsin. Toplam ~25MB sınırı vardır.</div>
    <div id="fileList" class="file-list"></div>

    <div class="checkbox-row">
      <input type="checkbox" id="useSchedule" onchange="document.getElementById('scheduleField').classList.toggle('show', this.checked)">
      <label for="useSchedule">Zamanla (ileri bir tarihte gönder)</label>
    </div>
    <div class="collapse" id="scheduleField">
      <label>Gönderim Zamanı</label>
      <input type="datetime-local" id="scheduleAt">
      <div class="hint">Not: Bot kapanırsa zamanlanmış mesaj iptal olur.</div>
    </div>

    <div class="preview-title">Önizleme</div>
    <div class="preview" id="preview"></div>

    <button id="sendBtn" onclick="send()">Gönder</button>
    <div class="alert" id="alert"></div>
  </div>

  <div class="card side">
    <h2>📊 Sunucu İstatistikleri</h2>
    <div id="stats"><div class="hint">Yükleniyor...</div></div>
  </div>
</div>

<script>
  const $ = id => document.getElementById(id);

  async function loadInfo() {
    try {
      const d = await (await fetch('/api/info')).json();
      if (d.passwordRequired) $('passwordField').style.display = 'block';
      if (d.online) {
        $('statusDot').classList.add('online');
        $('statusText').textContent = 'Çevrimiçi' + (d.tag ? ' • ' + d.tag : '');
        if (d.tag) $('botName').textContent = d.tag;
        if (d.avatar) $('botAvatar').src = d.avatar;
      } else { $('statusText').textContent = 'Bot çevrimdışı'; }
    } catch { $('statusText').textContent = 'Bağlantı hatası'; }
  }

  async function loadStats() {
    try {
      const d = await (await fetch('/api/stats')).json();
      if (!d.ok) { $('stats').innerHTML = '<div class="hint">Sunucu bilgisi yok.</div>'; return; }
      $('stats').innerHTML =
        stat('Sunucu', d.name) + stat('Üye', d.members) + stat('Çevrimiçi', d.online) +
        stat('Kanal', d.channels) + stat('Rol', d.roles) + stat('Boost', d.boosts);
    } catch { $('stats').innerHTML = '<div class="hint">İstatistik alınamadı.</div>'; }
  }
  function stat(k, v){ return '<div class="stat"><span>'+k+'</span><span>'+v+'</span></div>'; }

  function onEmbedToggle(){ $('embedOptions').classList.toggle('show', $('useEmbed').checked); updatePreview(); }

  function escapeHtml(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  function updatePreview() {
    const msg = $('message').value;
    const box = $('preview');
    if ($('useEmbed').checked) {
      const title = $('embedTitle').value, footer = $('embedFooter').value, color = $('embedColor').value;
      if (!msg && !title) { box.innerHTML = '<span class="empty">Embed önizlemesi için içerik girin.</span>'; return; }
      box.innerHTML = '<div class="embed" style="border-left-color:'+color+'">' +
        (title ? '<div class="e-title">'+escapeHtml(title)+'</div>' : '') +
        (msg ? '<div class="e-desc">'+escapeHtml(msg)+'</div>' : '') +
        (footer ? '<div class="e-footer">'+escapeHtml(footer)+'</div>' : '') + '</div>';
    } else {
      box.innerHTML = msg ? '<div class="msg-content">'+escapeHtml(msg)+'</div>' : '<span class="empty">Mesaj önizlemesi burada görünür.</span>';
    }
  }

  function formatSize(b){ if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
  $('files').addEventListener('change', () => {
    const list = $('fileList'); list.innerHTML = '';
    [...$('files').files].forEach(f => {
      const div = document.createElement('div'); div.className = 'file-item';
      div.innerHTML = '<span></span><span></span>';
      div.children[0].textContent = f.name; div.children[1].textContent = formatSize(f.size);
      list.appendChild(div);
    });
  });
  function readFileAsBase64(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: file.name, data: r.result }); r.onerror = rej; r.readAsDataURL(file); }); }

  function showAlert(msg, type){ const a = $('alert'); a.textContent = msg; a.className = 'alert show ' + type; }

  async function send() {
    const btn = $('sendBtn');
    const selectedFiles = [...$('files').files];
    const payload = {
      channelId: $('channelId').value,
      message: $('message').value,
      useEmbed: $('useEmbed').checked,
      embedTitle: $('embedTitle').value,
      embedColor: $('embedColor').value,
      embedFooter: $('embedFooter').value,
      embedImage: $('embedImage').value,
      embedThumbnail: $('embedThumbnail').value,
      password: $('password') ? $('password').value : '',
      files: []
    };
    if ($('useSchedule').checked && $('scheduleAt').value) payload.scheduleAt = $('scheduleAt').value;

    if (!payload.channelId.trim()) return showAlert('Kanal ID girin.', 'error');
    if (!payload.message.trim() && selectedFiles.length === 0) return showAlert('Mesaj yazın veya en az bir dosya ekleyin.', 'error');

    btn.disabled = true; btn.textContent = 'Gönderiliyor...';
    try {
      if (selectedFiles.length) payload.files = await Promise.all(selectedFiles.map(readFileAsBase64));
      const d = await (await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json();

      if (d.ok && d.scheduled) {
        showAlert('🕒 Mesaj zamanlandı (~' + d.minutes + ' dk sonra, ' + d.channels + ' kanal).', 'success');
        resetForm();
      } else if (d.ok && d.results) {
        const ok = d.results.filter(r => r.ok);
        const fail = d.results.filter(r => !r.ok);
        let txt = '✅ Gönderildi: ' + ok.map(r => '#' + r.name).join(', ');
        if (fail.length) txt += '\\n❌ Başarısız: ' + fail.map(r => r.id + ' (' + r.error + ')').join(', ');
        showAlert(txt, fail.length ? 'error' : 'success');
        if (!fail.length) resetForm();
      } else {
        showAlert('❌ ' + (d.error || 'Bir hata oluştu.'), 'error');
      }
    } catch {
      showAlert('❌ Sunucuya ulaşılamadı.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Gönder';
    }
  }

  function resetForm(){ $('message').value=''; $('files').value=''; $('fileList').innerHTML=''; updatePreview(); }

  loadInfo(); loadStats(); updatePreview();
  setInterval(loadStats, 30000);
</script>
</body>
</html>`;
}

module.exports = { startWebPanel };
