import Web3 from 'web3';
import { info } from './other.js';
import { uniswapAbi, quoterAbiV2, factoryAbi, v3PoolAbiMin } from './abi.js';
import { multiply } from 'mathjs';
import { getDataTx, numberToHex, getDataCall, encodeParams } from './web3.js';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const getMinAmount = async (rpcUrl, cfg, tokenIn, tokenOut, fee, amountIn) => {
    return (await getDataCall(
        rpcUrl,
        quoterAbiV2,
        cfg.QUOTER_V2,
        'quoteExactInputSingle',
        [[tokenIn, tokenOut, numberToHex(amountIn), fee, '0']]
    ))[0];
};

export const getPoolByFee = async (rpcUrl, cfg, tokenA, tokenB, fee) => {
    const res = await getDataCall(
        rpcUrl,
        factoryAbi,
        cfg.V3_FACTORY,
        'getPool',
        [tokenA, tokenB, fee]
    );

    const pool = Array.isArray(res) ? res[0] : res;

    if (pool === 0 || pool === 0n || pool === '0' || pool == null) {
        return ZERO_ADDRESS;
    }

    return pool;
};

export const findBestFeeByQuote = async (rpcUrl, cfg, tokenIn, tokenOut, amountIn) => {
    const FEES = [100, 500, 3000, 10000];
    let best = null;

    for (const fee of FEES) {
        const pool = await getPoolByFee(rpcUrl, cfg, tokenIn, tokenOut, fee);
        if (!pool || pool === ZERO_ADDRESS) continue;

        try {
            const q = await getMinAmount(rpcUrl, cfg, tokenIn, tokenOut, fee, amountIn);
            const out = BigInt(Array.isArray(q) ? q[0] : q);

            if (out === 0n) continue;

            if (!best || out > best.out) {
                best = { fee, pool, out };
            }
        } catch (e) {
            console.log(`[QUOTE] fee ${fee} failed: ${e?.message || e}`);
        }
    }

    if (!best) throw new Error('No viable fee tier');
    return best;
};

export const prepareUniswapV3Fee = async (rpcUrl, cfg, tokenIn, tokenOut, testAmount) => {
    const best = await findBestFeeByQuote(rpcUrl, cfg, tokenIn, tokenOut, testAmount);

    console.log(`[UNI PREPARE] fee=${best.fee} pool=${best.pool}`);

    return {
        fee: best.fee,
        pool: best.pool
    };
};

const MIN_SQRT_RATIO = 4295128739n;
const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export const findV3Pool = async (rpcUrl, cfg, tokenA, tokenB) => {
    const FEES = [100, 500, 3000, 10000];

    for (const fee of FEES) {
        const pool = await getPoolByFee(rpcUrl, cfg, tokenA, tokenB, fee);
        if (!pool || pool === ZERO_ADDRESS) continue;

        const liqRaw = await getDataCall(rpcUrl, v3PoolAbiMin, pool, 'liquidity', []);
        const liq = BigInt(Array.isArray(liqRaw) ? liqRaw[0] : liqRaw);

        if (liq === 0n) continue;

        const slot0 = await getDataCall(rpcUrl, v3PoolAbiMin, pool, 'slot0', []);
        const sqrtP = BigInt(slot0[0]);

        if (sqrtP <= MIN_SQRT_RATIO + 1n || sqrtP >= MAX_SQRT_RATIO - 1n) {
            continue;
        }

        return { fee, pool };
    }

    throw new Error('V3 pool not found');
};

const encodeV3Path = (tokenIn, fee, tokenOut) => {
    const feeHex = fee.toString(16).padStart(6, '0');
    return '0x' + tokenIn.slice(2) + feeHex + tokenOut.slice(2);
};

export const dataSwapUniswap = async(rpcUrl, addressFrom, tokenA, tokenB, amount, slippage, commands, cfg) => {
    const best = await findBestFeeByQuote(rpcUrl, cfg, tokenA, tokenB, amount);
    const fee = best.fee;

    const deadline = parseInt(Date.now() / 1000 + 3 * 60 * 60);

    const minAmount = parseInt(
        multiply(
            (await getMinAmount(rpcUrl, cfg, tokenA, tokenB, fee, amount)).toString(),
            slippage
        )
    );

    const wrapEthInput = encodeParams(
        ['uint256', 'uint256'],
        [2, amount]
    );

    const path = encodeV3Path(tokenA, fee, tokenB);

    const v3SwapInput = encodeParams(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        [addressFrom, amount.toString(), minAmount.toString(), path, false]
    );

    const inputs = [wrapEthInput, v3SwapInput];

    return await getDataTx(
        rpcUrl,
        uniswapAbi,
        cfg.UNIVERSAL_ROUTER,
        'execute',
        [commands, inputs, deadline],
        numberToHex(amount),
        addressFrom
    );
};

export const dataSwapTokenToEthUniswapPrepared = async (
    rpcUrl,
    addressFrom,
    tokenIn,
    amountIn,
    slippage,
    cfg,
    prepared
) => {
    const fee = prepared.fee;

    const quotedWethOut = await getMinAmount(
        rpcUrl,
        cfg,
        tokenIn,
        cfg.WETH9,
        fee,
        amountIn
    );

    const minWethOut = parseInt(
        multiply(quotedWethOut.toString(), slippage)
    ).toString();

    const path = encodeV3Path(tokenIn, fee, cfg.WETH9);

    const RECIPIENT_ROUTER = '0x0000000000000000000000000000000000000002';

    const v3SwapInput = encodeParams(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        [RECIPIENT_ROUTER, amountIn.toString(), minWethOut, path, true]
    );

    const unwrapInput = encodeParams(
        ['address', 'uint256'],
        [addressFrom, minWethOut]
    );

    const commands = '0x000c';
    const inputs = [v3SwapInput, unwrapInput];

    const deadline = Math.floor(Date.now() / 1000) + 1800;

    return await getDataTx(
        rpcUrl,
        uniswapAbi,
        cfg.UNIVERSAL_ROUTER,
        'execute',
        [commands, inputs, deadline],
        numberToHex(0),
        addressFrom
    );
};

export const dataSwapTokenToEthUniswapPreparedNoEstimate = async (
    rpcUrl,
    addressFrom,
    tokenIn,
    amountIn,
    slippage,
    cfg,
    prepared
) => {
    const fee = prepared.fee;

    const quotedWethOut = await getMinAmount(
        rpcUrl,
        cfg,
        tokenIn,
        cfg.WETH9,
        fee,
        amountIn
    );

    const minWethOut = parseInt(
        multiply(quotedWethOut.toString(), slippage)
    ).toString();

    const path = encodeV3Path(tokenIn, fee, cfg.WETH9);

    const RECIPIENT_ROUTER = '0x0000000000000000000000000000000000000002';

    const v3SwapInput = encodeParams(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        [RECIPIENT_ROUTER, amountIn.toString(), minWethOut, path, true]
    );

    const unwrapInput = encodeParams(
        ['address', 'uint256'],
        [addressFrom, minWethOut]
    );

    const commands = '0x000c';
    const inputs = [v3SwapInput, unwrapInput];

    const deadline = Math.floor(Date.now() / 1000) + 1800;

    const web3 = new Web3();

    const web3Contract = new web3.eth.Contract(
        uniswapAbi,
        cfg.UNIVERSAL_ROUTER
    );

    const encodeABI = web3Contract.methods
        .execute(commands, inputs, deadline)
        .encodeABI();

    return {
        addressContract: cfg.UNIVERSAL_ROUTER,
        amountTx: numberToHex(0),
        encodeABI,
        amountOutMin: minWethOut,
        fee,
        path
    };
};

export const dataSwapTokenToEthUniswap = async (rpcUrl, addressFrom, tokenIn, amountIn, slippage, cfg, permitInput) => {
    const { fee } = await findV3Pool(rpcUrl, cfg, tokenIn, cfg.WETH9);

    const quotedWethOut = await getMinAmount(rpcUrl, cfg, tokenIn, cfg.WETH9, fee, amountIn);

    const minWethOut = parseInt(
        multiply(quotedWethOut.toString(), slippage)
    ).toString();

    const path = encodeV3Path(tokenIn, fee, cfg.WETH9);

    const RECIPIENT_ROUTER = '0x0000000000000000000000000000000000000002';

    const v3SwapInput = encodeParams(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        [RECIPIENT_ROUTER, amountIn.toString(), minWethOut, path, true]
    );

    const unwrapInput = encodeParams(
        ['address', 'uint256'],
        [addressFrom, minWethOut]
    );

    let commands, inputs;

    if (permitInput) {
        commands = '0x0a000c';
        inputs = [permitInput, v3SwapInput, unwrapInput];
    } else {
        commands = '0x000c';
        inputs = [v3SwapInput, unwrapInput];
    }

    const deadline = Math.floor(Date.now() / 1000) + 1800;

    return await getDataTx(
        rpcUrl,
        uniswapAbi,
        cfg.UNIVERSAL_ROUTER,
        'execute',
        [commands, inputs, deadline],
        numberToHex(0),
        addressFrom
    );
};