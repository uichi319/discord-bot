const { Client, GatewayIntentBits } = require('discord.js');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;

const topics = {
  tp: ["共通1", "共通2"],
  fd: ["好きな寿司ネタは？"],
  pst: ["子供の頃の思い出は？"],
  ftr: ["将来やりたいことは？"],
  lv: ["理想のデートは？"],
  ad: ["ちょっと大人な質問"]
};

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  if (topics[cmd]) {
    const list = topics[cmd];
    const random = list[Math.floor(Math.random() * list.length)];

    await interaction.reply(random);
  }
});

client.once('ready', () => {
  console.log(`ログイン成功: ${client.user.tag}`);
});

client.login(TOKEN);