const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Renderでは環境変数からTOKENを読む
const TOKEN = process.env.TOKEN;

// 話題リスト
const topics = [
  "好きな寿司ネタは？",
  "最近ハマってることは？",
  "おすすめのゲームは？",
  "子供の頃の思い出は？",
  "行ってみたい国は？"
];

client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (message.content === '!topic') {
    const random = topics[Math.floor(Math.random() * topics.length)];
    message.reply(`お題：${random}`);
  }
});

client.once('ready', () => {
  console.log(`ログイン成功: ${client.user.tag}`);
});

client.login(TOKEN);