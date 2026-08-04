import { multiply } from "mathjs";
import { generateRandomAmount, info, log, parseFile, privateToAddress, timeout } from "../src/other.js";
import { fromWei, getAmountToken, getETHAmount, getGasPrice, numberToHex, toWei } from "../src/web3.js";
import fs from 'fs';
import chalk from 'chalk';
import axios from "axios";

export const waitGasPrice = async(rpc, needGasPrice, pauseTime) => {
    while (true) {
        const gasPriceNow = await getGasPrice(rpc);
        if (Number(gasPriceNow) <= Number(needGasPrice)) {
            log('log', `Gas price = ${Number(gasPriceNow).toFixed(2)}`, 'green');
            return parseFloat(gasPriceNow).toFixed(9);
        } else {
            log('log', `Wait for Gas Price, now = ${Number(gasPriceNow).toFixed(2)}. Need = ${needGasPrice}`);
            await timeout(pauseTime);
        }
    }
}

export const getTrueAmount = async(rpc, address, type) => {
    const decimals = parseInt(process.env['Value_Decimals'], 10);
    // const decimalsNew = null;

    const decimalsNew = process.env['Type_Decimals'] === 'random'
    ? generateRandomAmount(process.env['Value_Decimals_Min'], process.env['Value_Decimals_Max'], 0)
    : parseInt(process.env['Value_Decimals'], 10);

    const amount = info.typeValue == 'procent'
        ? toWei(parseFloat(fromWei(numberToHex(multiply(await getETHAmount(rpc, address),
            generateRandomAmount(process.env['Value_' + type + '_Min'], process.env['Value_' + type + '_Max'], 0) / 100)), 'ether')).toFixed(4), 'ether')
        : toWei(generateRandomAmount(process.env['Value_' + type + '_Min'], process.env['Value_' + type + '_Max'], decimalsNew).toString(), 'ether');

    return amount;
}

export const getTrueGasPrice = async(rpc) => {
    const gasPrice = multiply(info.increaseGasPrice, await waitGasPrice(rpc, info.needGasPrice, 7000)).toFixed(9);
    return gasPrice;
}

export const getMaxPriorGasPrice =
    async rpcUrl => {
        const response =
            await fetch(rpcUrl, {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,

                    method:
                        'eth_maxPriorityFeePerGas',

                    params: []
                })
            });

        const data =
            await response.json();

        if (
            !response.ok ||
            data?.error ||
            typeof data?.result !== 'string' ||
            !/^0x[0-9a-f]+$/i.test(
                data.result
            )
        ) {
            const error =
                new Error(
                    `Invalid JSON RPC priority fee response: ${
                        data?.error?.message ||
                        response.status
                    }`
                );

            error.status =
                response.status;

            error.code =
                Number(
                    data?.error?.code
                );

            throw error;
        }

        const wei =
            Number.parseInt(
                data.result,
                16
            );

        if (
            !Number.isFinite(wei) ||
            wei < 0
        ) {
            throw new Error(
                'Invalid priority fee returned by RPC'
            );
        }

        return (
            wei /
            1e9
        ).toFixed(9);
    };