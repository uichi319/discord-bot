const { Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
const express = require('express');

const app = express();

// Webサーバー（スリープ対策）
app.get('/', (req, res) => {
  res.send('Bot is alive!');
});
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const SHEET_ID = process.env.SHEET_ID;

// Google Sheets取得
async function getTopics() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:B'
  });

  return res.data.values;
}

// ランダム取得
function getRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  const rows = await getTopics();

  let filtered;

  if (cmd === 'tp') {
    filtered = rows;
  } else {
    filtered = rows.filter(r => r[0] === cmd);
  }

  const texts = filtered.map(r => r[1]);

  if (texts.length === 0) {
    return interaction.reply('データがないよ！');
  }

  await interaction.reply(getRandom(texts));
});

client.once('ready', () => {
  console.log(`ログイン成功: ${client.user.tag}`);
});

client.login(TOKEN);