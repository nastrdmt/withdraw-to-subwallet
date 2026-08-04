// function/pancake.js

import {
    checkAllowance,
    dataApprove,
    getAmountToken,
    getDecimal,
    getProvider,
    getGasPrice
} from '../src/web3.js';

import {
    getMaxPriorGasPrice,
    getNameKey,
    getTrueAmount,
    getTrueGasPrice,
    getTrueTokenAmount,
    getTokenSymbol,
    waitForTokenBalance,
    info,
    log,
    privateToAddress,
    timeout
} from '../src/other.js';

import {
    dataSwapPancakeV3,
    findBestPancakeV3Route,
    quoteCachedPancakeV3Routes
} from '../src/pancakeV3.js';

import {
    createRpcPool,
    sendEVMTXWithFallback,
    uniqueRpcUrls
} from '../src/rpcPool.js';

import {
    startPancakeV3RouteWatcher
} from './pancakeWatcher.js';


const checkedChains = new Set();

const MAX_UINT256 =
    '115792089237316195423570985008687907853269984665640564039457584007913129639935';


const isEnvEnabled = name => {
    return [
        'yes',
        'true',
        '1'
    ].includes(
        String(
            process.env[name] || 'no'
        )
            .replace(/['"]/g, '')
            .toLowerCase()
    );
};

const isNative = token => {
    if (typeof token !== 'string') {
        return false;
    }

    const value = token.toUpperCase();

    return (
        value === 'ETH' ||
        value === 'BNB' ||
        value === 'MON' ||
        value === 'NATIVE'
    );
};


const getTokenName = token => {
    return (
        getNameKey(info, token) ||
        token
    );
};


const formatTokenAmount = (
    rawAmount,
    decimals,
    fixed = 6
) => {
    return (
        Number(rawAmount) /
        10 ** Number(decimals)
    ).toFixed(fixed);
};

const humanAmountToRaw = (
    amount,
    decimals
) => {
    const normalized =
        Number(
            String(amount)
                .replace(/['"]/g, '')
        );

    const rawAmount =
        normalized *
        10 ** Number(decimals);

    if (
        !Number.isFinite(rawAmount) ||
        rawAmount <= 0
    ) {
        throw new Error(
            `Invalid minimum output amount: ${amount}`
        );
    }

    /*
     * Для минимального результата округляем вверх.
     */
    return Math.ceil(
        rawAmount
    ).toFixed(0);
};

const getExplorerByRpc = rpcUrl => {
    const rpcKey = Object
        .keys(info)
        .find(key => {
            return (
                key.startsWith('rpc') &&
                info[key] === rpcUrl
            );
        });

    if (!rpcKey) {
        return '';
    }

    const chainName = rpcKey.slice(3);

    return (
        info['explorer' + chainName] ||
        ''
    );
};


const checkPancakeContracts = async ({
    rpcUrl,
    chainId,
    cfg
}) => {
    if (checkedChains.has(Number(chainId))) {
        return;
    }

    const web3 = getProvider(rpcUrl);

    const contracts = [
        {
            name: 'Pancake V3 Factory',
            address: cfg.factory
        },
        {
            name: 'Pancake V3 QuoterV2',
            address: cfg.quoterV2
        },
        {
            name: 'Pancake V3 SwapRouter',
            address: cfg.swapRouter
        }
    ];

    for (const contract of contracts) {
        if (
            !web3.utils.isAddress(
                contract.address
            )
        ) {
            throw new Error(
                `Invalid ${contract.name} address: ` +
                contract.address
            );
        }

        const code = await web3.eth.getCode(
            contract.address
        );

        if (!code || code === '0x') {
            throw new Error(
                `${contract.name} is not deployed ` +
                `on chainId ${chainId}`
            );
        }
    }

    checkedChains.add(Number(chainId));
};


const approvePancakeV3IfNeeded = async ({
    readRpcPool,
    transactionRpcUrls,
    explorer,
    cfg,
    token,
    owner,
    amount,
    privateKey,
    gasPrice,
    maxPriorityFeePerGas
}) => {
    let allowance = await readRpcPool.run(
        currentRpc =>
            checkAllowance(
                currentRpc,
                token,
                owner,
                cfg.swapRouter
            ),
        {
            label: 'Pancake allowance'
        }
    );

    allowance = Number(allowance);

    if (allowance >= Number(amount)) {
        log(
            'info',
            'Find Approve [Pancake V3]',
            'green'
        );

        return false;
    }

    const approveData = await readRpcPool.run(
        currentRpc =>
            dataApprove(
                currentRpc,
                token,
                cfg.swapRouter,
                amount,
                owner
            ),
        {
            label: 'Pancake approve estimate',
            timeoutMs: 20000
        }
    );

    const approveGasLimit = Math.ceil(
        Number(approveData.estimateGas) *
        Number(
            info.pancakeV3.gasLimitMultiplier
        )
    );

    await sendEVMTXWithFallback({
        rpcUrls: transactionRpcUrls,
        typeTx: cfg.txType,
        gasLimit: approveGasLimit,
        toAddress: token,
        value: null,
        data: approveData.encodeABI,
        privateKey,
        maxFeeOrGasPrice: gasPrice,
        maxPriorityFee:
            maxPriorityFeePerGas,
        explorer
    });

    log(
        'log',
        'Successful Approve [Pancake V3]',
        'green'
    );

    return true;
};

const preApprovePancakeV3Unlimited = async ({
    readRpcPool,
    transactionRpcUrls,
    explorer,
    cfg,
    token,
    owner,
    privateKey
}) => {
    const getAllowance = () => {
        return readRpcPool.run(
            currentRpc =>
                checkAllowance(
                    currentRpc,
                    token,
                    owner,
                    cfg.swapRouter
                ),
            {
                label:
                    'Pancake preliminary allowance'
            }
        );
    };

    const allowance =
        String(await getAllowance());

    if (allowance === MAX_UINT256) {
        log(
            'info',
            '[Pancake V3 HOT] Unlimited approve already exists',
            'green'
        );

        return false;
    }

    log(
        'info',
        '[Pancake V3 HOT] Sending preliminary unlimited approve...',
        'yellow'
    );

    const gasPrice = String(
        await readRpcPool.run(
            currentRpc =>
                getTrueGasPrice(currentRpc),
            {
                label:
                    'Pancake approve gas price'
            }
        )
    );

    let maxPriorityFeePerGas =
        gasPrice;

    if (cfg.txType === 2) {
        maxPriorityFeePerGas = String(
            await readRpcPool.run(
                currentRpc =>
                    getMaxPriorGasPrice(
                        currentRpc
                    ),
                {
                    label:
                        'Pancake approve priority gas'
                }
            )
        );
    }

    const approveData =
        await readRpcPool.run(
            currentRpc =>
                dataApprove(
                    currentRpc,
                    token,
                    cfg.swapRouter,
                    MAX_UINT256,
                    owner
                ),
            {
                label:
                    'Pancake unlimited approve estimate',

                timeoutMs: 20000
            }
        );

    const approveGasLimit = Math.ceil(
        Number(approveData.estimateGas) *
        Number(
            info.pancakeV3
                .gasLimitMultiplier
        )
    );

    await sendEVMTXWithFallback({
        rpcUrls:
            transactionRpcUrls,

        typeTx:
            cfg.txType,

        gasLimit:
            approveGasLimit,

        toAddress:
            token,

        value:
            null,

        data:
            approveData.encodeABI,

        privateKey,

        maxFeeOrGasPrice:
            gasPrice,

        maxPriorityFee:
            maxPriorityFeePerGas,

        explorer
    });

    /*
     * Ждём, пока approve появится в состоянии сети.
     * Иначе при уже имеющемся балансе swap может проверить
     * allowance раньше включения approve в блок.
     */
    for (
        let attempt = 1;
        attempt <= 30;
        attempt++
    ) {
        await timeout(500);

        const updatedAllowance =
            String(await getAllowance());

        if (
            updatedAllowance ===
            MAX_UINT256
        ) {
            log(
                'log',
                '[Pancake V3 HOT] Preliminary unlimited approve confirmed',
                'green'
            );

            return true;
        }
    }

    throw new Error(
        'Preliminary approve was sent but was not confirmed'
    );
};

export const SwapPancake = async ({
    rpcUrl,
    tokenIn,
    tokenOut,
    privateKey,

    hotMode = [
        'yes',
        'true',
        '1'
    ].includes(
        String(
            process.env.PANCAKE_HOT_MODE ||
            'no'
        ).toLowerCase()
    )
}) => {
    const address =
        privateToAddress(privateKey);

    /*
     * Для Base используем три RPC.
     * Для остальных сетей пока используется
     * переданный rpcUrl.
     */
    const isBaseRpc = [
        info.rpcBase,
        info.rpcBaseCDP,
        info.rpcBaseAlchemy
    ].includes(rpcUrl);


    const baseRpcUrls = uniqueRpcUrls([
        info.rpcBaseCDP,
        info.rpcBaseAlchemy
    ]);


    const readRpcPool = createRpcPool(
        isBaseRpc
            ? baseRpcUrls
            : [rpcUrl]
    );


    const transactionRpcUrls =
        isBaseRpc
            ? uniqueRpcUrls([
                info.rpcBaseCDP,
                info.rpcBaseAlchemy
            ])
            : [rpcUrl];

    const explorer =
        getExplorerByRpc(rpcUrl);

    const chainId = await readRpcPool.run(
        async currentRpc => {
            const provider =
                getProvider(currentRpc);

            return await provider.eth
                .getChainId();
        },
        {
            label: 'chainId',
            rotate: false
        }
    );

    const cfg =
        info.pancakeV3.chains[
            Number(chainId)
        ];

    if (!cfg) {
        throw new Error(
            `Pancake V3 is not configured ` +
            `for chainId ${chainId}`
        );
    }

    const web3 = getProvider(
        readRpcPool.urls[0]
    );

    await readRpcPool.run(
        currentRpc =>
            checkPancakeContracts({
                rpcUrl: currentRpc,
                chainId,
                cfg
            }),
        {
            label:
                'Pancake contract checks'
        }
    );

    const inNative = isNative(tokenIn);
    const outNative = isNative(tokenOut);

    if (inNative && outNative) {
        throw new Error(
            'Native -> native swap is not supported'
        );
    }

    const tokenInAddress = inNative
        ? cfg.wrappedNative
        : tokenIn;

    const tokenOutAddress = outNative
        ? cfg.wrappedNative
        : tokenOut;

    if (
        !web3.utils.isAddress(
            tokenInAddress
        ) ||
        !web3.utils.isAddress(
            tokenOutAddress
        )
    ) {
        throw new Error(
            'Invalid tokenIn or tokenOut address'
        );
    }

    if (
        tokenInAddress.toLowerCase() ===
        tokenOutAddress.toLowerCase()
    ) {
        throw new Error(
            'tokenIn and tokenOut are the same'
        );
    }

    const isProtectedQuidSale =
    Number(chainId) === 8453 &&

    tokenInAddress.toLowerCase() ===
        info.QUID.toLowerCase() &&

    tokenOutAddress.toLowerCase() ===
        info.BaseUSDC.toLowerCase();


let minimumQuidOutputRaw = null;
let protectedUsdcDecimals = null;


if (isProtectedQuidSale) {
    const configuredMinimum =
        String(
            process.env
                .PANCAKE_MIN_QUID_OUTPUT_USDC ||
            ''
        )
            .replace(/['"]/g, '')
            .trim();

    const minimumOutput =
        Number(configuredMinimum);

    if (
        !Number.isFinite(
            minimumOutput
        ) ||
        minimumOutput <= 0
    ) {
        throw new Error(
            'PANCAKE_MIN_QUID_OUTPUT_USDC must be greater than zero'
        );
    }

    protectedUsdcDecimals =
        Number(
            await readRpcPool.run(
                currentRpc =>
                    getDecimal(
                        currentRpc,
                        tokenOutAddress
                    ),
                {
                    label:
                        'QUID output USDC decimals'
                }
            )
        );

    if (
        !Number.isFinite(
            protectedUsdcDecimals
        ) ||
        protectedUsdcDecimals !== 6
    ) {
        throw new Error(
            `Unexpected Base USDC decimals: ${protectedUsdcDecimals}`
        );
    }

    minimumQuidOutputRaw =
        humanAmountToRaw(
            minimumOutput,
            protectedUsdcDecimals
        );

    log(
        'info',
        `[Pancake V3] QUID protection enabled: minimum ${minimumOutput} USDC`,
        'yellow'
    );
}


const checkProtectedQuidQuote =
    route => {
        if (!isProtectedQuidSale) {
            return true;
        }

        const quotedRaw =
            Number(
                route?.amountOut
            );

        const minimumRaw =
            Number(
                minimumQuidOutputRaw
            );

        if (
            !Number.isFinite(
                quotedRaw
            ) ||
            quotedRaw <= 0
        ) {
            log(
                'info',
                '[Pancake V3] Invalid protected QUID quote',
                'red'
            );

            return false;
        }

        const quotedUsdc =
            quotedRaw /
            10 ** protectedUsdcDecimals;

        const minimumUsdc =
            minimumRaw /
            10 ** protectedUsdcDecimals;

        log(
            'info',
            `[Pancake V3] QUID quote: ${quotedUsdc.toFixed(6)} USDC | ` +
            `required minimum: ${minimumUsdc.toFixed(6)} USDC`,
            quotedRaw >= minimumRaw
                ? 'green'
                : 'red'
        );

        if (
            quotedRaw <
            minimumRaw
        ) {
            log(
                'info',
                '[Pancake V3] Sale blocked: quote is below minimum output',
                'red'
            );

            return false;
        }

        return true;
    };

   let routeWatcher = null;

    let hotPreapprovePromise =
        Promise.resolve({
            ok: true,
            sent: false
        });

    let hotPreapproveConfirmed = false;

    const hotPreapproveEnabled =
        isEnvEnabled(
            'PANCAKE_HOT_PREAPPROVE'
        );

        let cachedGasData = null;
let gasRefreshTimer = null;
let gasRefreshRunning = false;


const refreshGasCache = async () => {
    if (gasRefreshRunning) {
        return cachedGasData;
    }

    gasRefreshRunning = true;

    try {
        const gasPricePromise =
            readRpcPool.run(
                currentRpc =>
                    getGasPrice(currentRpc),
                {
                    label:
                        'Pancake gas cache'
                }
            );

        const priorityPromise =
            cfg.txType === 2
                ? readRpcPool.run(
                    currentRpc =>
                        getMaxPriorGasPrice(
                            currentRpc
                        ),
                    {
                        label:
                            'Pancake priority gas cache'
                    }
                )
                : Promise.resolve(null);

        const [
            rawGasPrice,
            rawPriorityFee
        ] = await Promise.all([
            gasPricePromise,
            priorityPromise
        ]);

        const currentPriorityFee =
        cfg.txType === 2
            ? Number(rawPriorityFee)
            : currentGasPrice;

        if (
            !Number.isFinite(
                currentPriorityFee
            ) ||
            currentPriorityFee < 0
        ) {
            throw new Error(
                'Invalid cached priority fee'
            );
        }

        /*
         * Сохраняем ту же проверку максимального gas,
         * которая используется в getTrueGasPrice.
         */
        if (
            Number.isFinite(
                Number(info.needGasPrice)
            ) &&
            currentGasPrice >
                Number(info.needGasPrice)
        ) {
            return cachedGasData;
        }

        const increasedGasPrice = (
            currentGasPrice *
            Number(info.increaseGasPrice)
        ).toFixed(9);

        cachedGasData = {
            gasPrice:
                increasedGasPrice,

            maxPriorityFeePerGas:
                currentPriorityFee.toFixed(9),  

            updatedAt:
                Date.now()
        };

        return cachedGasData;
    } catch {
        /*
         * Ошибка фонового обновления не должна
         * останавливать ожидание токена.
         */
        return cachedGasData;
    } finally {
        gasRefreshRunning = false;
    }
};


const stopGasRefresh = () => {
    if (gasRefreshTimer) {
        clearInterval(
            gasRefreshTimer
        );

        gasRefreshTimer = null;
    }
};

const stopHotPreparation = () => {
    stopGasRefresh();

    if (routeWatcher) {
        routeWatcher.stop();
        routeWatcher = null;
    }
};

    if (hotMode) {
        void refreshGasCache();

gasRefreshTimer = setInterval(
    () => {
        void refreshGasCache();
    },
    Math.max(
        500,
        Number(
            process.env
                .PANCAKE_GAS_REFRESH_MS ||
            2000
        )
    )
);

/*
 * Таймер не должен самостоятельно удерживать
 * процесс Node.js после завершения функции.
 */
gasRefreshTimer.unref?.();
        routeWatcher =
            startPancakeV3RouteWatcher({
                rpcUrls:
                    readRpcPool.urls,

                cfg: {
                    ...cfg,

                    feeTiers:
                        info.pancakeV3
                            .feeTiers
                },

                tokenIn:
                    tokenInAddress,

                tokenOut:
                    tokenOutAddress,

                intervalMs:
                    Number(
                        process.env
                            .PANCAKE_ROUTE_SCAN_MS ||
                        1000
                    )
            });

        log(
            'info',
            `[Pancake V3 HOT] Watcher started for ` +
            `${getTokenName(tokenInAddress)} -> ` +
            `${getTokenName(tokenOutAddress)}`,
            'yellow'
        );

        /*
        * Approve запускается автоматически после обнаружения
        * настоящего V3-маршрута. Пока кошелёк ждёт токены,
        * watcher и approve работают заранее.
        */
        if (
            !inNative &&
            hotPreapproveEnabled
        ) {
            hotPreapprovePromise =
                routeWatcher.ready.then(
                    async prepared => {
                        if (
                            !prepared?.routes ||
                            prepared.routes.length === 0
                        ) {
                            return {
                                ok: false,

                                error:
                                    new Error(
                                        'V3 routes were not found'
                                    )
                            };
                        }

                        try {
                            const sent =
                                await preApprovePancakeV3Unlimited({
                                    readRpcPool,
                                    transactionRpcUrls,
                                    explorer,
                                    cfg,

                                    token:
                                        tokenInAddress,

                                    owner:
                                        address,

                                    privateKey
                                });

                            return {
                                ok: true,
                                sent
                            };
                        } catch (error) {
                            return {
                                ok: false,
                                error
                            };
                        }
                    }
                );

            log(
                'info',
                '[Pancake V3 HOT] Preliminary approve is enabled',
                'yellow'
            );
        }
    }



    let amountIn;

    if (inNative) {
        amountIn = await readRpcPool.run(
            currentRpc =>
                getTrueAmount(
                    currentRpc,
                    address,
                    'Swap'
                ),
            {
                label:
                    'Pancake native amount'
            }
        );
    } else {
        const symbol =
            await readRpcPool.run(
                currentRpc =>
                    getTokenSymbol(
                        currentRpc,
                        tokenInAddress
                    ),
                {
                    label:
                        'Pancake token symbol'
                }
            );

        const balance =
            await waitForTokenBalance(
                () =>
                    readRpcPool.run(
                        currentRpc =>
                            getAmountToken(
                                currentRpc,
                                tokenInAddress,
                                address
                            ),
                        {
                            label:
                                'Pancake token balance'
                        }
                    ),
                symbol,
                700,
                log
            );

        if (balance === null) {
            stopHotPreparation();
            return {
                status: 'SKIPPED',
                reason: 'ZERO_BALANCE'
            };
        }

        const tokenAmountType =
            String(
                process.env.amount_token_type ||
                'amount'
            )
                .replace(/['"]/g, '')
                .toLowerCase();

        if (tokenAmountType === 'max') {
            /*
            * waitForTokenBalance уже вернул актуальный
            * raw-баланс. Второй запрос не требуется.
            */
            amountIn = String(balance);

            log(
                'info',
                '[Pancake V3 HOT] Using detected token balance without repeated request',
                'green'
            );
        } else {
            amountIn =
                await readRpcPool.run(
                    currentRpc =>
                        getTrueTokenAmount(
                            currentRpc,
                            tokenInAddress,
                            address
                        ),
                    {
                        label:
                            'Pancake token amount'
                    }
                );
        }

        if (
            Number(amountIn) >
            Number(balance)
        ) {
            log(
                'info',
                `[Pancake V3] Not enough ${symbol}. ` +
                `Required: ${amountIn}, ` +
                `balance: ${balance}`,
                'red'
            );

            stopHotPreparation();
            return {
                status: 'SKIPPED',
                reason:
                    'INSUFFICIENT_TOKEN_BALANCE'
            };
        }
    }

    if (
        !amountIn ||
        Number(amountIn) === 0
    ) {
        log(
            'info',
            `Balance ${
                getTokenName(tokenInAddress)
            } = 0. Skip this wallet`,
            'red'
        );

        stopHotPreparation();

        return {
            status: 'SKIPPED',
            reason: 'ZERO_BALANCE'
        };
    }

    if (hotMode) {
        log(
            'info',
            '[Pancake V3 HOT] Token amount is ready. Checking prepared routes...',
            'yellow'
        );

        const [
            prepared,
            preapproveResult
        ] = await Promise.all([
            routeWatcher.ready,
            hotPreapprovePromise
        ]);

        if (
            !prepared?.routes ||
            prepared.routes.length === 0
        ) {
            stopHotPreparation();

            return {
                status: 'SKIPPED',
                reason:
                    'HOT_ROUTES_NOT_READY'
            };
        }

        if (!preapproveResult.ok) {
            stopHotPreparation();

            log(
                'info',
                `[Pancake V3 HOT] Preliminary approve failed: ${
                    preapproveResult.error
                        ?.message ||
                    preapproveResult.error
                }`,
                'red'
            );

            return {
                status: 'SKIPPED',
                reason:
                    'PREAPPROVE_FAILED'
            };
        }
        
        hotPreapproveConfirmed =
        hotPreapproveEnabled &&
        preapproveResult.ok;

        log(
            'info',
            `[Pancake V3 HOT] Using ${
                prepared.routes.length
            } prepared routes`,
            'green'
        );

        stopHotPreparation();
    }

    let preparedRoute;
    let gasPrice;
    let maxPriorityFeePerGas;
    let preparedTransactionData = null;

    try {
        /*
         * В hotMode берём только готовые
         * маршруты из памяти.
         *
         * В normal mode выполняется полный
         * Factory discovery.
         */
        const routePromise =
            readRpcPool.run(
                currentRpc => {
                    if (hotMode) {
                        return (
                            quoteCachedPancakeV3Routes({
                                rpcUrl:
                                    currentRpc,

                                cfg: {
                                    ...cfg,

                                    feeTiers:
                                        info
                                            .pancakeV3
                                            .feeTiers
                                },

                                tokenIn:
                                    tokenInAddress,

                                tokenOut:
                                    tokenOutAddress,

                                amountIn
                            })
                        );
                    }

                    return (
                        findBestPancakeV3Route({
                            rpcUrl:
                                currentRpc,

                            cfg: {
                                ...cfg,

                                feeTiers:
                                    info
                                        .pancakeV3
                                        .feeTiers
                            },

                            tokenIn:
                                tokenInAddress,

                            tokenOut:
                                tokenOutAddress,

                            amountIn
                        })
                    );
                },
                {
                    label: hotMode
                        ? 'Pancake cached quotes'
                        : 'Pancake route search',

                    timeoutMs: 30000
                }
            );

        /*
         * Газ запрашивается параллельно
         * с маршрутом/котировкой.
         */
        const gasPromise = (async () => {
    if (hotMode) {
        const maxAgeMs =
            Number(
                process.env
                    .PANCAKE_GAS_MAX_AGE_MS ||
                5000
            );

        let snapshot =
            cachedGasData;

        if (
            !snapshot ||
            Date.now() -
                snapshot.updatedAt >
                maxAgeMs
        ) {
            await refreshGasCache();

            snapshot =
                cachedGasData;
        }

        if (
            snapshot &&
            Date.now() -
                snapshot.updatedAt <=
                maxAgeMs
        ) {
            log(
                'info',
                `[Pancake V3 HOT] Using cached gas, age=${
                    Date.now() -
                    snapshot.updatedAt
                }ms`,
                'green'
            );

            return snapshot;
        }
    }

    /*
     * Fallback, если gas cache ещё не готов
     * или оказался устаревшим.
     */
    const currentGasPrice = String(
        await readRpcPool.run(
            currentRpc =>
                getTrueGasPrice(
                    currentRpc
                ),
            {
                label:
                    'gas price'
            }
        )
    );

    let currentPriorityFee =
        currentGasPrice;

    if (cfg.txType === 2) {
        currentPriorityFee = String(
            await readRpcPool.run(
                currentRpc =>
                    getMaxPriorGasPrice(
                        currentRpc
                    ),
                {
                    label:
                        'priority gas price'
                }
            )
        );
    }

    return {
        gasPrice:
            currentGasPrice,

        maxPriorityFeePerGas:
            currentPriorityFee,

        updatedAt:
            Date.now()
    };
})();

const transactionDataPromise =
    hotMode
        ? readRpcPool.run(
            async currentRpc => {
                const provider =
                    getProvider(
                        currentRpc
                    );

                const nonce =
                    await provider.eth
                        .getTransactionCount(
                            address,
                            'pending'
                        );

                return {
                    chainId:
                        Number(chainId),

                    nonce,

                    fromAddress:
                        address
                };
            },
            {
                label:
                    'Pancake pending nonce'
            }
        )
        : Promise.resolve(null);


        const [
    routeResult,
    gasResult,
    transactionDataResult
] = await Promise.all([
    routePromise,
    gasPromise,
    transactionDataPromise
]);

        preparedRoute = routeResult;

        gasPrice =
            gasResult.gasPrice;

        maxPriorityFeePerGas =
            gasResult.maxPriorityFeePerGas;
            preparedTransactionData =
    transactionDataResult;
    } catch (error) {
        log(
            'info',
            `[Pancake V3] Preparation failed: ${
                error?.message || error
            }`,
            'red'
        );

        return {
            status: 'SKIPPED',

            reason: hotMode
                ? 'HOT_ROUTES_NOT_READY'
                : 'NO_EXECUTABLE_ROUTE'
        };
    }

    log(
        'info',
        `[Pancake V3] Mode: ${
            hotMode
                ? 'HOT'
                : 'NORMAL'
        }`,
        'green'
    );

    log(
        'info',
        `[Pancake V3] Route: ${
            preparedRoute.tokens.join(
                ' -> '
            )
        } | fees: ${
            preparedRoute.fees.join(
                ' -> '
            )
        }`,
        'green'
    );

    log(
        'info',
        `[Pancake V3] Quoted amountOut: ${
            preparedRoute.amountOut
        }`,
        'green'
    );

    if (
    !checkProtectedQuidQuote(
        preparedRoute
    )
    ) {
        return {
            status: 'SKIPPED',
            reason:
                'QUID_MINIMUM_OUTPUT_NOT_REACHED'
        };
    }

    let approvedNow = false;

    if (!inNative) {
       if (hotMode) {
            if (hotPreapproveConfirmed) {
                /*
                * Unlimited allowance уже проверен после
                * подтверждения предварительного approve.
                */
                log(
                    'info',
                    '[Pancake V3 HOT] Preliminary unlimited approve is confirmed',
                    'green'
                );
            } else {
                /*
                * Оставляем проверку для HOT-режима,
                * если автоматический preapprove отключён.
                */
                const allowance =
                    await readRpcPool.run(
                        currentRpc =>
                            checkAllowance(
                                currentRpc,
                                tokenInAddress,
                                address,
                                cfg.swapRouter
                            ),
                        {
                            label:
                                'Pancake hot allowance'
                        }
                    );

                if (
                    Number(allowance) <
                    Number(amountIn)
                ) {
                    log(
                        'info',
                        '[Pancake V3] Hot mode requires preliminary approve',
                        'red'
                    );

                    return {
                        status: 'SKIPPED',
                        reason:
                            'PREAPPROVE_REQUIRED'
                    };
                }

                log(
                    'info',
                    'Find preliminary Approve [Pancake V3]',
                    'green'
                );
            }
        } else {
            approvedNow =
                await approvePancakeV3IfNeeded({
                    readRpcPool,
                    transactionRpcUrls,
                    explorer,
                    cfg,

                    token:
                        tokenInAddress,

                    owner:
                        address,

                    amount:
                        amountIn,

                    privateKey,
                    gasPrice,
                    maxPriorityFeePerGas
                });
        }
    }

    /*
     * NORMAL mode:
     * после approve обновляем только котировку.
     * Factory повторно не вызывается.
     */
    if (approvedNow) {
        await timeout(info.pauseTime);

        try {
            preparedRoute =
                await readRpcPool.run(
                    currentRpc =>
                        quoteCachedPancakeV3Routes({
                            rpcUrl:
                                currentRpc,

                            cfg: {
                                ...cfg,

                                feeTiers:
                                    info
                                        .pancakeV3
                                        .feeTiers
                            },

                            tokenIn:
                                tokenInAddress,

                            tokenOut:
                                tokenOutAddress,

                            amountIn
                        }),
                    {
                        label:
                            'Pancake cached quote after approve',

                        timeoutMs: 20000
                    }
                );

            log(
                'info',
                `[Pancake V3] Updated quote after approve: ${
                    preparedRoute.amountOut
                }`,
                'green'
            );
        } catch (error) {
            log(
                'info',
                `[Pancake V3] Cached quote failed after approve: ${
                    error?.message || error
                }`,
                'red'
            );

            return {
                status: 'SKIPPED',

                reason:
                    'CACHED_QUOTE_AFTER_APPROVE_FAILED'
            };
        }
    }

    if (
        approvedNow &&
        !checkProtectedQuidQuote(
            preparedRoute
        )
    ) {
        return {
            status: 'SKIPPED',
            reason:
                'QUID_MINIMUM_OUTPUT_NOT_REACHED_AFTER_APPROVE'
        };
    }

    let swapData;

    try {
        /*
         * preparedRoute уже передан,
         * поэтому dataSwapPancakeV3
         * не вызывает Factory.
         */
        swapData =
            await readRpcPool.run(
                currentRpc =>
                    dataSwapPancakeV3({
                        rpcUrl:
                            currentRpc,

                        cfg: {
                            ...cfg,

                            feeTiers:
                                info
                                    .pancakeV3
                                    .feeTiers,

                            deadlineSeconds:
                                info
                                    .pancakeV3
                                    .deadlineSeconds
                        },

                        tokenIn:
                            tokenInAddress,

                        tokenOut:
                            tokenOutAddress,

                        amountIn,

                        slippage:
                            info.slippageSwap,

                        recipient:
                            address,

                        inNative,
                        outNative,
                        preparedRoute,

                        absoluteAmountOutMin:
                        isProtectedQuidSale
                            ? minimumQuidOutputRaw
                            : null
                    }),
                {
                    label:
                        'Pancake simulation',

                    timeoutMs: 20000
                }
            );
    } catch (error) {
        log(
            'info',
            `[Pancake V3] Simulation/estimate failed: ${
                error?.message || error
            }`,
            'red'
        );

        return {
            status: 'SKIPPED',
            reason:
                'SIMULATION_FAILED'
        };
    }

    const gasLimit = Math.ceil(
        Number(swapData.estimateGas) *
        Number(
            info.pancakeV3.gasLimitMultiplier
        )
    );

    log(
        'info',
        `[Pancake V3] estimateGas=${
            swapData.estimateGas
        }, gasLimit=${gasLimit}`,
        'yellow'
    );

    const txHash =
        await sendEVMTXWithFallback({
            rpcUrls:
                transactionRpcUrls,

            typeTx:
                cfg.txType,

            gasLimit,

            toAddress:
                swapData.addressContract,

            value:
                swapData.amountTx,

            data:
                swapData.encodeABI,

            privateKey,

            maxFeeOrGasPrice:
                gasPrice,

            maxPriorityFee:
                maxPriorityFeePerGas,

            explorer,
            preparedTransactionData
        });

    const tokenInDecimals = inNative
        ? 18
        : await readRpcPool.run(
            currentRpc =>
                getDecimal(
                    currentRpc,
                    tokenInAddress
                ),
            {
                label:
                    'tokenIn decimals'
            }
        );

    const tokenOutDecimals = outNative
        ? 18
        : await readRpcPool.run(
            currentRpc =>
                getDecimal(
                    currentRpc,
                    tokenOutAddress
                ),
            {
                label:
                    'tokenOut decimals'
            }
        );

    const inputName = inNative
        ? cfg.nativeSymbol
        : getTokenName(tokenInAddress);

    const outputName = outNative
        ? cfg.nativeSymbol
        : getTokenName(tokenOutAddress);

    log(
        'log',
        `Successful Swap ${
            formatTokenAmount(
                amountIn,
                tokenInDecimals
            )
        } ${inputName} -> ${
            formatTokenAmount(
                swapData.quotedAmountOut,
                tokenOutDecimals
            )
        } ${outputName} [Pancake V3]`,
        'green'
    );

    return {
        status: 'SENT',
        protocol: 'PANCAKE_V3',
        chainId: Number(chainId),
        txHash,

        amountIn:
            amountIn.toString(),

        quotedAmountOut:
            swapData.quotedAmountOut,

        amountOutMin:
            swapData.amountOutMin,

        route:
            swapData.route
    };
};