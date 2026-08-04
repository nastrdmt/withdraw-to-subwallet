# Legion universal claim

Скрипт работает отдельно от `index.js` и существующих DEX-файлов. Новые npm-пакеты
не требуются.

## Файлы

- `LEGION_CLAIM.js` — точка запуска.
- `LEGION_CLAIM_CONFIG.json` — публичная конфигурация проекта и двух кошельков.
- `LEGION_CLAIM_LOCK.json` — автоматически созданный snapshot API и Factory.
- `LEGION_CLAIM_ENV.example` — названия секретных переменных.
- `function/legionClaim.js` — API, проверки, симуляция, подпись и receipt.

## Секреты

Для каждого Legion-аккаунта нужны две cookie:

1. DevTools → Application → Cookies → `https://api.legion.cc` →
   `DYNAMIC_JWT_TOKEN`.
2. DevTools → Application → Cookies → `https://app.legion.cc` → `session`.

Сохранить только значения cookie в четыре отдельных текстовых файла:

```text
.legion-secrets/legion-1.dynamic-jwt-token
.legion-secrets/legion-1.session
.legion-secrets/legion-2.dynamic-jwt-token
.legion-secrets/legion-2.session
```

Папка `.legion-secrets/` добавлена в `.gitignore`. В файл можно положить либо
чистое значение, либо строку `NAME=value`. Cookie нельзя отправлять в чат,
помещать в `LEGION_CLAIM_CONFIG.json` или выводить в терминал.
Приватные ключи берутся из `private.txt`: первая непустая строка для аккаунта 1,
вторая — для аккаунта 2.

## Режимы

Разовая read-only проверка обеих сессий:

```powershell
node LEGION_CLAIM.js --mode check
```

Автоматический поиск distributor через Legion Factory и создание lock-файла:

```powershell
node LEGION_CLAIM.js --mode prepare
```

`prepare` сначала получает token/chain из `/projects/{slug}/simple`, затем следит
за `NewTokenDistributorCreated` закреплённой Factory, ждёт distribution обоих
аккаунтов и записывает проверенные суммы, wallet, vesting и адреса в
`LEGION_CLAIM_LOCK.json`. Cookie и signatures туда не попадают.

Ожидание distribution/signatures и симуляция без отправки:

```powershell
node LEGION_CLAIM.js --mode watch
```

Только один аккаунт:

```powershell
node LEGION_CLAIM.js --mode watch --account 1
```

## Подготовка нового проекта

В `LEGION_CLAIM_CONFIG.json` для нового проекта достаточно заменить:

- `projectSlug`;
- `distributionSlug`;
- RPC-конфигурацию сети при необходимости.

Поля chain, token, distributor, claim amount, wallet и vesting заполняются в
lock-файл автоматически. `watch/auto` при каждом запросе требуют полного
совпадения свежего API с этим snapshot.

Существующий lock с другими данными не перезаписывается. После осознанной
проверки новый snapshot можно создать с резервной копией старого:

```powershell
node LEGION_CLAIM.js --mode prepare --replace-lock
```

## Автоматический broadcast

Разрешается только после успешного `check`, опубликованной distribution и проверки
режима `watch`.

1. Выполнить `--mode prepare` и получить действительный lock-файл.
2. В конфиге установить `"allowBroadcast": true`.
3. В `.env` установить:

```env
LEGION_BROADCAST_CONFIRM=I_UNDERSTAND
```

4. Запустить:

```powershell
node LEGION_CLAIM.js --mode auto
```

Либо в двух PowerShell отдельно:

```powershell
node LEGION_CLAIM.js --mode auto --account 1
node LEGION_CLAIM.js --mode auto --account 2
```

Скрипт получает nonce отдельно для каждого кошелька, выполняет `eth_call`,
`estimateGas`, проверяет signer и состояние distributor, ждёт receipt и считает
клейм успешным только при `status = 1`, событии `TokenAllocationClaimed` и
`investorPosition.hasSettled = true`.

При timeout hash не отправляется повторно автоматически.

