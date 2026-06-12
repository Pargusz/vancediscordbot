const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!newMessage.guild) return;
        if (newMessage.author && newMessage.author.bot) return;
        // Sadece içerik değişimiyle ilgilen (embed yüklenmesi vb. tetiklemesin)
        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('✏️ Mesaj Düzenlendi')
            .addFields(
                { name: 'Yazan', value: `<@${newMessage.author.id}> (${newMessage.author.tag})`, inline: true },
                { name: 'Kanal', value: `<#${newMessage.channelId}>`, inline: true },
                { name: 'Mesaja Git', value: `[Tıkla](${newMessage.url})`, inline: true },
                { name: 'Önceki', value: (oldMessage.content || '*(boş)*').slice(0, 1024) },
                { name: 'Yeni', value: (newMessage.content || '*(boş)*').slice(0, 1024) }
            )
            .setTimestamp();

        await sendLog(newMessage.guild, 'message', embed);
    }
};
