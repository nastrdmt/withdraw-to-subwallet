import { info, timeout, parseFile, generateRandomAmount, privateToAddress,  log, getTrueAmount, getTrueGasPrice, getTokenSymbol, waitForTokenBalance, getMaxPriorGasPrice, getSwapQuote, getApproveTransaction, getTrueTokenAmount, getBalanceEtherium } from '../src/other.js';
import { fromWei, getETHAmount, getEstimateGas, getGasPrice, getDataCall, getPriorityGasPrice, numberToHex, sendEVMTX, toWei, getAmountToken, getTransferData, getEstimatedGasLimit, checkAllowance, dataApprove } from '../src/web3.js';
import { subtract, multiply, add } from 'mathjs';
import fs from 'fs';
import readline from 'readline-sync';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';

export const withdrawToChain = async (chain, toAddress, privateKey) => {
  const address = privateToAddress(privateKey);
  const rpc = info["rpc" + chain];

  const eip1559 = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "Linea", "Sepolia", "Manta", "OPsepolia", "zkSync", "Base", "SOPHON", 'Gravity'];
  const typeTX = eip1559.includes(chain) ? 2 : 0;

  // как и было (используется в type 2 ветке ниже)
  const amount = await getTrueAmount(rpc, address, "Swap");
  // console.log('amount', amount)
  try {
    const amountETHRaw = await getTrueAmount(rpc, address, "Swap");
    if (!amountETHRaw || BigInt(amountETHRaw) <= 0n) {
      log("log", "⚠️  Баланс = 0, пропускаем");
      return;
    }

    const gasPriceRaw = await getTrueGasPrice(rpc);
    const gasPrice = (parseFloat(gasPriceRaw).toFixed(5)).toString();

    // не трогаю type 2 (как просил), но оставляю твои вычисления
    const gasPricePrior = (parseFloat(await getMaxPriorGasPrice(rpc)).toFixed(5).toString(5));
    const priorityMaxFee = typeTX === 2 ? await getPriorityGasPrice(rpc) : 0;
  
    const gasLimit = ["Arbitrum", "zkSync", "Linea", "Sepolia", "OPsepolia", "Base", 'Ethereum', "SOPHON", 'Gravity'].includes(chain)
      ? await getEstimateGas(rpc, "0x", toWei("0.00001", "ether"), address, toAddress)
      : 60000;

    const fee = typeTX === 2
      ? gasLimit * toWei(parseFloat(gasPrice + priorityMaxFee).toFixed(6), "gwei")
      : gasLimit * toWei(gasPrice, "gwei");

    const typeValue = process.env.Type_Value?.toLowerCase();

    if (typeTX === 0) {
      const balanceWei = BigInt(amountETHRaw);
      const feeWei = BigInt(fee);

      const bufferWei = BigInt(toWei("0.00001", "ether"));

      let amountETHWei;

      if (typeValue === "max") {
        amountETHWei = balanceWei - feeWei - bufferWei;
      } else {
        // ВАЖНО: не отправляем весь баланс, иначе на газ не останется
        // тут оставляю твою идею "amount" (getTrueAmount(...,'Swap')) как значение для НЕ max
        amountETHWei = BigInt(amount);
      }

      if (amountETHWei <= 0n) {
        log("log", "❌ После вычета комиссии сумма <= 0, пропускаем");
        return;
      }

      if (balanceWei < amountETHWei + feeWei) {
        log("log", `❌ Недостаточно средств: баланс ${parseFloat(fromWei(numberToHex(amountETHRaw), "ether")).toFixed(7)},` + `комиссия ${parseFloat(fromWei(numberToHex(fee), "ether")).toFixed(7)}. Пропускаем`);
        return;
      }

      await sendEVMTX(rpc, 0, gasLimit, toAddress, amountETHWei.toString(), null, privateKey, gasPrice, gasPrice);

      log(
        "info",
        `${chain}. Transfer ${parseFloat(fromWei(numberToHex(amountETHWei.toString()), "ether")).toFixed(5)} to ${toAddress}`,
        "yellow"
      );

      return; // чтобы не падать в type 2 логику
    }

    // ======= type 2 НЕ ТРОГАЮ (как и просил) =======
    if (amountETHRaw <= fee) {
      log(
        "log",
        `❌ Недостаточно средств: баланс ${parseFloat(fromWei(numberToHex(amountETHRaw), "ether")).toFixed(7)}, ` +
        `комиссия ${parseFloat(fromWei(numberToHex(fee), "ether")).toFixed(7)}. Пропускаем`
      );
      return;
    }

    let amountETH;

    if (typeTX === 2 && typeValue === "max") {
    const safetyWei = 1000000000n; // 1 gwei (перекрывает твой overshot 588,374,002 wei)
    amountETH = (BigInt(amountETHRaw) - BigInt(fee) - safetyWei).toString();
    } else {
        amountETH = typeTX === 0
        ? (
        typeValue === "max"
            ? parseInt(subtract(amountETHRaw, fee))
            : parseInt(amountETHRaw)
        )
        : (
        typeValue === "max"
            ? parseInt(subtract(amountETHRaw, fee))
            : parseInt(amount)
    );
}
    await sendEVMTX(rpc, typeTX, gasLimit, toAddress, amountETH, null, privateKey, gasPrice, gasPrice);
    log("info", `${chain}. Transfer ${parseFloat(fromWei(numberToHex(amountETH), "ether")).toFixed(5)} to ${toAddress}`, "yellow");
  } catch (err) {
    log("log", err);
    return;
  }
};

// const withdrawToChain = async (chain, toAddress, privateKey) => {
//     const address = privateToAddress(privateKey);
//     const rpc = info['rpc' + chain];
//     const eip1559 = ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Linea', 'Sepolia', 'Manta', 'OPsepolia', 'zkSync', 'Base'];
//     const typeTX = eip1559.includes(chain) ? 2 : 0;
    
//     const amount = await getTrueAmount(rpc, address, 'Swap');
//     console.log('address', address);

//     try {
//         await getTrueAmount(rpc, address, 'Swap').then(async (amountETHRaw) => {
//             if (!amountETHRaw || parseFloat(amountETHRaw) <= 0) {
//                 log('log', '⚠️  Баланс = 0, пропускаем');
//                 return;
//             }

//             await getTrueGasPrice(rpc).then(async (gasPriceRaw) => {
//                 const gasPrice = (parseFloat(gasPriceRaw).toFixed(5)).toString();
//                 const gasPricePrior = (parseFloat(await getMaxPriorGasPrice(rpc)).toFixed(5).toString(5));
//                 const priorityMaxFee = typeTX === 2 ? await getPriorityGasPrice(rpc) : 0;

//                 const gasLimit = ['Arbitrum', 'zkSync', 'Linea', 'Sepolia', 'OPsepolia', 'Base'].includes(chain)
//                     ? await getEstimateGas(rpc, '0x', toWei('0.00001', 'ether'), address, toAddress)
//                     : 60000;

//                 const fee = typeTX === 2
//                     ? gasLimit * toWei(parseFloat(gasPrice + priorityMaxFee).toFixed(6), 'gwei')
//                     : gasLimit * toWei(gasPrice, 'gwei');

               


//                 if (amountETHRaw <= fee) {
//                     log('log', `❌ Недостаточно средств: баланс ${parseFloat(fromWei(numberToHex(amountETHRaw), 'ether')).toFixed(7)}, комиссия ${parseFloat(fromWei(numberToHex(fee), 'ether')).toFixed(7)}. Пропускаем`);
//                     return;
//                 }

//                 let amountETH;
//                 const typeValue = process.env.Type_Value?.toLowerCase();
                
//                 amountETH = typeTX === 0
//                     ? (
//                         typeValue === 'max'
//                             ? parseInt(subtract(amountETHRaw, fee))
//                             : parseInt(amountETHRaw)
//                     )
//                     : (
//                         typeValue === 'max'
//                             ? parseInt(subtract(amountETHRaw, fee))
//                             : parseInt(amount)
//                     );
               
//                 await sendEVMTX(rpc, typeTX, gasLimit, toAddress, amountETH, null, privateKey, gasPrice, gasPrice);

//                 log('info', `${chain}. Transfer ${parseFloat(fromWei(numberToHex(amountETH), 'ether')).toFixed(5)} to ${toAddress}`, 'yellow');
//             });
//         });
//     } catch (err) {
//         log('log', err);
//         return;
//     }
// };

export const withdrawTokenToChain = async (chain, toAddress, privateKey, addressToken) => {
    const address = privateToAddress(privateKey);
    
    const rpc = info['rpc' + chain];
    const eip1559 = ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Linea', 'Sepolia', 'Manta', 'Base', 'Sophon', 'Gravity']
    const typeTX = eip1559.includes(chain) ? 2 : 0;
    const symbol = await getTokenSymbol(rpc, addressToken);
    const TotalamountToken = await waitForTokenBalance(
        () => getAmountToken(rpc, addressToken, address),
        symbol,
        500, // Проверка каждые 0.5 сек
    );

    if (TotalamountToken === null) {
        return;
    }
    
    const unit = (symbol === 'USDC') ? 'lovelace' : 'ether';
        log ('info', `Found total amount ${parseFloat(fromWei(numberToHex(TotalamountToken), unit)).toFixed(5)} ${symbol}`, 'yellow')


    const amountToken = await getTrueTokenAmount(rpc, addressToken, address)
    const data = getTransferData(toAddress, amountToken);
    
    try {
        const gasPrice = await getTrueGasPrice(rpc);
        let gasLimit;
          try {
            if (['Etherium', 'Arbitrum', 'zkSync', 'Linea', 'Sepolia', 'Base', 'Sophon', 'Gravity'].includes(chain)) {
                gasLimit = await getEstimateGas(rpc, addressToken, amountToken, address, toAddress);
            } else {
                gasLimit = 23000;
            }
        
        } catch (err) {
          console.error('❌ Ошибка при getEstimateGas:', err.message);
        }
        
        await sendEVMTX(rpc, typeTX, gasLimit, addressToken, null, data, privateKey, gasPrice, gasPrice); // Устанавливаем значение value в 0, так как для отправки токенов не нужно указывать значение ETH

        log('info', `${chain}. Transfer ${parseFloat(fromWei(numberToHex(amountToken), unit)).toFixed(5)} ${symbol} to ${toAddress}`, 'yellow');
    } catch (err) {
        log('log', err);
        return;
    }
}