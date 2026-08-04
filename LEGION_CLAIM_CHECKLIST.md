# Legion QUID claim: план подготовки и критерии готовности

Этот документ фиксирует всё, что необходимо для максимально надёжного клейма QUID
с двух Legion-аккаунтов. Он не содержит cookie, приватных ключей или подписей.

## 1. Что уже подтверждено

### Legion API

- Список allocations: `GET https://api.legion.cc/distributions`.
- Полная distribution: `GET https://api.legion.cc/distributions/{slug}`.
- Подписи: `GET https://app.legion.cc/api/distributions/signatures?slug={slug}`.
- `api.legion.cc` требует cookie `DYNAMIC_JWT_TOKEN`.
- Next.js endpoint на `app.legion.cc` требует cookie `session`.
- Для полного процесса нужны обе cookie.
- `cf_clearance`, analytics-cookie, Bearer token и CSRF-заголовок не требуются
  для проверенных endpoint.
- Ответ signatures содержит `claimMessage`, `claimSignature`, `vestingMessage`,
  `vestingSignature`.

### Контракт

Подтверждённая функция:

```solidity
claimTokenAllocation(
    uint256 claimAmount,
    LegionInvestorVestingConfig investorVestingConfig,
    bytes claimSignature,
    bytes vestingSignature
)
```

Selector: `0x57e72d9f`.

Подтверждённая структура tuple и порядок полей:

```solidity
struct LegionInvestorVestingConfig {
    uint64 vestingStartTime;
    uint64 vestingDurationSeconds;
    uint64 vestingCliffDurationSeconds;
    uint8 vestingType;
    uint64 epochDurationSeconds;
    uint64 numberOfEpochs;
    uint64 tokenAllocationOnTGERate;
}
```

- `LINEAR` подтверждён как `vestingType = 0`.
- Проверенные CLAIM-транзакции отправлялись с `value = 0`.
- Distributor является `LegionTokenDistributor` minimal proxy.
- `claimMessage` и `vestingMessage` подписываются по EIP-191.
- Восстановленный signer должен совпадать с
  `distributorConfiguration().legionSigner`.
- Для суммы calldata используется только строка `recipient.claimAmount`.
  Числовые `transactions[].amount` и `txAmount` использовать нельзя из-за потери
  точности JavaScript Number.

## 2. Модель двух аккаунтов

Каждая запись должна однозначно связывать:

```text
приватный ключ -> вычисленный адрес -> Legion session -> DYNAMIC_JWT_TOKEN
```

Связь выполняется по адресу, а не по номеру строки. Перед любым клеймом обязательно:

```text
address(privateKey)
  == локально закреплённый walletAddress
  == distribution.recipient.walletAddress
```

Несовпадение останавливает только проблемный аккаунт и запрещает отправку.

Планируемые локальные данные для каждого аккаунта:

- `walletAddress` — публичный адрес;
- ссылка на файл с `session`;
- ссылка на файл с `DYNAMIC_JWT_TOKEN`;
- приватный ключ остаётся в существующем `private.txt`;
- cookie и ключи никогда не записываются в логи и не помещаются в Git.

## 3. Данные, которые появятся только после публикации QUID

Для каждого аккаунта получить через его собственную сессию:

- `slug` (ожидается QUID, но значение не угадывать);
- `distributionType`;
- `chain.id`, `chain.name`, `chain.type`;
- `contract.address`;
- `token.address`, `token.symbol`, `token.decimals`;
- `recipient.walletAddress`;
- строку `recipient.claimAmount`;
- все семь полей vesting tuple;
- `claimStartTime`;
- `tgeClaimed` из списка distributions;
- четыре поля ответа signatures.

После появления QUID вручную закрепить ожидаемые значения:

- chain ID;
- distributor address;
- token address;
- recipient каждого аккаунта;
- claim amount каждого аккаунта.

Скрипт не должен автоматически принимать впервые увиденный контракт или токен как
доверенный.

## 4. Проверка сессий перед стартом

Для каждого аккаунта отдельно:

1. `GET /distributions` с его `DYNAMIC_JWT_TOKEN` должен вернуть HTTP 200 и JSON.
2. В списке должна находиться allocation с нужным slug и walletAddress.
3. `GET /distributions/{slug}` должен вернуть HTTP 200 и полную distribution.
4. Signatures endpoint с его `session` должен вернуть HTTP 200 и JSON либо
   ожидаемый ответ «ещё не готово» до старта.
5. HTTP 401 от `api.legion.cc` означает необходимость обновить
   `DYNAMIC_JWT_TOKEN`.
6. HTTP 401 от `app.legion.cc` означает необходимость обновить `session`.
7. HTML, redirect, Cloudflare challenge или неожиданная структура JSON считаются
   ошибкой и запрещают отправку.

Проверить обе сессии заранее и повторно незадолго до `claimStartTime`.

## 5. Обязательные off-chain проверки distribution

Перед подготовкой calldata проверить:

- `distributionType === "CLAIM"`;
- `chain.type === "EVM"`;
- chain ID входит в явно разрешённый список;
- RPC фактически отвечает тем же chain ID;
- recipient совпадает с адресом приватного ключа;
- token и distributor совпадают с вручную закреплёнными адресами;
- `claimAmount` является непустой целочисленной строкой и больше нуля;
- все числовые vesting-поля целые, неотрицательные и помещаются в свои типы;
- строковый vesting type имеет заранее подтверждённое отображение в `uint8`;
- selector ABI равен `0x57e72d9f`;
- текущее время не раньше `claimStartTime`;
- `tgeClaimed !== true`.

Неизвестный `vestingType`, новая структура ABI или отсутствующее поле должны
останавливать клейм, а не подставлять значение по умолчанию.

## 6. Обязательные on-chain проверки

Непосредственно перед получением подписей и повторно перед broadcast:

- по адресу distributor существует bytecode;
- вызов `distributorConfiguration()` успешен;
- `tokensSupplied === true`;
- `askToken` совпадает с `distribution.token.address`;
- `legionSigner` не является zero address;
- `investorPosition(wallet).hasSettled === false`;
- контракт не находится на паузе, если метод `paused()` доступен;
- баланс токена distributor достаточен для исполнения allocation согласно логике
  контракта;
- RPC chain ID совпадает с distribution и локальной конфигурацией.

Так как distributor может быть minimal proxy, проверяется состояние конкретного
proxy-адреса из QUID distribution, а не старого Intuition/Almanak контракта.

## 7. Проверка подписей

Для `claimMessage/claimSignature` и `vestingMessage/vestingSignature`:

- message должен быть `bytes32` (`0x` + 64 hex-символа);
- signature должна быть 65 байт;
- выполнить EIP-191 recovery;
- обе подписи должны восстановить один адрес;
- восстановленный адрес должен равняться on-chain `legionSigner`;
- нельзя смешивать distribution, signatures или cookie разных аккаунтов;
- подписи получать заново непосредственно перед симуляцией.

Буквальное совпадение подписи со старой транзакцией не требуется: сервер может
выпустить другую валидную ECDSA-подпись.

## 8. Построение и симуляция транзакции

Calldata строится только ABI-кодировщиком из уже установленного `ethers`/`web3`:

```text
claimAmount = recipient.claimAmount
vesting tuple = поля recipient в подтверждённом порядке
claimSignature = свежий ответ signatures
vestingSignature = свежий ответ signatures
to = distribution.contract.address
value = 0, если конкретный QUID-контракт и симуляция не показывают иное
```

До подписи транзакции обязательны:

1. Проверка первых четырёх байт calldata (`0x57e72d9f`).
2. `eth_call` от адреса реального получателя.
3. `eth_estimateGas` с теми же `from`, `to`, `data`, `value`.
4. Повторная проверка chain ID, recipient, token, contract и `hasSettled`.
5. Никакого broadcast при revert, неожиданном результате или смене параметров.

Gas limit задаётся от успешного estimate с разумным запасом. Нельзя слепо копировать
gas старых Intuition/Almanak транзакций.

## 9. Broadcast для двух аккаунтов

- Оба аккаунта могут параллельно ждать время старта и готовность signatures.
- Nonce получается отдельно для каждого кошелька с тегом `pending`.
- Каждая транзакция подписывается только соответствующим приватным ключом.
- Перед автоматическим broadcast должна существовать отдельная явная настройка.
- Без неё требуется подтверждение пользователя после успешной симуляции.
- Повторная отправка запрещена, пока судьба предыдущего hash не установлена.
- При timeout сначала проверяются receipt, pending nonce и `hasSettled`; нельзя
  сразу создавать дубликат.
- Ошибка одного аккаунта не должна автоматически отменять безопасную обработку
  второго.

## 10. Проверка результата

Клейм считается успешным только после всех проверок:

- receipt найден и `status === 1`;
- адрес receipt соответствует отправленному hash;
- есть ожидаемое событие `TokenAllocationClaimed` и/или ERC-20 `Transfer`;
- получатель события совпадает с кошельком;
- token события совпадает с QUID token address;
- on-chain `investorPosition(wallet).hasSettled === true`;
- изменение баланса согласуется с TGE/vesting-конфигурацией;
- hash, block number и итоговый статус записаны в лог.

Cookie, приватные ключи, полные signatures и полное calldata в лог не записываются.

## 11. Поведение при нестандартном сценарии

Безусловная остановка аккаунта при:

- `AIRDROP` вместо `CLAIM`;
- неизвестной сети или vesting type;
- изменении ABI/selector;
- несовпадении любого адреса или суммы;
- истёкшей или перепутанной сессии;
- неподтверждённом signer;
- отсутствии токенов у distributor;
- paused contract;
- уже выполненном claim;
- failed simulation;
- неожиданном ненулевом `value`;
- невозможности однозначно определить состояние предыдущей транзакции.

## 12. План интеграции в текущий проект

Без новых библиотек:

- `function/legionClaim.js` — обработка одного Legion-аккаунта;
- `function/legionClaimRunner.js` — управление двумя аккаунтами;
- минимальные ABI-фрагменты добавляются в `src/abi.js`;
- отдельный пункт `Legion Claim` добавляется в `index.js`;
- существующий `function/claimToken.js` не переиспользуется, потому что относится к
  другому протоколу;
- используются уже установленные `ethers`, `web3` и `node-fetch`;
- `package.json` и `package-lock.json` не меняются.

## 13. Этапы реализации и проверки

1. Read-only клиент API и проверка двух сессий.
2. Загрузка и строгая валидация двух аккаунтов.
3. ABI-кодирование на зафиксированных данных Intuition.
4. Сравнение полученного calldata с исторической транзакцией Intuition.
5. Read-only on-chain проверки distributor.
6. Симуляция без подписи и без broadcast.
7. Dry-run режим для будущего QUID.
8. Ручная фиксация опубликованных параметров QUID.
9. Повторная проверка обеих сессий и RPC перед claimStartTime.
10. Только после успешного dry-run — разрешение реального broadcast.

## 14. Критерий готовности к реальному клейму

Система готова, когда для обоих аккаунтов одновременно выполнено следующее:

- свежие `session` и `DYNAMIC_JWT_TOKEN` проходят проверки;
- QUID distribution опубликована и вручную сверена;
- все API/on-chain значения совпадают с закреплёнными;
- ABI и vesting type подтверждены;
- signatures валидны и подписаны on-chain `legionSigner`;
- calldata успешно прошла локальное сравнение и `eth_call`;
- gas успешно оценён;
- аккаунт ещё не settled;
- достаточно нативного токена на газ;
- выбран и явно подтверждён режим broadcast;
- определён порядок действий при RPC/API ошибке или pending-транзакции.

Абсолютную гарантию результата дать невозможно из-за внешних факторов: доступности
Legion API/RPC, изменения контракта, состояния сети и конкуренции транзакций. Этот
чеклист устраняет известные технические неопределённости и запрещает отправку при
любом обнаруженном расхождении.
