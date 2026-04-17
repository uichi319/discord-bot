require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('tp')
    .setDescription('全カテゴリ'),

  new SlashCommandBuilder()
    .setName('fd')
    .setDescription('食べ物'),

  new SlashCommandBuilder()
    .setName('pst')
    .setDescription('過去'),

  new SlashCommandBuilder()
    .setName('ftr')
    .setDescription('未来'),

  new SlashCommandBuilder()
    .setName('lv')
    .setDescription('恋愛'),

  new SlashCommandBuilder()
    .setName('ad')
    .setDescription('大人'),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('リセット')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('コマンド登録中...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('コマンド登録完了');
  } catch (err) {
    console.error('コマンド登録エラー:', err);
  }
})();