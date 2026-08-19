import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildRegistrationMessage(data, title = 'Регистрация участников') {
  const list = data.participants.length
    ? data.participants.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n')
    : '_Пока никто не зарегистрировался_';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription('Нажмите кнопку ниже, чтобы записаться или отменить запись.')
    .addFields({ name: `Участники (${data.participants.length})`, value: list })
    .setColor(0x5865f2)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('register').setLabel('Зарегистрироваться').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('unregister').setLabel('Отменить регистрацию').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}
