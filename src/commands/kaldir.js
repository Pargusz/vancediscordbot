const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kaldir')
        .setDescription('Sunucudaki tüm kanalları ve rolleri tamamen siler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Bu komutu kullanma yetkin yok.', ephemeral: true });
        }

        // Güvenlik açısından sadece sunucu sahibine veya yetkiliye açılabilir. 
        // Şimdilik admin yetkisi olan herkes kullanabilir (isAdmin fonksiyonuna bağlı).
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Çok tehlikeli bir işlem olduğu için bu komutu sadece sunucu sahibi kullanabilir.', ephemeral: true });
        }

        await interaction.reply({ content: '⏳ Sunucu sıfırlanıyor. Tüm kanal ve roller silinecek...', ephemeral: true });

        const guild = interaction.guild;

        // Bütün kanalları silme döngüsü
        const channels = guild.channels.cache;
        for (const [id, channel] of channels) {
            try {
                await channel.delete();
            } catch (err) {
                console.error(`Kanal silinemedi: ${channel.name} - ${err.message}`);
            }
        }

        // Bütün rolleri silme döngüsü
        const roles = guild.roles.cache;
        for (const [id, role] of roles) {
            // @everyone rolü ve entegrasyon/bot rolleri silinemez, ayrıca botun kendi yetkisinin altındaki roller silinebilir.
            if (!role.managed && role.name !== '@everyone') {
                try {
                    await role.delete();
                } catch (err) {
                    console.error(`Rol silinemedi: ${role.name} - ${err.message}`);
                }
            }
        }
    }
};
