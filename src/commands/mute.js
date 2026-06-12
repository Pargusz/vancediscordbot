const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const { parseDuration, formatDuration } = require('../utils/duration');
const config = require('../config');

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // Discord limiti: 28 gün

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Bir kullanıcıyı belirli süre susturur (timeout).')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Susturulacak kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('süre').setDescription('Örn: 10m, 1h, 1d (max 28 gün)').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Susturma sebebi').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const durationStr = interaction.options.getString('süre');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
        const ms = parseDuration(durationStr);

        if (!ms || ms < 5000) return interaction.reply({ content: '❌ Geçersiz süre. Örn: `10m`, `1h`, `1d`', ephemeral: true });
        if (ms > MAX_TIMEOUT) return interaction.reply({ content: '❌ Maksimum süre 28 gündür.', ephemeral: true });

        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!target) return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: true });
        const err = canModerate(interaction.member, target);
        if (err) return interaction.reply({ content: `❌ ${err}`, ephemeral: true });
        if (!target.moderatable) return interaction.reply({ content: '❌ Bu kullanıcıyı susturamıyorum (rol hiyerarşisi/yetki).', ephemeral: true });

        await interaction.deferReply();
        try {
            await target.timeout(ms, `${interaction.user.tag}: ${reason}`);
        } catch {
            return interaction.editReply('❌ Susturma başarısız oldu.');
        }

        const pretty = formatDuration(ms);
        await user.send(`**${interaction.guild.name}** sunucusunda **${pretty}** susturuldun.\n**Sebep:** ${reason}`).catch(() => {});

        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('🔇 Kullanıcı Susturuldu')
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Süre', value: pretty, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await sendLog(interaction.guild, 'moderation', embed);
    }
};
