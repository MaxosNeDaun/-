import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildRegistrationMessage(data, title) {
  // Безопасное получение заголовка
  const eventTitle = title || data?.title || 'Регистрация участников';
  const participants = data?.participants || [];

  let list = '_Пока никто не зарегистрировался_';

  if (participants.length > 0) {
    const formattedList = participants.map((p, i) => `${i + 1}. <@${p.id}>`);
    
    // Лимит одного поля Embed в Discord — 1024 символа.
    // Обрезаем список, если он становится слишком длинным, чтобы бот не падал.
    let currentLength = 0;
    const truncatedList = [];

    for (const item of formattedList) {
      if ((currentLength + item.length + 1) > 950) {
        truncatedList.push(`\n...и ещё ${participants.length - truncatedList.length} участников`);
        break;
      }
      truncatedList.push(item);
      currentLength += item.length + 1;
    }

    list = truncatedList.join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle(eventTitle)
    .setDescription('Нажмите кнопку ниже, чтобы записаться или отменить запись.')
    .addFields({ name: `Участники (${participants.length})`, value: list })
    .setColor(0x5865f2)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('register')
      .setLabel('Зарегистрироваться')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('unregister')
      .setLabel('Отменить регистрацию')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}
