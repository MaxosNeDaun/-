import {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
} from 'discord.js';
import 'dotenv/config';
import { loadData, addParticipant, removeParticipant, resetParticipants, setMessageRef } from './storage.js';
import { buildRegistrationMessage } from './embed.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID } = process.env;

const missing = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'].filter(name => !process.env[name]);
if (missing.length) {
  console.error(`❌ Не заданы переменные окружения: ${missing.join(', ')}`);
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Опубликовать сообщение регистрации с кнопками')
    .addStringOption(o => o.setName('название').setDescription('Заголовок события (необязательно)').setRequired(false))
    .addChannelOption(o => o.setName('канал').setDescription('В какой канал отправить').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Очистить список зарегистрированных участников')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map(c => c.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  console.log(`✅ Бот вошёл в систему как ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Слэш-команды зарегистрированы');
  } catch (err) {
    console.error('❌ Не удалось зарегистрировать команды:', err.message);
  }

  console.log('🤖 Бот полностью готов к работе.');
});

client.on('interactionCreate', async (interaction) => {
  try {
    // 1. ОБРАБОТКА СЛЭШ-КОМАНД
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true });

      if (interaction.commandName === 'setup') {
        const title = interaction.options.getString('название') || 'Регистрация участников';
        const data = loadData();
        const payload = buildRegistrationMessage(data, title);

        const chosenChannel = interaction.options.getChannel('канал');
        let targetChannel = interaction.channel;

        if (chosenChannel) {
          targetChannel = chosenChannel;
        } else if (CHANNEL_ID) {
          try {
            targetChannel = await client.channels.fetch(CHANNEL_ID);
          } catch (e) {
            console.error('Не удалось получить канал по CHANNEL_ID:', e.message);
          }
        }

        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.editReply({ content: '❌ Не удалось найти текстовый канал.' });
          return;
        }

        const message = await targetChannel.send(payload);
        setMessageRef(message.id, message.channel.id, title);

        const reportTarget = targetChannel.id === interaction.channel.id ? 'этот канал' : `<#${targetChannel.id}>`;
        await interaction.editReply({ content: `Сообщение публикации отправлено в ${reportTarget} ✅` });
      }

      if (interaction.commandName === 'reset') {
        resetParticipants();
        const data = loadData();

        if (data.messageId && data.channelId) {
          try {
            const channel = await client.channels.fetch(data.channelId);
            if (channel && channel.isTextBased()) {
              const message = await channel.messages.fetch(data.messageId);
              await message.edit(buildRegistrationMessage(data, data.title));
            }
          } catch (e) {
            console.error('Ошибка обновления сообщения:', e.message);
          }
        }
        await interaction.editReply({ content: 'Список участников очищен ✅' });
      }
    }

    // 2. ОБРАБОТКА КНОПОК
    if (interaction.isButton()) {
      const data = loadData();

      // Обязательно отвечаем Discord, даже если кнопка от старого сообщения
      if (interaction.message.id !== data.messageId) {
        await interaction.reply({ 
          content: 'Эта кнопка недействительна (создана новая регистрация или бот был перезапущен).', 
          ephemeral: true 
        });
        return;
      }

      const userId = interaction.user.id;

      if (interaction.customId === 'register') {
        if (!addParticipant(userId)) {
          await interaction.reply({ content: 'Вы уже в списке участников.', ephemeral: true });
          return;
        }
        const updatedData = loadData();
        await interaction.update(buildRegistrationMessage(updatedData, updatedData.title));
      }

      if (interaction.customId === 'unregister') {
        if (!removeParticipant(userId)) {
          await interaction.reply({ content: 'Вас нет в списке участников.', ephemeral: true });
          return;
        }
        const updatedData = loadData();
        await interaction.update(buildRegistrationMessage(updatedData, updatedData.title));
      }
    }
  } catch (err) {
    console.error('Ошибка взаимодействия:', err);

    if (interaction.isRepliable()) {
      const errorMessage = { content: 'Произошла ошибка, попробуйте ещё раз.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    }
  }
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('❌ Не удалось войти в Discord:', err.message);
  process.exit(1);
});
