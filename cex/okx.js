import 'dotenv/config';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { log } from '../src/other.js';

const API_KEY = process.env.OKX_API_KEY_TRADES;
const API_SECRET = process.env.OKX_SECRET_KEY_TRADES;
const API_PASSPHRASE = process.env.OKX_API_PASSPHRASE_TRADES;

const BASE_URL = 'https://www.okx.com';

// Создание подписи
function signRequest(timestamp, method, path, body = '') {
  const prehash = `${timestamp}${method}${path}${body}`;
  const hmac = crypto.createHmac('sha256', API_SECRET);
  return hmac.update(prehash).digest('base64');
}


// Общий fetch с авторизацией
async function okxRequest(path, method = 'GET', body = '') {
  const timestamp = new Date().toISOString();
  const signature = signRequest(timestamp, method, path, body);

  const headers = {
    'OK-ACCESS-KEY': API_KEY,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': API_PASSPHRASE,
    'Content-Type': 'application/json',
  };

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = body;
  }

  const res = await fetch(BASE_URL + path, options);
  const json = await res.json();

  if (!res.ok || json.code !== '0') {
    // Если это ошибка отсутствия пары — возвращаем пустой data
    if (json.code === '51001' && json.msg.includes("doesn't exist")) {
      return [];
    }

    console.error('[ERROR] API Error:', json);
    throw new Error('Failed request');
  }

  return json.data;
}

// Основной цикл
export const startOkx = async (token) => {
  const SYMBOL = `${token}-USDT`;
  const CURRENCY = token;
  const CHECK_INTERVAL = 1000;

   async function isTradingPairAvailable() {
    try {
      const data = await okxRequest(`/api/v5/public/instruments?instType=SPOT&instId=${SYMBOL}`);
      return data.length > 0;
    } catch (e) {
      return false;
    }
  }

  console.log(`⏳ Ожидание запуска торгов пары ${SYMBOL}...`);

  let dotCount = 0;
while (true) {
  const isAvailable = await isTradingPairAvailable();
  if (isAvailable) {
    process.stdout.write('\n');
    console.log(`✅ Торги по паре ${SYMBOL} начались.`);
    break;
  }

  process.stdout.write('.');
  dotCount++;
  if (dotCount % 30 === 0) process.stdout.write(` ← ждем ${SYMBOL}\n`); // периодическая подсказка
  await new Promise(res => setTimeout(res, 2000));
}


  async function checkFundingBalance() {
    const data = await okxRequest('/api/v5/asset/balances?ccy=' + CURRENCY);
    const balance = parseFloat(data[0]?.availBal || 0);
    return balance;
  }

  async function checkBalance() {
    const data = await okxRequest('/api/v5/account/balance?ccy=' + CURRENCY);
    const details = data[0]?.details || [];
    const tokenInfo = details.find(d => d.ccy === CURRENCY);
    return parseFloat(tokenInfo?.availBal || 0);
  }

  async function transferToTrading(amount) {
  const body = JSON.stringify({
    ccy: CURRENCY,
    amt: amount.toString(),
    from: '6', // Funding
    to: '18',  // Trading (spot)
  });

  await okxRequest('/api/v5/asset/transfer', 'POST', body);
  console.log(`🔁 Перевел ${amount} ${CURRENCY} с Funding в Trading`);

  // ⏳ Ожидание, пока баланс появится на торговом счете
  for (let i = 0; i < 10; i++) {
    const balance = await checkBalance();
    if (balance >= amount - 0.0001) break; // допускаем маленький дрифт
    await new Promise(res => setTimeout(res, 500)); // ждать 1 сек
  }
    }   

  async function sellTOKEN(amount) {
  const body = JSON.stringify({
    instId: SYMBOL,
    tdMode: 'cash',
    side: 'sell',
    ordType: 'market',
    sz: amount.toString(),
  });

  const result = await okxRequest('/api/v5/trade/order', 'POST', body);

  const ordId = result[0]?.ordId;
  if (!ordId) {
    console.warn('⚠️ Не удалось получить ordId для ордера');
    return;
  }

  // ⏳ Ждем появления информации о сделке
  let fillsData = [];
  for (let i = 0; i < 10; i++) {
    fillsData = await okxRequest(`/api/v5/trade/fills?instId=${SYMBOL}&ordId=${ordId}`);
    if (fillsData.length > 0) break;
    await new Promise(res => setTimeout(res, 500));
  }

  if (!fillsData || fillsData.length === 0) {
    console.warn('⚠️ Не удалось получить информацию о сделках по ордеру');
    return;
  }

  let totalAmount = 0;
  let totalValue = 0;
  let totalFee = 0;
  fillsData.forEach(fill => {
  const fillPrice = parseFloat(fill.fillPx);
  const fillSize = parseFloat(fill.fillSz);
  const fee = Math.abs(parseFloat(fill.fee)); // fee в OKX обычно отрицательное
  totalAmount += fillSize;
  totalValue += fillPrice * fillSize;
  totalFee += fee;
});

  const avgPrice = totalValue / totalAmount;
  const netValue = totalValue - totalFee;
log(
  'info',
  `💵 Средняя цена продажи ${token}: ${avgPrice.toFixed(3)} USDT за токен. Чистая сумма: ${netValue.toFixed(2)} USDT (после комиссии ${totalFee.toFixed(4)} USDT)`,
  'green'
);}

  console.log(`⏳ Ожидание поступления ${token} на Funding...`);

  while (true) {
    try {
      const fundingBalance = await checkFundingBalance();
      const tradingBalance = await checkBalance();

      console.log(`📦 Funding ${token}: ${fundingBalance}, Trading ${token}: ${tradingBalance}`);

      if (tradingBalance > 0.1) {
        console.log(`📈 ${token} уже на торговом счете. Продаю...`);
        await sellTOKEN(tradingBalance);
        break;
      }

      if (fundingBalance > 0.1) {
        await transferToTrading(fundingBalance);
        await new Promise(res => setTimeout(res, 500));

        const newTradingBalance = await checkBalance();
        if (newTradingBalance > 0.1) {
          console.log(`📤 ${token} переведен. Продаю...`);
          await sellTOKEN(newTradingBalance);
          break;
        }
      }

      await new Promise(res => setTimeout(res, CHECK_INTERVAL));
    } catch (e) {
      console.error('Ошибка:', e.message);
      await new Promise(res => setTimeout(res, CHECK_INTERVAL));
    }
  }
};