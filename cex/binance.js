import 'dotenv/config';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { log } from '../src/other.js';

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_SECRET_KEY;
const BASE_URL = 'https://api.binance.com';

function sign(queryString) {
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(queryString)
    .digest('hex');
}

async function binanceRequest(path, method = 'GET', params = {}, isSigned = false) {
  const headers = {
    'X-MBX-APIKEY': API_KEY,
    'Content-Type': 'application/json',
  };

  const query = new URLSearchParams();

  // Добавляем параметры
  for (const key in params) {
    query.append(key, params[key]);
  }

  // Если нужно подписывать запрос
  if (isSigned) {
    const timestamp = Date.now();
    query.append('timestamp', timestamp.toString());
    const signature = sign(query.toString());
    query.append('signature', signature);
  }

  const url = `${BASE_URL}${path}?${query.toString()}`;
  const options = { method, headers };

  const res = await fetch(url, options);
  const json = await res.json();

  if (!res.ok || json.code < 0) {
  if (json.msg !== 'Invalid symbol.') {
    console.error('[ERROR] API Error:', json);
  }
  throw new Error(json.msg || 'Binance API error');
}

  return json;
}

function toFixedFloor(value, decimals) {
  const factor = Math.pow(10, decimals);
  return (Math.floor(value * factor) / factor).toFixed(decimals);
}

function decimalsFromStep(step) {
  const s = step.toString();
  if (!s.includes(".")) return 0;
  return s.split(".")[1].replace(/0+$/, "").length;
}

async function getSymbolFilters(symbol) {
  const data = await binanceRequest("/api/v3/exchangeInfo", "GET", { symbol });
  const info = data?.symbols?.[0];
  if (!info) throw new Error(`Нет данных по символу ${symbol}`);

  const lot = info.filters.find((f) => f.filterType === "LOT_SIZE");
  const minNotional =
    info.filters.find((f) => f.filterType === "MIN_NOTIONAL") ||
    info.filters.find((f) => f.filterType === "NOTIONAL");

  if (!lot) throw new Error(`Нет LOT_SIZE фильтра у ${symbol}`);

  return {
    stepSize: lot.stepSize,
    minQty: lot.minQty,
    maxQty: lot.maxQty,
    minNotional: minNotional?.minNotional ?? minNotional?.notional ?? null,
  };
}

function adjustToLotSize(qty, stepSize) {
  const step = parseFloat(stepSize);
  if (!step || step <= 0) return qty;

  const steps = Math.floor(qty / step);
  const adjusted = steps * step;

  const dec = decimalsFromStep(stepSize);
  return parseFloat(toFixedFloor(adjusted, dec));
}


export const startBinance = async (token) => {
  const SYMBOL = `${token}USDT`;
  const CHECK_INTERVAL = 2000;

  async function isTradingPairAvailable() {
  try {
    const data = await binanceRequest('/api/v3/exchangeInfo', 'GET', { symbol: SYMBOL });
    return !!data && !!data.symbols && data.symbols.length > 0;
  } catch (e) {
    if (e.message.includes('Invalid symbol')) {
      return false; // символ еще не активен, продолжаем ждать
    }
    console.error('[ERROR] Неизвестная ошибка при проверке символа:', e.message);
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
    if (dotCount % 30 === 0) process.stdout.write(` ← ждем ${SYMBOL}\n`);
    await new Promise((res) => setTimeout(res, CHECK_INTERVAL));
  }

  async function checkBalance() {
  const data = await binanceRequest('/api/v3/account', 'GET', {}, true);
    const assetInfo = data.balances.find((b) => b.asset === token);
    return parseFloat(assetInfo?.free || 0);
  }

async function sellToken(amount) {
  const { stepSize, minQty, maxQty } = await getSymbolFilters(SYMBOL);

  let qty = adjustToLotSize(amount, stepSize);

  const minQ = parseFloat(minQty);
  const maxQ = parseFloat(maxQty);

  if (qty < minQ) {
    return { sold: false, reason: "lt_minQty", qty, minQ };
  }

  if (qty > maxQ) {
    qty = adjustToLotSize(maxQ, stepSize);
  }

  const params = {
    symbol: SYMBOL,
    side: "SELL",
    type: "MARKET",
    quantity: qty.toString(),
  };

  const data = await binanceRequest("/api/v3/order", "POST", params, true);

  if (!data?.fills?.length) {
    return { sold: false, reason: "no_fills" };
  }

  let totalValue = 0;
  let totalAmount = 0;
  let totalFee = 0;

  for (const f of data.fills) {
    const price = parseFloat(f.price);
    const q = parseFloat(f.qty);
    const fee = parseFloat(f.commission);

    totalAmount += q;
    totalValue += price * q;
    totalFee += fee;
  }

  const avgPrice = totalValue / totalAmount;

  log(
    "info",
    `💵 Продано ${totalAmount} ${token} по средней цене ${avgPrice.toFixed(
      4
    )} USDT. Сумма ${totalValue.toFixed(2)} USDT (комиссия ${totalFee} ${
      data.fills[0].commissionAsset
    })`,
    "green"
  );

  return { sold: true };
}



  console.log(`⏳ Авто-продажа: жду пополнения ${token} и продаю по мере поступления...`);

const { minQty } = await getSymbolFilters(SYMBOL);
const minQ = parseFloat(minQty);

let lastBalance = 0;

while (true) {
  try {
    const balance = await checkBalance();
    console.log(`📦 Баланс ${token}: ${balance}`);

    // Если баланс не изменился — просто ждём
    if (balance === lastBalance) {
      await new Promise((res) => setTimeout(res, CHECK_INTERVAL));
      continue;
    }
    lastBalance = balance;

    if (balance < minQ) {
      console.log(`⏳ Мало для продажи: нужно >= ${minQ} ${token}. Жду пополнения...`);
      await new Promise((res) => setTimeout(res, CHECK_INTERVAL));
      continue;
    }

    console.log(`📤 Достаточно для продажи. Продаю...`);
    const result = await sellToken(balance);

    if (!result.sold && result.reason === "lt_minQty") {
      // на случай если после округления вниз стало меньше minQty
      console.log(
        `⏳ После округления qty=${result.qty} < minQty=${result.minQ}. Жду пополнения...`
      );
    } else if (result.sold) {
      // после продажи даём бирже обновить баланс
      await new Promise((res) => setTimeout(res, CHECK_INTERVAL));
      // и сбрасываем lastBalance, чтобы точно отреагировать на изменения
      lastBalance = -1;
    } else {
      console.log(`⚠️ Продать не удалось (${result.reason}). Продолжаю ожидание...`);
    }

    await new Promise((res) => setTimeout(res, CHECK_INTERVAL));
  } catch (e) {
    console.error("Ошибка:", e.message);
    await new Promise((res) => setTimeout(res, CHECK_INTERVAL));
  }
}

};
