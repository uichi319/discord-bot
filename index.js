const { Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const SHEET_ID = process.env.SHEET_ID;

const ALL_TYPES = ['fd', 'pst', 'ftr', 'lv', 'ad'];

// ===== Google Sheets =====
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

// ===== データ取得 =====
async function getRows() {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'topic!A:C'
  });

  return res.data.values || [];
}

// ===== 使用済み更新 =====
async function markAsUsed(rowIndex) {
  const sheets = await getSheets();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `topic!C${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['1']]
    }
  });
}

// ===== クリア =====
async function clearUsed(totalRows) {
  const sheets = await getSheets();

  const values = Array(totalRows).fill(['']);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `topic!C2:C${totalRows + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

// ===== ランダム =====
function getRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ===== メイン =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  const rows = await getRows();

  const validRows = rows
    .slice(1)
    .map((r, i) => ({
      type: r[0],
      text: r[1],
      used: r[2],
      rowIndex: i + 2 // スプシ行番号
    }))
    .filter(r => r.type && r.text && !r.used);

  // ===== clearコマンド =====
  if (cmd === 'clear') {
    await clearUsed(rows.length - 1);
    return interaction.reply('使用済みフラグをリセットしたよ！');
  }

  let filtered;

  if (cmd === 'tp') {
    filtered = validRows.filter(r => ALL_TYPES.includes(r.type));
  } else {
    filtered = validRows.filter(r => r.type === cmd);
  }

  if (filtered.length === 0) {
    return interaction.reply('もう全部使い切ったよ！/clear でリセットしてね');
  }

  const selected = getRandom(filtered);

  await markAsUsed(selected.rowIndex);

  await interaction.reply(selected.text);
});

client.once('ready', () => {
  console.log(`ログイン成功: ${client.user.tag}`);
});

client.login(TOKEN);