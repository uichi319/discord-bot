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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // ←翻訳に必要
  ]
});

const TOKEN = process.env.TOKEN;
const SHEET_ID = process.env.SHEET_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ===== 翻訳チャンネル =====
const TARGET_CHANNEL_IDS = [
  '1496019973175513219',
  '1497824103783075910'
];

const ALL_TYPES = ['fd', 'pst', 'ftr', 'lv', 'ad'];

// ===== カテゴリ表示 =====
const CATEGORY_MAP = {
  fd: '食べ物',
  pst: '過去',
  ftr: '未来',
  lv: '恋愛',
  ad: '大人'
};

// =======================
// ===== Google Sheets ====
// =======================

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

async function getRows() {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'topic!A:C'
  });

  return res.data.values || [];
}

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

function getRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// =======================
// ===== 翻訳機能 =========
// =======================

function isJapanese(text) {
  return /[ぁ-んァ-ン]/.test(text);
}

async function translateText(text, isJP, contextMessages = []) {
  const contextText = contextMessages
    .map(m => `${m.author.username}: ${m.content}`)
    .join('\n');

  const prompt = isJP
    ? `次の日本語を台湾で自然に使われる中国語に翻訳してください。

【絶対ルール】
・翻訳結果のみ出力
・説明、補足例は禁止
・元の文章の長さ・改行はできるだけ維持
・文脈を考慮して自然に
・カジュアルな会話調
・スラングOK

【会話履歴】
${contextText}

【入力】
${text}

【出力】`
    : `次の中国語を自然な日本語に翻訳してください。

【絶対ルール】
・翻訳結果のみ出力
・説明、補足例は禁止
・元の文章の長さ・改行はできるだけ維持
・文脈を考慮して自然に
・カジュアルな会話調
・スラングOK

【会話履歴】
${contextText}

【入力】
${text}

【出力】`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは翻訳専用AIです。翻訳のみ返答してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    })
  });

  const data = await res.json();
  return data.choices[0].message.content.trim();

  // 念のため「説明っぽい文」を除去（保険）
  const NG_WORDS = ['例えば', '説明', '意味', 'これは', 'この表現', '場合'];
  if (NG_WORDS.some(w => result.includes(w))) {
    result = result.split('\n')[0]; // 怪しいときだけ1行に
  }

  return result;

}

// =======================
// ===== Slashコマンド ====
// =======================

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
      rowIndex: i + 2
    }))
    .filter(r => r.type && r.text && !r.used);

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

  const categoryName = CATEGORY_MAP[selected.type] || selected.type;

  await interaction.reply(`【${categoryName}】\n${selected.text}`);
});

// =======================
// ===== 翻訳BOT =========
// =======================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!TARGET_CHANNEL_IDS.includes(message.channel.id)) return;

  try {
    const text = message.content;
    if (!text) return;

    // 👇 直近メッセージ取得（最大5件）
    const messages = await message.channel.messages.fetch({ limit: 6 });

    const contextMessages = Array.from(messages.values())
      .filter(m => !m.author.bot && m.id !== message.id)
      .slice(0, 5)
      .reverse();

    const jp = isJapanese(text);
    const translated = await translateText(text, jp, contextMessages);

    await message.reply(`💬 ${message.author.username}\n${translated}`);

  } catch (err) {
    console.error(err);
    await message.reply('翻訳エラーが発生したよ');
  }
});

// =======================

client.once('ready', () => {
  console.log(`ログイン成功: ${client.user.tag}`);
});

client.login(TOKEN);