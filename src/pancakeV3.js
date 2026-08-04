import { multiply } from 'mathjs';
import { factoryAbi, quoterAbiV2, pancakeV3RouterAbi } from './abi.js';
import { getDataCall, getDataTx, getProvider } from './web3.js';
import { info } from './other.js';

const normalizeAddress = address => {
    return address.toLowerCase();
};

const pancakeV3RouteCache = new Map();

const cloneRoute = route => {
    return {
        ...route,
        tokens: [...route.tokens],
        fees: [...route.fees],
        pools: [...route.pools]
    };
};

export const getPancakeV3RouteCacheKey = ({
    cfg,
    tokenIn,
    tokenOut
}) => {
    return [
        String(cfg.name || 'unknown').toLowerCase(),
        normalizeAddress(cfg.factory),
        normalizeAddress(tokenIn),
        normalizeAddress(tokenOut)
    ].join(':');
};

export const getCachedPancakeV3Routes = ({
    cfg,
    tokenIn,
    tokenOut
}) => {
    const key = getPancakeV3RouteCacheKey({
        cfg,
        tokenIn,
        tokenOut
    });

    const cached = pancakeV3RouteCache.get(key);

    if (!cached) {
        return null;
    }

    return {
        ...cached,
        routes: cached.routes.map(cloneRoute)
    };
};

export const clearCachedPancakeV3Routes = ({
    cfg,
    tokenIn,
    tokenOut
}) => {
    const key = getPancakeV3RouteCacheKey({
        cfg,
        tokenIn,
        tokenOut
    });

    return pancakeV3RouteCache.delete(key);
};

const isZeroAddress = address => {
    if (!address) return true;

    return normalizeAddress(address) === info.ZERO_ADDRESS;
};

const getSingleResult = result => {
    if (Array.isArray(result)) {
        return result[0];
    }

    return result;
};

export const encodePancakeV3Path = (tokens, fees) => {
    if (tokens.length !== fees.length + 1) {
        throw new Error(
            'Invalid Pancake V3 path: tokens/fees length mismatch'
        );
    }

    let encoded = '0x';

    for (let i = 0; i < fees.length; i++) {
        encoded += normalizeAddress(tokens[i]).slice(2);

        encoded += Number(fees[i])
            .toString(16)
            .padStart(6, '0');
    }

    encoded += normalizeAddress(tokens[tokens.length - 1]).slice(2);

    return encoded;
};


export const getPancakeV3Pool = async ({
    rpcUrl,
    cfg,
    tokenA,
    tokenB,
    fee
}) => {
    const result = await getDataCall(
        rpcUrl,
        factoryAbi,
        cfg.factory,
        'getPool',
        [
            tokenA,
            tokenB,
            fee
        ]
    );

    return getSingleResult(result);
};


const getEdgeKey = (tokenA, tokenB) => {
    const tokens = [
        normalizeAddress(tokenA),
        normalizeAddress(tokenB)
    ].sort();

    return tokens.join(':');
};


const getAvailableEdgePools = async ({
    rpcUrl,
    cfg,
    tokenA,
    tokenB,
    cache
}) => {
    const cacheKey = getEdgeKey(tokenA, tokenB);

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const available = [];

    for (const fee of cfg.feeTiers) {
        try {
            const pool = await getPancakeV3Pool({
                rpcUrl,
                cfg,
                tokenA,
                tokenB,
                fee
            });

            if (!isZeroAddress(pool)) {
                available.push({
                    fee,
                    pool
                });
            }
        } catch (error) {
            if (
                error?.message?.includes('Too Many Requests') ||
                error?.message?.includes('-32005')
            ) {
                await new Promise(resolve =>
                    setTimeout(resolve, 1000)
                );

                continue;
            }
        }

        await new Promise(resolve =>
            setTimeout(resolve, 100)
        );
    }

    cache.set(cacheKey, available);

    return available;
};


const createTokenRoutes = ({
    cfg,
    tokenIn,
    tokenOut
}) => {
    const input = normalizeAddress(tokenIn);
    const output = normalizeAddress(tokenOut);

    const result = [
        [tokenIn, tokenOut]
    ];

    const intermediateTokens = [
        cfg.wrappedNative,
        ...(cfg.intermediateTokens || [])
    ];

    for (const intermediate of intermediateTokens) {
        const middle = normalizeAddress(intermediate);

        if (middle === input || middle === output) {
            continue;
        }

        result.push([
            tokenIn,
            intermediate,
            tokenOut
        ]);
    }

    const unique = [];
    const used = new Set();

    for (const tokens of result) {
        const key = tokens
            .map(normalizeAddress)
            .join('>');

        if (used.has(key)) {
            continue;
        }

        used.add(key);
        unique.push(tokens);
    }

    return unique;
};


const createFeeCombinations = edgePools => {
    const result = [];

    const walk = (
        edgeIndex,
        currentFees,
        currentPools
    ) => {
        if (edgeIndex === edgePools.length) {
            result.push({
                fees: [...currentFees],
                pools: [...currentPools]
            });

            return;
        }

        for (const poolData of edgePools[edgeIndex]) {
            currentFees.push(poolData.fee);
            currentPools.push(poolData.pool);

            walk(
                edgeIndex + 1,
                currentFees,
                currentPools
            );

            currentFees.pop();
            currentPools.pop();
        }
    };

    walk(0, [], []);

    return result;
};


export const quotePancakeV3Path = async ({
    rpcUrl,
    cfg,
    path,
    amountIn
}) => {
    const result = await getDataCall(
        rpcUrl,
        quoterAbiV2,
        cfg.quoterV2,
        'quoteExactInput',
        [
            path,
            amountIn.toString()
        ]
    );

    const amountOut =
        result.amountOut ??
        result[0];

    const gasEstimate =
        result.gasEstimate ??
        result[3];

    const initializedTicksCrossed =
        result.initializedTicksCrossedList ??
        result[2];

    return {
        amountOut: amountOut.toString(),
        gasEstimate: gasEstimate?.toString(),
        initializedTicksCrossed
    };
};


export const discoverPancakeV3Routes = async ({
    rpcUrl,
    cfg,
    tokenIn,
    tokenOut
}) => {
    const poolCache = new Map();

    const tokenRoutes = createTokenRoutes({
        cfg,
        tokenIn,
        tokenOut
    });

    const routeVariants = [];

    for (const tokens of tokenRoutes) {
        const edgePools = [];
        let routeExists = true;

        for (
            let i = 0;
            i < tokens.length - 1;
            i++
        ) {
            const pools =
                await getAvailableEdgePools({
                    rpcUrl,
                    cfg,
                    tokenA: tokens[i],
                    tokenB: tokens[i + 1],
                    cache: poolCache
                });

            if (pools.length === 0) {
                routeExists = false;
                break;
            }

            edgePools.push(pools);
        }

        if (!routeExists) {
            continue;
        }

        const feeCombinations =
            createFeeCombinations(edgePools);

        for (const combination of feeCombinations) {
            routeVariants.push({
                tokens: [...tokens],
                fees: [...combination.fees],
                pools: [...combination.pools],

                path: encodePancakeV3Path(
                    tokens,
                    combination.fees
                )
            });
        }
    }

    if (routeVariants.length === 0) {
        throw new Error(
            'Pancake V3 pools were not found for this pair'
        );
    }

    const key = getPancakeV3RouteCacheKey({
        cfg,
        tokenIn,
        tokenOut
    });

    /*
     * Хороший старый кэш заменяем только после
     * полностью успешного обнаружения маршрутов.
     */
    pancakeV3RouteCache.set(key, {
        protocol: 'PANCAKE_V3',
        chainName: cfg.name,
        tokenIn,
        tokenOut,
        updatedAt: Date.now(),
        routes: routeVariants.map(cloneRoute)
    });

    return routeVariants.map(cloneRoute);
};


export const quotePancakeV3Routes = async ({
    rpcUrl,
    cfg,
    routes,
    amountIn
}) => {
    if (
        !Array.isArray(routes) ||
        routes.length === 0
    ) {
        throw new Error(
            'Pancake V3 route list is empty'
        );
    }

    const quotedRoutes = await Promise.all(
        routes.map(async route => {
            try {
                const quote =
                    await quotePancakeV3Path({
                        rpcUrl,
                        cfg,
                        path: route.path,
                        amountIn
                    });

                if (
                    !quote.amountOut ||
                    Number(quote.amountOut) <= 0
                ) {
                    return null;
                }

                return {
                    protocol: 'PANCAKE_V3',
                    ...cloneRoute(route),
                    ...quote
                };
            } catch {
                /*
                 * Один нерабочий путь не должен
                 * отменять котировки остальных.
                 */
                return null;
            }
        })
    );

    const viableRoutes =
        quotedRoutes.filter(Boolean);

    if (viableRoutes.length === 0) {
        throw new Error(
            'Pancake V3 has no executable route or active liquidity'
        );
    }

    let best = viableRoutes[0];

    for (
        let i = 1;
        i < viableRoutes.length;
        i++
    ) {
        if (
            Number(viableRoutes[i].amountOut) >
            Number(best.amountOut)
        ) {
            best = viableRoutes[i];
        }
    }

    return best;
};


export const quoteCachedPancakeV3Routes = async ({
    rpcUrl,
    cfg,
    tokenIn,
    tokenOut,
    amountIn,
    maxAgeMs = null
}) => {
    const cached = getCachedPancakeV3Routes({
        cfg,
        tokenIn,
        tokenOut
    });

    if (!cached || cached.routes.length === 0) {
        throw new Error(
            'Pancake V3 prepared routes are not available'
        );
    }

    if (
        maxAgeMs !== null &&
        Date.now() - cached.updatedAt >
            Number(maxAgeMs)
    ) {
        throw new Error(
            'Pancake V3 prepared routes are stale'
        );
    }

    return await quotePancakeV3Routes({
        rpcUrl,
        cfg,
        routes: cached.routes,
        amountIn
    });
};


/*
 * Обычный режим сохраняет прежнее поведение:
 * Factory discovery -> quotes -> best route.
 */
export const findBestPancakeV3Route = async ({
    rpcUrl,
    cfg,
    tokenIn,
    tokenOut,
    amountIn
}) => {
    const routes = await discoverPancakeV3Routes({
        rpcUrl,
        cfg,
        tokenIn,
        tokenOut
    });

    return await quotePancakeV3Routes({
        rpcUrl,
        cfg,
        routes,
        amountIn
    });
};


export const dataSwapPancakeV3 = async ({
    rpcUrl,
    cfg,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    recipient,
    inNative,
    outNative,
    preparedRoute = null,
    absoluteAmountOutMin = null 
}) => {
    if (
        !Number.isFinite(Number(slippage)) ||
        Number(slippage) <= 0 ||
        Number(slippage) > 1
    ) {
        throw new Error(
            `Invalid slippage multiplier: ${slippage}`
        );
    }

    const best = preparedRoute || (
        await findBestPancakeV3Route({
            rpcUrl,
            cfg,
            tokenIn,
            tokenOut,
            amountIn
        })
    );

    const slippageAmountOutMin =
    parseInt(
        multiply(
            best.amountOut,
            slippage
        )
    ).toString();


let amountOutMin =
    slippageAmountOutMin;


if (
    absoluteAmountOutMin !== null &&
    absoluteAmountOutMin !== undefined
    ) {
        const absoluteMinimum =
            Number(
                absoluteAmountOutMin
            );

        const quotedOutput =
            Number(
                best.amountOut
            );

        if (
            !Number.isFinite(
                absoluteMinimum
            ) ||
            absoluteMinimum <= 0
        ) {
            throw new Error(
                'Invalid absolute amountOutMinimum'
            );
        }

        if (
            quotedOutput <
            absoluteMinimum
        ) {
            throw new Error(
                'Quote is below absolute amountOutMinimum'
            );
        }

        /*
        * Используем более строгую защиту:
        *
        * 1. минимум по slippage;
        * 2. абсолютные 7000 USDC.
        */
        amountOutMin =
            Math.max(
                Number(
                    slippageAmountOutMin
                ),
                absoluteMinimum
            ).toFixed(0);
    }

    if (
        !amountOutMin ||
        Number(amountOutMin) <= 0
    ) {
        throw new Error(
            'Calculated amountOutMinimum is zero'
        );
    }

    const deadline =
        Math.floor(Date.now() / 1000) +
        Number(cfg.deadlineSeconds);

    const web3 = getProvider(rpcUrl);

    const router = new web3.eth.Contract(
        pancakeV3RouterAbi,
        cfg.swapRouter
    );

    const swapRecipient = outNative
        ? cfg.swapRouter
        : recipient;

    const exactInputParams = [
        best.path,
        swapRecipient,
        deadline,
        amountIn.toString(),
        amountOutMin
    ];

    const amountTx = inNative
        ? amountIn.toString()
        : null;

    let transaction;

    if (outNative) {
        const swapData = router.methods
            .exactInput(exactInputParams)
            .encodeABI();

        const unwrapData = router.methods
            .unwrapWETH9(
                amountOutMin,
                recipient
            )
            .encodeABI();

        transaction = await getDataTx(
            rpcUrl,
            pancakeV3RouterAbi,
            cfg.swapRouter,
            'multicall',
            [
                [
                    swapData,
                    unwrapData
                ]
            ],
            amountTx,
            recipient
        );
    } else {
        transaction = await getDataTx(
            rpcUrl,
            pancakeV3RouterAbi,
            cfg.swapRouter,
            'exactInput',
            [
                exactInputParams
            ],
            amountTx,
            recipient
        );
    }

    return {
        ...transaction,

        route: best,
        amountIn: amountIn.toString(),
        quotedAmountOut: best.amountOut,
        amountOutMin
    };
};