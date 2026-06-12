const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate } = require('../utils/permissions');
const { sendLog } = require('../utils/logger');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Bir kullanıcıyı sunucudan atar.')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Atılacak kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Atma sebebi').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!target) return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: true });
        const err = canModerate(interaction.member, target);
        if (err) return interaction.reply({ content: `❌ ${err}`, ephemeral: true });
        if (!target.kickable) return interaction.reply({ content: '❌ Bu kullanıcıyı atamıyorum (rol hiyerarşisi/yetki).', ephemeral: true });

        await interaction.deferReply();
        await user.send(`**${interaction.guild.name}** sunucusundan atıldın.\n**Sebep:** ${reason}`).catch(() => {});

        try {
            await target.kick(`${interaction.user.tag}: ${reason}`);
        } catch {
            return interaction.editReply('❌ Atma işlemi başarısız oldu.');
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('👢 Kullanıcı Atıldı')
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await sendLog(interaction.guild, 'moderation', embed);
    }
};
