const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { isAdmin } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panelkur1')
        .setDescription('İstenilen yapıya ve iletilen görsellere göre sunucuyu otomatik kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Bu komutu sadece sunucu sahibi kullanabilir.', ephemeral: true });
        }

        await interaction.reply({ content: '⏳ Sunucu şablona göre kuruluyor, bu işlem biraz zaman alabilir lütfen bekleyin...', ephemeral: true });

        const guild = interaction.guild;

        // 1. İstenilen rolleri oluştur
        const rolesToCreate = [
            { name: 'VR Store Admin', color: '#FF0000', permissions: [PermissionFlagsBits.Administrator] },
            { name: 'Partner', color: '#0000FF' },
            { name: 'Customer', color: '#00FF00' },
            { name: 'VIP', color: '#FFD700' },
            { name: 'Cylex Phone Customer', color: '#800080' }
        ];

        for (const role of rolesToCreate) {
            try {
                await guild.roles.create({
                    name: role.name,
                    color: role.color,
                    permissions: role.permissions || [],
                    reason: 'Panelkur1 komutu ile oluşturuldu.'
                });
            } catch (err) {
                console.error(`Rol oluşturulamadı: ${role.name}`, err);
            }
        }

        // 2. Kategori ve kanalları oluştur
        const categories = [
            {
                name: null, // Kategorisiz kanallar (en üstteki istatistik/bağlantı kanalları)
                channels: [
                    { name: '🔗 | discord.gg/cylexstore', type: ChannelType.GuildVoice },
                    { name: '🔗 | cylexdev.com', type: ChannelType.GuildVoice },
                    { name: '🙋 | 1750+ Happy Customer!', type: ChannelType.GuildVoice }
                ]
            },
            {
                name: 'ticket',
                channels: [
                    { name: '📝-open-ticket', type: ChannelType.GuildText }
                ]
            },
            {
                name: 'UPCOMING',
                channels: [
                    { name: '📢-housingv2', type: ChannelType.GuildText },
                    { name: '📢-ems-mdt', type: ChannelType.GuildText },
                    { name: '📢-phone', type: ChannelType.GuildText },
                    { name: '📢-dispatch', type: ChannelType.GuildText },
                    { name: '📢-anticheat', type: ChannelType.GuildText }
                ]
            },
            {
                name: 'PAID-SCRIPTS',
                channels: [
                    { name: '📦-subscription-pack', type: ChannelType.GuildText },
                    { name: '📦-custom-tebex', type: ChannelType.GuildText },
                    { name: '📦-mdt', type: ChannelType.GuildText },
                    { name: '📦-multicharv3', type: ChannelType.GuildText },
                    { name: '📦-loadingscreen', type: ChannelType.GuildText },
                    { name: '📦-animmenuv2', type: ChannelType.GuildText },
                    { name: '📦-multicharv2', type: ChannelType.GuildText },
                    { name: '📦-deathlogv2', type: ChannelType.GuildText },
                    { name: '📦-housing', type: ChannelType.GuildText },
                    { name: '📦-dailyrewards', type: ChannelType.GuildText },
                    { name: '📦-bank', type: ChannelType.GuildText },
                    { name: '📦-deathscreen', type: ChannelType.GuildText },
                    { name: '📦-garage', type: ChannelType.GuildText },
                    { name: '📦-hud', type: ChannelType.GuildText },
                    { name: '📦-spawnselector', type: ChannelType.GuildText },
                    { name: '📦-damagelog', type: ChannelType.GuildText },
                    { name: '📦-multicharacter', type: ChannelType.GuildText },
                    { name: '📦-menu-default', type: ChannelType.GuildText },
                    { name: '📦-anti-meta-files', type: ChannelType.GuildText },
                    { name: '🧱-hit_run_cafe_mlo', type: ChannelType.GuildText },
                    { name: '📦-dashcam', type: ChannelType.GuildText },
                    { name: '📦-pause-menu', type: ChannelType.GuildText },
                    { name: '📦-anti-magicbullet', type: ChannelType.GuildText },
                    { name: '🧱-shifted-garage_mlo', type: ChannelType.GuildText },
                    { name: '📦-animmenu', type: ChannelType.GuildText },
                    { name: '📦-vehiclecontrol', type: ChannelType.GuildText },
                    { name: '📦-market', type: ChannelType.GuildText }
                ]
            },
            {
                name: 'PAID-PROPS',
                channels: [
                    { name: '👜-props', type: ChannelType.GuildText }
                ]
            },
            {
                name: 'FREE-SCRIPTS',
                channels: [
                    { name: '📦-notify', type: ChannelType.GuildText },
                    { name: '📦-anti-controller-aimbot', type: ChannelType.GuildText },
                    { name: '📦-jobs', type: ChannelType.GuildText },
                    { name: '📦-npcdealer', type: ChannelType.GuildText },
                    { name: '📦-radio', type: ChannelType.GuildText }
                ]
            },
            {
                name: 'GENERAL',
                channels: [
                    { name: '📕-rules', type: ChannelType.GuildText },
                    { name: '👋-welcome', type: ChannelType.GuildText },
                    { name: '📢-announcement', type: ChannelType.GuildText },
                    { name: '🎉-giveaway', type: ChannelType.GuildText },
                    { name: '🎉-general-giveaway', type: ChannelType.GuildText },
                    { name: '🤝-support', type: ChannelType.GuildText },
                    { name: '🤔-suggestions', type: ChannelType.GuildText },
                    { name: '💬-general-chat', type: ChannelType.GuildText },
                    { name: '📒-claim', type: ChannelType.GuildText },
                    { name: '💯-feedback', type: ChannelType.GuildText },
                    { name: '🤔-emote-suggestions', type: ChannelType.GuildText },
                    { name: '🔊-voice', type: ChannelType.GuildVoice }
                ]
            },
            {
                name: 'etc',
                channels: [
                    { name: '💤-afk', type: ChannelType.GuildVoice }
                ]
            },
            {
                name: 'management',
                channels: [
                    { name: '🔒-staff', type: ChannelType.GuildText }
                ]
            }
        ];

        for (const catData of categories) {
            let parentId = null;

            if (catData.name) {
                try {
                    const category = await guild.channels.create({
                        name: catData.name,
                        type: ChannelType.GuildCategory
                    });
                    parentId = category.id;
                } catch (err) {
                    console.error(`Kategori oluşturulamadı: ${catData.name}`, err);
                    continue;
                }
            }

            for (const chData of catData.channels) {
                try {
                    await guild.channels.create({
                        name: chData.name,
                        type: chData.type,
                        parent: parentId
                    });
                } catch (err) {
                    console.error(`Kanal oluşturulamadı: ${chData.name}`, err);
                }
            }
        }

        await interaction.editReply({ content: '✅ Sunucu kurulumu (roller ve kanallar) başarıyla tamamlandı!' });
    }
};
