const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const guild = newState.guild;
        let embed;

        if (!oldState.channelId && newState.channelId) {
            // Ses kanalına giriş
            embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('🔊 Ses Kanalına Girdi')
                .addFields(
                    { name: 'Kullanıcı', value: `<@${member.id}>`, inline: true },
                    { name: 'Kanal', value: `<#${newState.channelId}>`, inline: true }
                )
                .setTimestamp();
        } else if (oldState.channelId && !newState.channelId) {
            // Ses kanalından çıkış
            embed = new EmbedBuilder()
                .setColor(config.colors.danger)
                .setTitle('🔇 Ses Kanalından Çıktı')
                .addFields(
                    { name: 'Kullanıcı', value: `<@${member.id}>`, inline: true },
                    { name: 'Kanal', value: `<#${oldState.channelId}>`, inline: true }
                )
                .setTimestamp();
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // Kanal değiştirme
            embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('↔️ Ses Kanalı Değiştirdi')
                .addFields(
                    { name: 'Kullanıcı', value: `<@${member.id}>`, inline: true },
                    { name: 'Önceki', value: `<#${oldState.channelId}>`, inline: true },
                    { name: 'Yeni', value: `<#${newState.channelId}>`, inline: true }
                )
                .setTimestamp();
        }

        if (embed) await sendLog(guild, 'voice', embed);
    }
};
