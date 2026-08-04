/*
 * Read-only PancakeSwap Infinity PoolKey scanner.
 *
 * Ничего не подписывает и не отправляет.
 *
 * По умолчанию ищет QUID:
 * node PANCAKE_INFINITY_SCAN.js
 *
 * Проверка другого токена:
 * node PANCAKE_INFINITY_SCAN.js 0xTokenAddress
 *
 * Остановка:
 * Ctrl + C
 */

import {
    info,
    log,
    timeout
} from './src/other.js';

import {
    getProvider
} from './src/web3.js';

import {
    pancakeInfinityPoolManagerAbi,
    pancakeInfinityCLInitializeEventAbi,
    pancakeInfinityBinInitializeEventAbi
} from './src/abi.js';

import {
    createRpcPool,
    uniqueRpcUrls
} from './src/rpcPool.js';


const CHAIN_ID = 8453;

const cfg =
    info.pancakeInfinity
        ?.chains?.[CHAIN_ID];

if (!cfg) {
    throw new Error(
        `Pancake Infinity config is missing for chainId ${CHAIN_ID}`
    );
}


const rpcUrls = uniqueRpcUrls([
    info.rpcBase,  
    info.rpcBaseCDP,
    info.rpcBaseAlchemy,

]);

const readRpcPool =
    createRpcPool(rpcUrls);

const decoder =
    getProvider(rpcUrls[0]);


const tokenAddress =
    process.argv[2] ||
    info.QUID;

if (
    !decoder.utils.isAddress(
        tokenAddress
    )
) {
    throw new Error(
        `Invalid token address: ${tokenAddress}`
    );
}

const targetToken =
    tokenAddress.toLowerCase();

    const targetTokenTopic =
    decoder.utils.padLeft(
        targetToken,
        64
    );

const lookbackBlocks = Math.max(
    1,
    Number(
        process.env
            .PANCAKE_INFINITY_LOOKBACK_BLOCKS ||
        500000
    )
);

const chunkSize = Math.max(
    1000,
    Number(
        process.env
            .PANCAKE_INFINITY_LOG_CHUNK ||
        50000
    )
);

const pollMs = Math.max(
    250,
    Number(
        process.env
            .PANCAKE_INFINITY_POLL_MS ||
        1000
    )
);


const definitions = [
    {
        type: 'CL',

        address:
            cfg.clPoolManager,

        deploymentBlock:
            Number(
                cfg.clDeploymentBlock
            ),

        eventAbi:
            pancakeInfinityCLInitializeEventAbi
    },

    {
        type: 'BIN',

        address:
            cfg.binPoolManager,

        deploymentBlock:
            Number(
                cfg.binDeploymentBlock
            ),

        eventAbi:
            pancakeInfinityBinInitializeEventAbi
    }
];


const seenPools =
    new Set();

let stopped = false;


const getLatestBlock =
    async () => {
        return Number(
            await readRpcPool.run(
                async currentRpc => {
                    const provider =
                        getProvider(
                            currentRpc
                        );

                    return await provider.eth
                        .getBlockNumber();
                },
                {
                    label:
                        'Infinity latest block'
                }
            )
        );
    };


const readPoolKey =
    async ({
        definition,
        poolId
    }) => {
        return await readRpcPool.run(
            async currentRpc => {
                const provider =
                    getProvider(
                        currentRpc
                    );

                const contract =
                    new provider.eth.Contract(
                        pancakeInfinityPoolManagerAbi,
                        definition.address
                    );

                return await contract.methods
                    .poolIdToPoolKey(
                        poolId
                    )
                    .call();
            },
            {
                label:
                    `Infinity ${definition.type} PoolKey`
            }
        );
    };


const getMappedValue = (
    result,
    name,
    index
) => {
    return (
        result?.[name] ??
        result?.[index]
    );
};


const decodeInitializeLog =
    async ({
        definition,
        rawLog
    }) => {
        const decoded =
            decoder.eth.abi.decodeLog(
                definition
                    .eventAbi
                    .inputs,

                rawLog.data,

                rawLog.topics.slice(1)
            );

        const mapped =
            await readPoolKey({
                definition,
                poolId: decoded.id
            });

        const currency0 =
            getMappedValue(
                mapped,
                'currency0',
                0
            );

        const currency1 =
            getMappedValue(
                mapped,
                'currency1',
                1
            );

        const hooks =
            getMappedValue(
                mapped,
                'hooks',
                2
            );

        const poolManager =
            getMappedValue(
                mapped,
                'poolManager',
                3
            );

        const fee =
            getMappedValue(
                mapped,
                'fee',
                4
            );

        const parameters =
            getMappedValue(
                mapped,
                'parameters',
                5
            );

        if (
            poolManager.toLowerCase() !==
            definition.address.toLowerCase()
        ) {
            throw new Error(
                `${definition.type} PoolManager mismatch for ${decoded.id}`
            );
        }

        return {
            protocol:
                'PANCAKE_INFINITY',

            poolType:
                definition.type,

            poolId:
                decoded.id,

            poolKey: {
                currency0,
                currency1,
                hooks,
                poolManager,
                fee:
                    String(fee),
                parameters
            },

            initialization:
                definition.type === 'CL'
                    ? {
                        sqrtPriceX96:
                            String(
                                decoded
                                    .sqrtPriceX96
                            ),

                        tick:
                            String(
                                decoded.tick
                            )
                    }
                    : {
                        activeId:
                            String(
                                decoded.activeId
                            )
                    },

            blockNumber:
                Number(
                    rawLog.blockNumber
                ),

            transactionHash:
                rawLog.transactionHash
        };
    };


const isTargetPool =
    pool => {
        return (
            pool.poolKey.currency0
                .toLowerCase() ===
                targetToken ||

            pool.poolKey.currency1
                .toLowerCase() ===
                targetToken
        );
    };


const printPool =
    pool => {
        const key =
            `${pool.poolType}:${pool.poolId}`;

        if (seenPools.has(key)) {
            return false;
        }

        seenPools.add(key);

        log(
            'info',
            `[Infinity] Found ${pool.poolType} pool for ${tokenAddress}`,
            'green'
        );

        console.dir(
            pool,
            {
                depth: null,
                colors: true
            }
        );

        return true;
    };


const scanDefinition =
    async ({
        definition,
        fromBlock,
        toBlock
    }) => {
        const pools = [];

        const startBlock = Math.max(
            Number(fromBlock),
            definition.deploymentBlock
        );

        if (
            startBlock >
            Number(toBlock)
        ) {
            return pools;
        }

        const eventSignature =
            decoder.eth.abi
                .encodeEventSignature(
                    definition.eventAbi
                );

        for (
            let currentFrom =
                startBlock;

            currentFrom <=
                Number(toBlock);

            currentFrom +=
                chunkSize
        ) {
            if (stopped) {
                break;
            }

            const currentTo =
                Math.min(
                    Number(toBlock),
                    currentFrom +
                        chunkSize -
                        1
                );

            /*
 * Initialize:
 *
 * topics[0] = сигнатура события
 * topics[1] = poolId
 * topics[2] = currency0
 * topics[3] = currency1
 *
 * Одним eth_getLogs нельзя выразить:
 * currency0 == token ИЛИ currency1 == token.
 * Поэтому выполняются два точных запроса.
 */
const readFilteredLogs =
    async ({
        topics,
        position
    }) => {
        return await readRpcPool.run(
            async currentRpc => {
                const provider =
                    getProvider(
                        currentRpc
                    );

                return await provider.eth
                    .getPastLogs({
                        address:
                            definition.address,

                        fromBlock:
                            currentFrom,

                        toBlock:
                            currentTo,

                        topics
                    });
            },
            {
                label:
                    `Infinity ${definition.type} ${position} logs`,

                rotate: false,
                timeoutMs: 30000
            }
        );
    };


const [
    currency0Logs,
    currency1Logs
] = await Promise.all([
    /*
     * QUID находится в currency0.
     */
    readFilteredLogs({
        position:
            'currency0',

        topics: [
            eventSignature,
            null,
            targetTokenTopic
        ]
    }),

    /*
     * QUID находится в currency1.
     */
    readFilteredLogs({
        position:
            'currency1',

        topics: [
            eventSignature,
            null,
            null,
            targetTokenTopic
        ]
    })
]);


/*
 * Теоретически одинаковый лог не должен попасть
 * в оба результата, но всё равно убираем дубликаты.
 */
const uniqueLogs =
    new Map();

for (
    const rawLog of [
        ...currency0Logs,
        ...currency1Logs
    ]
) {
    const logKey =
        `${rawLog.transactionHash}:${rawLog.logIndex}`;

    uniqueLogs.set(
        logKey,
        rawLog
    );
}

const logs =
    [...uniqueLogs.values()];

            for (
                const rawLog of logs
            ) {
                const pool =
                    await decodeInitializeLog({
                        definition,
                        rawLog
                    });

                if (!isTargetPool(pool)) {
                    continue;
                }

                pools.push(pool);
                printPool(pool);
            }
        }

        return pools;
    };


const scanRange =
    async (
        fromBlock,
        toBlock
    ) => {
        const results = [];

        for (
            const definition
            of definitions
        ) {
            const pools =
                await scanDefinition({
                    definition,
                    fromBlock,
                    toBlock
                });

            results.push(
                ...pools
            );
        }

        return results;
    };


const main =
    async () => {
        const latestBlock =
            await getLatestBlock();

        const initialFromBlock =
            Math.max(
                0,
                latestBlock -
                    lookbackBlocks
            );

        log(
            'info',
            `[Infinity] Scanning ${tokenAddress} from block ` +
            `${initialFromBlock} to ${latestBlock}`,
            'yellow'
        );

        const initialPools =
            await scanRange(
                initialFromBlock,
                latestBlock
            );

        if (
            initialPools.length === 0
        ) {
            log(
                'info',
                `[Infinity] No CL/BIN pools found for ${tokenAddress}. ` +
                `Watching new blocks...`,
                'yellow'
            );
        } else {
            log(
                'info',
                `[Infinity] Initial scan found ${initialPools.length} pools. ` +
                `Watching for additional pools...`,
                'green'
            );
        }

        let nextBlock =
            latestBlock + 1;

        while (!stopped) {
            await timeout(pollMs);

            try {
                const currentLatest =
                    await getLatestBlock();

                if (
                    currentLatest <
                    nextBlock
                ) {
                    continue;
                }

                await scanRange(
                    nextBlock,
                    currentLatest
                );

                nextBlock =
                    currentLatest + 1;
            } catch (error) {
                log(
                    'info',
                    `[Infinity] Watch error: ${
                        error?.message ||
                        error
                    }`,
                    'red'
                );
            }
        }
    };


process.on(
    'SIGINT',
    () => {
        stopped = true;

        log(
            'info',
            '[Infinity] Scanner stopped',
            'yellow'
        );
    }
);


await main();