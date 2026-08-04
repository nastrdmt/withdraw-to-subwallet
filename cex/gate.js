import 'dotenv/config';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { log } from '../src/other.js';

const API_KEY = process.env.GATE_API_KEY;
const API_SECRET = process.env.GATE_SECRET_KEY;
const BASE_URL = 'https://api.gateio.ws/api/v4';

// ✅ Создание подписи
function sign(fullPath, method, body = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = crypto.createHash('sha512').update(body).digest('hex');

  const parsed = new URL(fullPath, BASE_URL); // Парсим URL, извлекаем path и query
  const path = parsed.pathname;
  const query = parsed.search.replace(/^\?/, ''); // убираем ведущий `?`, если есть

  const payload = [
    method.toUpperCase(),
    path,
    query,
    bodyHash,
    timestamp
  ].join('\n');

  const signature = crypto
    .createHmac('sha512', API_SECRET)
    .update(payload)
    .digest('hex');

  return {
    KEY: API_KEY,
    SIGN: signature,
    Timestamp: timestamp.toString(),
    'Content-Type': 'application/json',
  };
}

// ✅ Запрос с правильной подписью и передачей query/body
async function gateRequest(path, method = 'GET', params = {}, isSigned = false) {
  let query = '';
  let body = '';
  let url = `${BASE_URL}${path}`;

  if (method === 'GET' && Object.keys(params).length > 0) {
    const queryParams = new URLSearchParams(params);
    query = queryParams.toString();
    url += `?${query}`;
  } else if (method !== 'GET') {
    body = JSON.stringify(params);
  }

  const headers = isSigned ? sign(url, method, body) : { 'Content-Type': 'application/json' };
//   console.log('SIGNED HEADERS:', headers);

  const options = {
    method,
    headers,
    body: method !== 'GET' && body ? body : undefined,
  };

//   console.log('📡 URL:', url);
//   console.log('📨 Method:', method);
//   console.log('📥 Body:', body);

  const res = await fetch(url, options);
  const json = await res.json();

  if (!res.ok || json.label === 'INVALID_SIGNATURE') {
    console.error('[ERROR] API Error:', json);
    throw new Error(json.message || 'Gate.io API error');
  }

  return json;
}

export const startGate = async (token) => {
  if (!API_KEY || !API_SECRET) {
    throw new Error('Gate.io API ключи не найдены в переменных окружения');
  }

//   console.log('API_KEY loaded:', !!API_KEY);
//   console.log('API_SECRET loaded:', !!API_SECRET);
//   console.log('Current time:', new Date().toISOString());
//   console.log('Unix timestamp:', Math.floor(Date.now() / 1000));



  const SYMBOL = `${token}_USDT`;
  const CHECK_INTERVAL = 1000;

  async function isTradingPairAvailable() {
    try {
      const data = await gateRequest(`/spot/currency_pairs/${SYMBOL}`);
      return data?.trade_status === 'tradable';
    } catch (e) {
      console.error(`Ошибка проверки пары ${SYMBOL}:`, e.message);
      return false;
    }
  }

  async function checkBalance() {
    const data = await gateRequest('/spot/accounts', 'GET', {}, true);
    const asset = data.find(a => a.currency === token);
    return parseFloat(asset?.available || 0);
  }

 async function sellToken(amount) {
  const order = {
    currency_pair: SYMBOL,
    type: 'market',
    side: 'sell',
    amount: amount.toString(),
    time_in_force: 'ioc',
  };

  const result = await gateRequest('/spot/orders', 'POST', order, true);
// console.log('🧾 Ордер результат:', JSON.stringify(result, null, 2));

  // Подсчитываем сумму в USDT из списка сделок (fills)
  
 const avgPrice = parseFloat(result.avg_deal_price);
const totalUSDT = parseFloat(result.filled_total);

log(
  'info',
  `💵 Продано ${amount.toFixed(2)} ${token} по цене ≈ ${avgPrice.toFixed(3)} USDT. Получено: ${totalUSDT.toFixed(2)} USDT`,
  'green'
);
}

  console.log(`⏳ Ожидание запуска торгов пары ${SYMBOL}...`);

  try {
    // console.log('Тестируем подключение к API...');
    await gateRequest('/spot/currencies/USDT', 'GET', {}, false);
    // console.log('✅ Публичный API работает');
  } catch (e) {
    console.error('❌ Ошибка публичного API:', e.message);
  }

  while (!(await isTradingPairAvailable())) {
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }

  console.log(`\n✅ Торги по паре ${SYMBOL} начались.`);
  console.log(`⏳ Ожидание поступления ${token} на спотовый баланс...`);

while (true) {
  try {
    const balance = await checkBalance();
    process.stdout.write('.'); // вывод точки без перехода строки

    if (balance > 0.1) {
      process.stdout.write('\n'); // перенос строки перед следующим логом
      console.log(`📦 Баланс ${token}: ${balance}`);
      console.log(`📤 ${token} получен. Продаю...`);
      await sellToken(balance);
      break;
    }

    await new Promise(res => setTimeout(res, CHECK_INTERVAL));
  } catch (e) {
    process.stdout.write('\n'); // тоже перенос строки, если ошибка
    console.error('Ошибка:', e.message);
    await new Promise(res => setTimeout(res, CHECK_INTERVAL));
  }
}
};
