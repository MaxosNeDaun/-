import {
  Client, GatewayIntentBits, MessageFlags, REST, Routes,
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
} from 'discord.js';
import 'dotenv/config';
import { loadData, addParticipant, removeParticipant, resetParticipants, setMessageRef } from './storage.js';
import { buildRegistrationMessage } from './embed.js';

// ---- 1. Проверяем, что все нужные переменные заданы ----
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID } = process.env;

const missing = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'].filter(name => !process.env[name]);
if (missing.length) {
  console.error(`❌ Не заданы переменные окружения: ${missing.join(', ')}`);
  console.error('   Добавьте их в Railway → вкладка Variables и передеплойте сервис.');
  process.exit(1);
}

// ---- 2. Описание слэш-команд ----
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Опубликовать сообщение регистрации с кнопками')
    .addStringOption(o => o.setName('название').setDescription('Заголовок события (необязательно)').setRequired(false))
    .addChannelOption(o => o.setName('канал').setDescription('В какой канал отправить (по умолчанию — текущий)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Очистить список зарегистрированных участников')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map(c => c.toJSON());

// ---- 3. Клиент бота ----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Бот вошёл в систему как ${client.user.tag}`);

  // Регистрируем команды сами, без ручного npm run deploy
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Слэш-команды /setup и /reset зарегистрированы на сервере');
  } catch (err) {
    console.error('❌ Не удалось зарегистрировать команды:', err.message);
    console.error('   Проверьте, что CLIENT_ID и GUILD_ID указаны верно.');
  }

  console.log('🤖 Бот полностью готов к работе.');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      // Discord даёт всего 3 секунды на подтверждение команды. Сразу
      // "откладываем" ответ (defer), чтобы успеть выполнить всю работу
      // (сетевые запросы к каналам/сообщениям) без риска таймаута.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (interaction.commandName === 'setup') {
        const title = interaction.options.getString('название') || 'Регистрация участников';
        const data = loadData();
        const payload = buildRegistrationMessage(data, title);

        const chosenChannel = interaction.options.getChannel('канал');
        let targetChannel = interaction.channel;
        if (chosenChannel) {
          targetChannel = chosenChannel;
        } else if (CHANNEL_ID) {
          targetChannel = await client.channels.fetch(CHANNEL_ID);
        }

        const message = await targetChannel.send(payload);
        setMessageRef(message.id, message.channel.id);

        const reportTarget = targetChannel.id === interaction.channel.id ? 'этот канал' : `<#${targetChannel.id}>`;
        await interaction.editReply({ content: `Сообщение регистрации опубликовано в ${reportTarget} ✅` });
      }

      if (interaction.commandName === 'reset') {
        resetParticipants();
        const data = loadData();
        if (data.messageId && data.channelId) {
          const channel = await client.channels.fetch(data.channelId);
          const message = await channel.messages.fetch(data.messageId);
          await message.edit(buildRegistrationMessage(data));
        }
        await interaction.editReply({ content: 'Список участников очищен ✅' });
      }
    }

    if (interaction.isButton()) {
      const data = loadData();
      if (interaction.message.id !== data.messageId) return;

      const userId = interaction.user.id;

      if (interaction.customId === 'register') {
        if (!addParticipant(userId)) {
          await interaction.reply({ content: 'Вы уже в списке участников.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.update(buildRegistrationMessage(loadData()));
      }

      if (interaction.customId === 'unregister') {
        if (!removeParticipant(userId)) {
          await interaction.reply({ content: 'Вас нет в списке участников.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.update(buildRegistrationMessage(loadData()));
      }
    }
  } catch (err) {
    console.error('Ошибка обработки взаимодействия:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Произошла ошибка, попробуйте ещё раз.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('❌ Не удалось войти в Discord. Скорее всего DISCORD_TOKEN неверный.');
  console.error(err.message);
  process.exit(1);
});
