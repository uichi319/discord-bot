const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('tp').setDescription('全体からランダム'),
  new SlashCommandBuilder().setName('fd').setDescription('食べ物トーク'),
  new SlashCommandBuilder().setName('pst').setDescription('過去トーク'),
  new SlashCommandBuilder().setName('ftr').setDescription('未来トーク'),
  new SlashCommandBuilder().setName('lv').setDescription('恋愛トーク'),
  new SlashCommandBuilder().setName('ad').setDescription('大人トーク')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('登録中...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('登録完了');
  } catch (err) {
    console.error(err);
  }
})();