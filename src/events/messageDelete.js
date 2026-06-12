const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild) return;
        if (message.author && message.author.bot) return;

        const embed = new EmbedBuilder()
            .setColor(config.colors.danger)
            .setTitle('🗑️ Mesaj Silindi')
            .addFields(
                { name: 'Yazan', value: message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Bilinmiyor', inline: true },
                { name: 'Kanal', value: `<#${message.channelId}>`, inline: true },
                { name: 'İçerik', value: (message.content && message.content.length ? message.content.slice(0, 1024) : '*(metin yok / embed veya dosya)*') }
            )
            .setTimestamp();

        if (message.attachments && message.attachments.size > 0) {
            embed.addFields({ name: 'Ekler', value: [...message.attachments.values()].map(a => a.name).join(', ').slice(0, 1024) });
        }

        await sendLog(message.guild, 'message', embed);
    }
};
