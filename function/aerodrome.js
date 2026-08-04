//./function/aerodrome.js

import { info, log, privateToAddress, timeout } from "../src/other.js";
import { getMaxPriorGasPrice, getTrueAmount, getTrueGasPrice } from "../src/other.js";
import { checkAllowance, dataApprove, fromWei, getAmountToken, rawCall, sendEVMTX, toWei, waitTokenFast } from "../src/web3.js";
import { dataSwapAerodromeUniversal, dataSwapAerodromeUniversalPrepared, prepareAeroPaths } from "../src/aerodrome.js";

const GAS_LIMIT_CONFIG = {
    8453: 500000,   // Base
    10: 550000,     // Optimism
    42161: 650000,  // Arbitrum
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

export const SwapAerodromeUniversal = async(rpc, addressToken, privateKey) => {
    const address = privateToAddress(privateKey);

    const maxNumbers = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

    // 1. Approve заранее, до появления токена
    await checkAllowance(rpc, addressToken, address, info.aeroBaseUniversalRouter).then(async(allowance) => {
        if (BigInt(allowance.toString()) === 0n) {
            const gasPrice = await getTrueGasPrice(rpc);
            const gasPricePrior = (await getMaxPriorGasPrice(rpc)).toString();

            await dataApprove(rpc, addressToken, info.aeroBaseUniversalRouter, maxNumbers, address).then(async(res) => {
                await sendEVMTX(
                    rpc,
                    2,
                    res.estimateGas * 2,
                    addressToken,
                    null,
                    res.encodeABI,
                    privateKey,
                    gasPrice.toString(),
                    gasPricePrior
                );
            });

            log('log', `Successful Approve [Aero]`, 'green');
        } else {
            log('info', `Find Approve [Aero]`, 'green');
        }
    });
    let preparedPaths = null;

    try {
        preparedPaths = await prepareAeroPaths(
            rpc,
            address,
            addressToken,
            info.slippageSwap
        );
       log("info", `Prepared executable Aero routes before token received`, "green");
    } catch(e) {
        log("info", `Prepare paths failed. Will use normal route search`, "yellow");
    }

    // 2. Ждем токен на балансе
    let cachedGasPrice = null;
    let cachedGasPricePrior = null;

    const updateGas = async() => {
        try {
            cachedGasPrice = await getTrueGasPrice(rpc);
            cachedGasPricePrior = (await getMaxPriorGasPrice(rpc)).toString();
        } catch(e) {}
    };

    await updateGas();

    const gasTimer = setInterval(updateGas, 10000);

   let amountToken = await getAmountToken(rpc, addressToken, address);

    if (BigInt(amountToken.toString()) === 0n) {
        log('info', `Waiting token by WSS Transfer event...`, 'yellow');

       const tWait = Date.now();

        amountToken = await waitTokenFast(
            info.wssBASE,
            rpc,
            addressToken,
            address
        );

        markTime('WAIT TOKEN', tWait);
    }

    log('info', `Token received. Start swap [Aero]`, 'green');
    const tAfterToken = Date.now();
    // 3. Газ берем максимально свежий уже после появления токена
    clearInterval(gasTimer);

    const gasPrice = cachedGasPrice || await getTrueGasPrice(rpc);
    const gasPricePrior = cachedGasPricePrior || (await getMaxPriorGasPrice(rpc)).toString();

    const tBuildTx = Date.now();

    const res = preparedPaths
    ? await dataSwapAerodromeUniversalPrepared(
        rpc,
        address,
        addressToken,
        amountToken,
        info.slippageSwap,
        preparedPaths
    )
    : await dataSwapAerodromeUniversal(
        rpc,
        address,
        addressToken,
        amountToken,
        info.slippageSwap
    );
    if (!res) {
        log('info', `No swap tx prepared [Aero]`, 'red');
        return;
    }

    markTime('BUILD TX / QUOTE / ESTIMATE', tBuildTx);
    // try {
    //     await rawCall(rpc, info.aeroBaseUniversalRouter, res.encodeABI, address, res.amountTx || '0x0');
    //     log('info', `Simulation OK [Aero]`, 'green');
    // } catch(e) {
    //     console.log(e);
    //     log('info', `Simulation failed [Aero]`, 'red');
    //     return;
    // }
    const chainId = info.chainId || 8453;
    const gasLimit = getRandomGasLimit(chainId);

    log('info', `Fixed random gasLimit = ${gasLimit}`, 'yellow');

    const tSend = Date.now();
    await sendEVMTX(
        rpc,
        2,
        gasLimit,
        info.aeroBaseUniversalRouter,
        null,
        res.encodeABI,
        privateKey,
        gasPrice.toString(),
        gasPricePrior
    );

    markTime('SEND TX', tSend);
    markTime('TOTAL AFTER TOKEN', tAfterToken);
    log('log', `Successful swap [Aero]`, 'green');
};