import {
    sendEVMTX,
    getAmountToken,
    checkAllowance,
    dataApprove,
    getDataCall,
    getDataTx,
    numberToHex,
    fromWei,
    getDecimal,
    waitTokenFast
} from "../src/web3.js";

import {
    dataSwapUniswap,
    dataSwapTokenToEthUniswap,
    dataSwapTokenToEthUniswapPrepared,
    dataSwapTokenToEthUniswapPreparedNoEstimate,
    prepareUniswapV3Fee
} from "../src/sepUniswap.js";

import { info, log, privateToAddress, timeout } from "../src/other.js";
import { getTrueAmount, getTrueGasPrice, getMaxPriorGasPrice } from "./other.js";
import { permit2Abi } from "../src/abi.js";
import { ethers } from "ethers";

export const CHAIN = {
    1: {
        name: 'ethereum',
        WETH9: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        UNIVERSAL_ROUTER: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
    },
    11155111: {
        name: 'sepolia',
        WETH9: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        V3_FACTORY: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
        QUOTER_V2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
        PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        UNIVERSAL_ROUTER: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    },
    42161: {
        name: 'arbitrum',
        WETH9: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        UNIVERSAL_ROUTER: '0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5',
    },
    8453: {
        name: 'base',
        WETH9: '0x4200000000000000000000000000000000000006',
        V3_FACTORY: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
        QUOTER_V2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        UNIVERSAL_ROUTER: '0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC',
        PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    },
};

const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const MAX_UINT160 = ((1n << 160n) - 1n).toString();

const GAS_LIMIT_CONFIG = {
    1: 750000,        // Ethereum
    11155111: 750000, // Sepolia
    8453: 650000,     // Base
    10: 700000,       // Optimism
    42161: 800000,    // Arbitrum
};

const getRandomGasLimit = (chainId) => {
    const avg = GAS_LIMIT_CONFIG[Number(chainId)] || 700000;
    const max = Math.round(avg * 1.20);
    const step = Math.round(avg * 0.01);

    const variants = [];

    for (let gas = avg; gas <= max; gas += step) {
        variants.push(gas);
    }

    return variants[Math.floor(Math.random() * variants.length)];
};

const markTime = (label, start) => {
    log('log', `[TIME] ${label}: ${Date.now() - start} ms`, 'yellow');
};

const getWssRpc = (cfg) => {
    const upper = cfg.name.toUpperCase();

    return (
        info[`wss${upper}`] ||
        info[`wss${cfg.name}`] ||
        info.wssBASE ||
        info.wssETH ||
        info.wss
    );
};

const getPrepareAmount = async(rpcUrl, token, chainId) => {
    const decimals = await getDecimal(rpcUrl, token);

    const USDC_BY_CHAIN = {
        1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        42161: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    };

    const usdc = USDC_BY_CHAIN[Number(chainId)];

    if (usdc && token.toLowerCase() === usdc.toLowerCase()) {
        return ethers.utils.parseUnits('0.2', Number(decimals)).toString();
    }

    return ethers.utils.parseUnits('3000', Number(decimals)).toString();
};

export function buildCommands({ inNative, outNative, takePortion, needsSweep }) {
    const bytes = [];

    if (inNative) bytes.push('0b');
    bytes.push('00');
    if (takePortion) bytes.push('06');
    if (outNative) bytes.push('0c');
    else if (needsSweep) bytes.push('04');

    return '0x' + bytes.join('');
}

export const ensurePermit2Unlimited = async ({
    rpcUrl,
    cfg,
    token,
    owner,
    router,
    privateKey,
    gasPrice,
    gasPricePrior
}) => {
    const erc20AllowanceToPermit2Raw = await checkAllowance(
        rpcUrl,
        token,
        owner,
        cfg.PERMIT2
    );

    const erc20AllowanceToPermit2 = BigInt(erc20AllowanceToPermit2Raw);

    if (erc20AllowanceToPermit2 === 0n) {
        const approveTx = await dataApprove(
            rpcUrl,
            token,
            cfg.PERMIT2,
            MAX_UINT256,
            owner
        );

        await sendEVMTX(
            rpcUrl,
            2,
            approveTx.estimateGas * 2,
            token,
            null,
            approveTx.encodeABI,
            privateKey,
            gasPrice,
            gasPricePrior
        );

        log('log', `[UNI] ERC20 approve -> Permit2 OK`, 'green');
    } else {
        log('info', `[UNI] ERC20 approve -> Permit2 exists`, 'green');
    }

    const perm = await getDataCall(
        rpcUrl,
        permit2Abi,
        cfg.PERMIT2,
        'allowance',
        [owner, token, router]
    );

    const pAmount = BigInt(Array.isArray(perm) ? perm[0] : perm.amount);

    if (pAmount === 0n) {
        const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

        const tx = await getDataTx(
            rpcUrl,
            permit2Abi,
            cfg.PERMIT2,
            'approve',
            [token, router, MAX_UINT160, expiration],
            numberToHex(0),
            owner
        );

        await sendEVMTX(
            rpcUrl,
            2,
            tx.estimateGas * 2,
            cfg.PERMIT2,
            null,
            tx.encodeABI,
            privateKey,
            gasPrice,
            gasPricePrior
        );

        log('log', `[UNI] Permit2 approve -> Router OK`, 'green');
    } else {
        log('info', `[UNI] Permit2 approve -> Router exists`, 'green');
    }
};

export const SwapUniswap = async ({ rpcUrl, tokenIn, tokenOut, privateKey }) => {
    const address = privateToAddress(privateKey);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const { chainId } = await provider.getNetwork();
    const cfg = CHAIN[Number(chainId)];

    if (!cfg) throw new Error('Unsupported chain');

    const NATIVE = 'ETH';
    const isNative = (t) => t === NATIVE;
    const toErc20Address = (t) => isNative(t) ? cfg.WETH9 : t;

    const inNative = isNative(tokenIn);
    const outNative = isNative(tokenOut);

    const tokenInErc20 = toErc20Address(tokenIn);
    const tokenOutErc20 = toErc20Address(tokenOut);

    const gasPrice = (await getTrueGasPrice(rpcUrl)).toString();
    const gasPricePrior = (await getMaxPriorGasPrice(rpcUrl)).toString();

    if (!inNative && outNative) {
        await ensurePermit2Unlimited({
            rpcUrl,
            cfg,
            token: tokenInErc20,
            owner: address,
            router: cfg.UNIVERSAL_ROUTER,
            privateKey,
            gasPrice,
            gasPricePrior
        });

        let preparedUni = null;

        try {
            const testAmount = await getPrepareAmount(rpcUrl, tokenInErc20, chainId);

            preparedUni = await prepareUniswapV3Fee(
                rpcUrl,
                cfg,
                tokenInErc20,
                cfg.WETH9,
                testAmount
            );

            log('info', `[UNI] Prepared fee before token received`, 'green');
        } catch(e) {
            console.log(e?.message || e);
            log('info', `[UNI] Prepare fee failed. Will use normal search`, 'yellow');
        }

        let cachedGasPrice = gasPrice;
        let cachedGasPricePrior = gasPricePrior;

        const updateGas = async() => {
            try {
                cachedGasPrice = (await getTrueGasPrice(rpcUrl)).toString();
                cachedGasPricePrior = (await getMaxPriorGasPrice(rpcUrl)).toString();
            } catch(e) {}
        };

        await updateGas();

        const gasTimer = setInterval(updateGas, 10000);

        let amountIn = await getAmountToken(rpcUrl, tokenInErc20, address);

        if (!amountIn || BigInt(amountIn.toString()) === 0n) {
            const wssRpc = getWssRpc(cfg);

            if (wssRpc) {
                log('info', `[UNI] Waiting token by WSS Transfer event...`, 'yellow');

                const tWait = Date.now();

                amountIn = await waitTokenFast(
                    wssRpc,
                    rpcUrl,
                    tokenInErc20,
                    address
                );

                markTime('WAIT TOKEN', tWait);
            } else {
                log('info', `[UNI] No WSS found. Waiting token by polling...`, 'yellow');

                while (!amountIn || BigInt(amountIn.toString()) === 0n) {
                    await timeout(700);
                    amountIn = await getAmountToken(rpcUrl, tokenInErc20, address);
                }
            }
        }

        clearInterval(gasTimer);

        log('info', `[UNI] Token received. Start swap`, 'green');

        const tBuild = Date.now();

        const resSwap = preparedUni
        ? await dataSwapTokenToEthUniswapPreparedNoEstimate(
            rpcUrl,
            address,
            tokenInErc20,
            amountIn,
            info.slippageSwap,
            cfg,
            preparedUni
        )
        : await dataSwapTokenToEthUniswap(
            rpcUrl,
            address,
            tokenInErc20,
            amountIn,
            info.slippageSwap,
            cfg,
            null
        );

        markTime('BUILD TX / QUOTE / ESTIMATE', tBuild);

        if (!resSwap) {
            log('info', `[UNI] No swap tx prepared`, 'red');
            return;
        }

        const gasLimit = getRandomGasLimit(chainId);

        log('info', `[UNI] Fixed random gasLimit = ${gasLimit}`, 'yellow');

        const tSend = Date.now();

        await sendEVMTX(
            rpcUrl,
            2,
            gasLimit,
            resSwap.addressContract,
            resSwap.amountTx,
            resSwap.encodeABI,
            privateKey,
            cachedGasPrice,
            cachedGasPricePrior
        );

        markTime('SEND TX', tSend);

        const ticker = info[tokenInErc20] || tokenInErc20;
        const decimal = await getDecimal(rpcUrl, tokenInErc20);

        log(
            'log',
            `Successful Swap ${parseFloat(amountIn / 10 ** decimal).toFixed(2)} ${ticker} -> ETH`,
            'green'
        );

        return;
    }

    const amountInEth = await getTrueAmount(rpcUrl, address, 'Swap');

    const commands = buildCommands({
        inNative,
        outNative,
        takePortion: false,
        needsSweep: false
    });

    const ticker = info[tokenOutErc20] || tokenOutErc20;

    const res = await dataSwapUniswap(
        rpcUrl,
        address,
        tokenInErc20,
        tokenOutErc20,
        amountInEth,
        info.slippageSwap,
        commands,
        cfg
    );

    await sendEVMTX(
        rpcUrl,
        2,
        Math.ceil(Number(res.estimateGas) * 1.3),
        res.addressContract,
        res.amountTx,
        res.encodeABI,
        privateKey,
        gasPrice,
        gasPricePrior
    );

    log('log', `Successful Swap ${fromWei(amountInEth, 'ether')} ETH to ${ticker}`, 'green');
};