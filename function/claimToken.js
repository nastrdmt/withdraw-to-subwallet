import { info, timeout, parseFile, generateRandomAmount, privateToAddress,  log, getTrueAmount, getTrueGasPrice, getTokenSymbol, waitForTokenBalance, getMaxPriorGasPrice, getSwapQuote, getApproveTransaction, getTrueTokenAmount, getBalanceEtherium } from '../src/other.js';
import { fromWei, getETHAmount, getEstimateGas, getGasPrice, getDataCall, getPriorityGasPrice, numberToHex, sendEVMTX, toWei, getAmountToken, getTransferData, getEstimatedGasLimit, checkAllowance, dataApprove } from '../src/web3.js';
import { subtract, multiply, add } from 'mathjs';
import fs from 'fs';
import readline from 'readline-sync';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';

export const claimToken = async(chain, privateKey) => {
    const address = privateToAddress(privateKey);

    const rpc = info['rpc' + chain];
    const eip1559 = ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Linea', 'Sepolia', 'Manta', 'OPsepolia', 'zkSync', 'Base']
    const typeTX = eip1559.includes(chain) ? 2 : 0;

    try {
            await getTrueGasPrice(rpc).then(async(gasPrice) => {
                gasPrice = (parseFloat(gasPrice).toFixed(9)).toString();
                console.log('gasPrice', gasPrice)
                console.log('address', address)
                const gasPricePrior = (await getMaxPriorGasPrice(rpc)).toString(9);
                const priorityMaxFee = typeTX == 2 ? await getPriorityGasPrice(rpc) : 0;

                const InvestmentProof = await getDataCall(info.rpcBSC, //формирует proof через контракт (возможно формирование через АПИ)
                    abiInvestmentProof, 
                    info.coinTerminalInvestProof, 
                    'getInvestmentProof', 
                    [66, address])
                console.log('investmetProof', InvestmentProof)
                const CoinTerminalClaim = '0x8407490c88667C1C5Ca2910f95Dd4027C84e1804'

                const data = await getDataCall( //формирует data для отправки тх клейма
                    rpc, 
                    abiCoinTerminalClaim, // ABI контракта для клейма (убедитесь, что у вас есть этот ABI)
                    CoinTerminalClaim, 
                    'claimToken', // Замените на правильное название функции
                    [6, InvestmentProof] // Передаем proof как параметр
                );


            console.log('Encoded transaction data:', data);
            const gasLimit = await getEstimatedGasLimit(rpc, address, CoinTerminalClaim, data, 0);

            console.log('Estimated gas limit:', gasLimit);

                await sendEVMTX(rpc, typeTX, gasLimit, CoinTerminalClaim, null, data, privateKey, gasPrice, gasPricePrior);

                log('info', `${chain}. Claimed`, 'yellow');
            });
      
    } catch (err) {
        log('log', err);
        return;
    }
}