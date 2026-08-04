import 'dotenv/config';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { log } from '../src/other.js';

const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;
const BASE_URL = 'https://api.bybit.com';

function getTimestamp() {
  return Date.now().toString();
}

function signRequest(params) {
  const orderedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return crypto
    .createHmac('sha256', API_SECRET)
    .update(orderedParams)
    .digest('hex');
}

async function bybitRequest(path, method = 'GET', params = {}) {
  const timestamp = getTimestamp();

  const baseParams = {
    api_key: API_KEY,
    timestamp,
    recv_window: 60000,
  };

  let queryParams = {};
  let bodyParams = {};

  if (method === 'GET') {
    queryParams = { ...params, ...baseParams };
    queryParams.sign = signRequest(queryParams);

    const url = BASE_URL + path + '?' + new URLSearchParams(queryParams).toString();
    const res = await fetch(url, { method });
    const json = await res.json();

    if (json.ret_code !== 0 && json.retCode !== 0) {
      console.error('[BYBIT ERROR]', json);
      throw new Error('Bybit API request failed');
    }

    return json.result || json;
  } else if (method === 'POST') {
    // Для POST: подпись формируется из всех параметров (params + baseParams)
    const allParams = { ...params, ...baseParams };
    allParams.sign = signRequest(allParams);

    const url = BASE_URL + path;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allParams),
    });
    const json = await res.json();

    if (json.ret_code !== 0 && json.retCode !== 0) {
      console.error('[BYBIT ERROR]', json);
      throw new Error('Bybit API request failed');
    }

    return json.result || json;
  }
}


function roundAmount(amount, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.floor(amount * factor) / factor;
}

async function getQtyStep(symbol) {
  try {
    const { list } = await bybitRequest('/v5/market/instruments-info', 'GET', {
      category: 'spot',
      symbol,
    });

    const info = list?.[0];
    const stepStr = info?.lotSizeFilter?.qtyStep || '0.01';
    return stepStr.indexOf('.') >= 0 ? stepStr.split('.')[1].length : 0;
  } catch {
    return 3;
  }
}

async function checkFundingBalance(token) {
  try {
    const response = await bybitRequest('/v5/asset/transfer/query-account-coin-balance', 'GET', {
      accountType: 'FUND',
      coin: token,
    });

    const balance = response?.balance;
    if (balance && balance.coin === token) {
      return parseFloat(balance.walletBalance || 0);
    }
    return 0;
  } catch (e) {
    console.error('Ошибка при проверке FUND баланса:', e.message);
    return 0;
  }
}

async function checkSpotBalance(token) {
  try {
    const response = await bybitRequest('/v5/account/wallet-balance', 'GET', {
      accountType: 'UNIFIED',
    });

    const list = response?.list || [];
    if (list.length === 0) return 0;

    const account = list[0];
    const coins = account?.coin || account?.coins || [];
    const coinInfo = coins.find(item => item.coin === token);

    if (coinInfo) {
      return parseFloat(coinInfo.availableToTrade || coinInfo.walletBalance || 0);
    }

    return 0;
  } catch (e) {
    console.error('Ошибка при проверке UNIFIED баланса:', e.message);
    return 0;
  }
}

async function generateUUID() {
  const res = await fetch('https://www.uuidgenerator.net/api/version4');
  if (!res.ok) {
    throw new Error('Не удалось получить UUID');
  }
  const uuid = (await res.text()).trim();
  return uuid;
}

async function transferToSpot(token, amount) {
  try {
    const requestId = await generateUUID();
    
    await bybitRequest('/v5/asset/transfer/inter-transfer', 'POST', {
      fromAccountType: 'FUND',
      toAccountType: 'UNIFIED',
      coin: token,
      amount: amount.toString(),
      transferId: requestId,  // Обратите внимание на 'requestID'
    });

    console.log(`🔁 Перевел ${amount} ${token} с FUND в UNIFIED`);

    for (let i = 0; i < 10; i++) {
      const bal = await checkSpotBalance(token);
      if (bal >= amount - 0.0001) break;
      await new Promise(res => setTimeout(res, 500));
    }
  } catch (e) {
    console.error('Ошибка при переводе:', e.message);
  }
}

async function getUsdtBalance() {
  try {
    const response = await bybitRequest('/v5/account/wallet-balance', 'GET', {
      accountType: 'UNIFIED',
    });
    const list = response?.list || [];
    if (list.length === 0) return 0;

    const account = list[0];
    const coins = account?.coin || account?.coins || [];
    const usdt = coins.find(c => c.coin === 'USDT');
    return usdt ? parseFloat(usdt.walletBalance || 0) : 0;
  } catch {
    return 0;
  }
}

async function sellToken(token, symbol, amount) {
const decimals = Math.max((await getQtyStep(symbol)) - 1, 0);
  const roundedAmount = roundAmount(amount, decimals);
  if (roundedAmount <= 0) {
    console.warn('⚠️ Слишком малое количество для продажи после округления');
    return;
  }

  // Получаем баланс USDT до продажи
  const usdtBefore = await getUsdtBalance();

  const params = {
    category: 'spot',
    symbol,
    orderType: 'Market',
    side: 'Sell',
    qty: roundedAmount.toFixed(decimals),
    marketUnit: 'baseCoin',
  };
console.log('params', params)
  const result = await bybitRequest('/v5/order/create', 'POST', params);
  console.log(`💰 Ордер на продажу ${roundedAmount} ${token} размещён.`);

  // Ждем, чтобы ордер успел исполниться
  await new Promise(res => setTimeout(res, 3000));

  // Получаем баланс USDT после продажи
  const usdtAfter = await getUsdtBalance();

  // Рассчитываем выручку в USDT и среднюю цену продажи
  const totalUSDT = usdtAfter - usdtBefore;
  if (totalUSDT <= 0) {
    console.log('⚠️ Не удалось получить выручку по продаже.');
    return;
  }

  const avgPrice = totalUSDT / roundedAmount;

  console.log(`💵 Продано ${roundedAmount.toFixed(decimals)} ${token} за ${totalUSDT.toFixed(2)} USDT. по средней цене ≈ ${avgPrice.toFixed(3)} USDT.`);
}

async function checkAllBalances(token) {
  const accountTypes = ['UNIFIED', 'FUND'];
  console.log(`🔍 Проверяем все типы счетов для ${token}:`);

  for (const accountType of accountTypes) {
    try {
      if (accountType === 'UNIFIED') {
        const response = await bybitRequest('/v5/account/wallet-balance', 'GET', {
          accountType,
        });

        const list = response?.list || [];
        if (list.length > 0) {
          const account = list[0];
          const coins = account?.coin || account?.coins || [];
          const coinInfo = coins.find(item => item.coin === token);

          if (coinInfo && parseFloat(coinInfo.walletBalance || 0) > 0) {
            console.log(`💰 ${accountType}: ${coinInfo.walletBalance} ${token} (available: ${coinInfo.availableToTrade || 'N/A'})`);
          }
        }
      }
    } catch (e) {
      console.log(`⚠️ ${accountType}: недоступен или ошибка`);
    }
  }
}

export const startBybit = async (token) => {
  const SYMBOL = `${token}USDT`;
  const CHECK_INTERVAL = 500;

  async function isTradingPairAvailable() {
    try {
      const { list } = await bybitRequest('/v5/market/instruments-info', 'GET', {
        category: 'spot',
        symbol: SYMBOL,
      });
      return list.length > 0;
    } catch (e) {
      return false;
    }
  }

  console.log(`⏳ Ожидание запуска торгов пары ${SYMBOL}...`);

  while (true) {
    const isAvailable = await isTradingPairAvailable();
    if (isAvailable) {
      console.log(`✅ Торги по паре ${SYMBOL} начались.`);
      break;
    }
    process.stdout.write('.');
    await new Promise(res => setTimeout(res, 500));
  }

  console.log(`⏳ Ожидание поступления ${token} на FUND или UNIFIED...`);
  await checkAllBalances(token);

  while (true) {
    try {
      const fundBal = await checkFundingBalance(token);
      const spotBal = await checkSpotBalance(token);

      console.log(`📦 FUND: ${fundBal}, UNIFIED: ${spotBal}`);

      if (spotBal > 0.1) {
        console.log(`📈 ${token} уже на UNIFIED. Продаю...`);
        await sellToken(token, SYMBOL, spotBal);
        break;
      }

      if (fundBal > 0.1) {
        await transferToSpot(token, fundBal);
        const spotBalAfter = await checkSpotBalance(token);
        if (spotBalAfter > 0.1) {
          console.log(`📤 ${token} переведен. Продаю...`);
          await sellToken(token, SYMBOL, spotBalAfter);
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
