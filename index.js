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
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const SHEET_ID = process.env.SHEET_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ===== 翻訳対象チャンネル =====
const TARGET_CHANNEL_IDS = [
  '1496019973175513219',
  '1497824103783075910'
];

// ===== 話題BOT =====
const ALL_TYPES = ['fd', 'pst', 'ftr', 'lv', 'ad'];

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

  return google.sheets({
    version: 'v4',
    auth
  });
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
    requestBody: {
      values
    }
  });
}

function getRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// =======================
// ===== 翻訳BOT =========
// =======================

// URLや記号だけなら翻訳しない
function shouldSkipTranslate(text) {
  if (!text) return true;
  if (text.trim().length === 0) return true;
  if (/^https?:\/\//i.test(text.trim())) return true;
  if (/^[wWｗＷ草笑!！?？。、,.~～\s]+$/.test(text)) return true;
  return false;
}

// ===== AI言語判定 =====
async function detectLanguage(text) {
  const prompt = `
次の文章が日本語か台湾で使われる繁体字中国語か判定してください。

ルール:
- 日本語なら jp
- 繁体字中国語なら tw
- 短文やネットスラングでも意味から判定
- 出力は jp または tw のみ

文章:
${text}
`;

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
          content: 'あなたは言語判定AIです。jp か tw のみ返答してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 5
    })
  });

  const data = await res.json();

  let result = data?.choices?.[0]?.message?.content?.trim().toLowerCase();

  if (result !== 'jp' && result !== 'tw') {
    result = 'jp';
  }

  return result;
}

// ===== AI翻訳 =====
async function translateText(text, lang) {
  const prompt =
    lang === 'jp'
      ? `
次の日本語を台湾で自然に使われる繁体字中国語へ翻訳してください。

重要ルール:
・翻訳結果のみ出力
・説明、補足、例文は禁止
・意味が自然に伝わる表現にする
・直訳しすぎない
・会話向けの自然な口調
・スラングは自然に変換

入力:
${text}
`
      : `
次の繁体字中国語を自然な日本語へ翻訳してください。

重要ルール:
・翻訳結果のみ出力
・説明、補足、例文は禁止
・意味が自然に伝わる表現にする
・直訳しすぎない
・日本人が普段使う自然な口調
・スラングは自然に変換

入力:
${text}
`;

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
          content: 'あなたは高品質な翻訳AIです。翻訳結果のみ返答してください。'
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

  let result = data?.choices?.[0]?.message?.content?.trim() || '翻訳失敗';

  // 余計な説明が出た時の保険
  const ngWords = ['説明', '意味', '例えば', 'この表現', '補足'];
  if (ngWords.some(word => result.includes(word))) {
    result = result.split('\n')[0];
  }

  return result;
}

// =======================
// ===== Slashコマンド ====
// =======================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
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

  } catch (err) {
    console.error(err);
    await interaction.reply('エラーが発生したよ');
  }
});

// =======================
// ===== 翻訳BOT =========
// =======================

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!TARGET_CHANNEL_IDS.includes(message.channel.id)) return;

  try {
    const text = message.content?.trim();

    if (shouldSkipTranslate(text)) return;

    const lang = await detectLanguage(text);

    const translated = await translateText(text, lang);

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