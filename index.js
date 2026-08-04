
import fs from 'fs';
import readline from 'readline-sync';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import { info, timeout, parseFile, generateRandomAmount, privateToAddress,  log, getTrueAmount, getTrueGasPrice, getTokenSymbol, waitForTokenBalance, getMaxPriorGasPrice, getSwapQuote, getApproveTransaction, getTrueTokenAmount, getBalanceEtherium } from './src/other.js';
import { fromWei, getETHAmount, getEstimateGas, getGasPrice, getDataCall, getPriorityGasPrice, numberToHex, sendEVMTX, toWei, getAmountToken, getTransferData, getEstimatedGasLimit, checkAllowance, dataApprove } from './src/web3.js';
import { withdrawTokenToChain, withdrawToChain } from './function/withdraw.js';
import { startOkx } from './cex/okx.js';
import { startBinance } from './cex/binance.js';
import { startGate } from './cex/gate.js';
import { startBybit } from './cex/bybit.js';
import { SwapAerodromeUniversal } from './function/aerodrome.js';
import { SwapUniswap } from './function/sepUniswap.js';
import { SwapPancake } from './function/pancake.js';
import { startPancakeV3RouteWatcher } from './function/pancakeWatcher.js';

const output = fs.createWriteStream(`history.log`, { flags: 'a' });
const logger = new console.Console(output);
consoleStamp(console, { format: ':date(HH:MM:ss)' });
consoleStamp(logger, { format: ':date(yyyy/mm/dd HH:MM:ss)', stdout: output });

const pauseWalletTime = generateRandomAmount(process.env.TIMEOUT_WALLET_SEC_MIN * 1000, process.env.TIMEOUT_WALLET_SEC_MAX * 1000, 0);
// const random = info.random;

(async() => {
    const wallet = parseFile('private.txt');
    const walletCEX = parseFile('subWallet.txt');
    const mainStage = [
        'Transfer ETH',
        'Transfer ETH testnet',
        'Transfer Token',
        'Transfer Token testnet',
        'DEX',
        'test',
        'Sell in CEX',
        'Check balances'
    ];

    const withdrawEth = [
        'Transfer ETHEREUM',
        'Transfer Arbitrum',
        'Transfer OPTIMISM',
        'Transfer AVALANCHE',
        'Transfer POLYGON',
        'Transfer BSC',
        'Transfer ZKSYNC',
        'Transfer Linea',
        'Transfer Base',
        'Transfer MEGA',
        'Transfer SOPHON',
        'Transfer Gravity'
    ];

    const withdrawEthTestnet = [
         'Transfer Sepolia',
    ];

    const withdrawToken = [
        'Transfer Manta Token',
        'Transfer Ethereum Almanak',
        'Transfer Base USDC',
        'Transfer Linea',
        'Transfer Soph',
        'Transfer atUSD',
        'Transfer atETH'
    ]

    const withdrawTokenTestnet = [
        'Transfer Sepolia USDC',
        'Transfer Sepolia UNI',
        'Transfer Sepolia USDT',
    ];

    const DEXsStage = [
        'OKX Dex (Swap Linea ETH -> USDC)',
        'AeroDrome Dex (Swap Token to ETH)',
        'Uniswap swap ETH -> token (arb)',
        'Uniswap swap token -> ETH (arb)',
        'Uniswap swap ETH -> token (base)',
        'Uniswap swap token -> ETH (base)',
        'Pancake swap QUID -> USDC (base)',
        'Pancake swap USDT -> ETH (base)'
    ];

    const testStage =[
        'GetINvestmentProof'
    ]

    const CEXsStage = [
        'OKX',
        'BINANCE',
        'GATE',
        'BYBIT'
    ]

    const BalanceStage = [
        'Check balances'
    ]
    
    const index = readline.keyInSelect(mainStage, 'Choose stage!');
    let index1;
    let index2;
    let index3;
    let index4;
    let index5;
    let index6;
    let index7;
    let index8;
    let index9;

    if (index == -1) { process.exit() };
    console.log(chalk.green(`Start ${mainStage[index]}`));
    logger.log(`Start ${mainStage[index]}`);
    if (index == 0) {
        index1 = readline.keyInSelect(withdrawEth, 'Choose stage!');
        if (index1 == -1) { process.exit() };
        log('info', `Start ${withdrawEth[index1]}`, 'green');
    } else if (index == 1) {
        index2 = readline.keyInSelect(withdrawEthTestnet, 'Choose stage!');
        if (index2 == -1) { process.exit() };
        log('info', `Start ${withdrawEthTestnet[index2]}`, 'green');
    } else if (index == 2) {
        index3 = readline.keyInSelect(withdrawToken, 'Choose stade!')
        if (index3 == -1) { process.exit() };
        log('info', `Start ${withdrawToken[index3]}`, 'green');
    } else if (index == 3) {
        index4 = readline.keyInSelect(withdrawTokenTestnet, 'Choose stade!')
        if (index4 == -1) { process.exit() };
        log('info', `Start ${withdrawTokenTestnet[index4]}`, 'green');
    } else if (index == 4) {
        index5 = readline.keyInSelect(DEXsStage, 'Choose stade!')
        if (index5 == -1) { process.exit() };
        log('info', `Start ${DEXsStage[index5]}`, 'green');
    } else if (index == 5) {
        index6 = readline.keyInSelect(testStage, 'Choose stade!')
        if (index6 == -1) { process.exit() };
        log('info', `Start ${testStage[index6]}`, 'green');
    } else if (index == 6) {
        index7 = readline.keyInSelect(CEXsStage, 'Choose stade!')
        if (index7 == -1) { process.exit() };
        log('info', `Start ${CEXsStage[index7]}`, 'green');
    } else if (index == 7) {
        index8 = readline.keyInSelect(BalanceStage, 'Choose stade!')
        if (index8 == -1) { process.exit() };
        log('info', `Start ${BalanceStage[index8]}`, 'green');
    }

    let pancakeRouteWatcher = null;
    for (let i = 0; i < wallet.length; i++) {

        try {
            if (i != 10) {
                log('info', `Wallet ${i+1}: ${privateToAddress(wallet[i])} | Subwallet CEX ${i+1}: ${walletCEX[i]}`, 'blue');
            } 
            // else {
            //     log('info', `Wallet ${i+1}: ${await privateToStarknetAddress(wallet[i])} | Subwallet CEX ${i+1}: ${walletCEX[i]}`, 'blue');
            // }
            
            if (!walletCEX[i]) { throw new Error('Add Wallets in SubWallets in file!'); }
        } catch (err) { console.log(err) } //throw new Error('Add Private keys in file!'); }

        if (index1 == 0) { //withdrawEth
            await withdrawToChain('Ethereum', walletCEX[i], wallet[i]);
        } else if (index1 == 1) {
            await withdrawToChain('Arbitrum', walletCEX[i], wallet[i]);
        } else if (index1 == 2) {
            await withdrawToChain('Optimism', walletCEX[i], wallet[i]);
        } else if (index1 == 3) {
            await withdrawToChain('Avalanche', walletCEX[i], wallet[i]);
        } else if (index1 == 4) {
            await withdrawToChain('Polygon', walletCEX[i], wallet[i]);
        } else if (index1 == 5) {
            await withdrawToChain('BSC', walletCEX[i], wallet[i]);
        } else if (index1 == 6) {
            await withdrawToChain('zkSync', walletCEX[i], wallet[i]);
        } else if (index1 == 7) {
            await withdrawToChain('Linea', walletCEX[i], wallet[i]);
        } else if (index1 == 8) {
            await withdrawToChain('Base', walletCEX[i], wallet[i]);
        } else if (index1 == 9) {
            await withdrawToChain('MEGAeth', walletCEX[i], wallet[i]);
        } else if (index1 == 10) {
            await withdrawToChain('SOPHON', walletCEX[i], wallet[i]);
        } else if (index1 == 11) {
            await withdrawToChain('Gravity', walletCEX[i], wallet[i]);
        } 

        if (index2 == 0) { //withdrawEthTestnet
            await withdrawToChain('Sepolia', walletCEX[i], wallet[i]);
        }

        if (index3 == 0) { //withdrawToken
            await withdrawTokenToChain('Manta', walletCEX[i], wallet[i], info.mantatoken);
        } else if (index3 == 1) {
            await withdrawTokenToChain('Ethereum', walletCEX[i], wallet[i], info.USDC);
        } else if (index3 == 2) {
            await withdrawTokenToChain('Base', walletCEX[i], wallet[i], info.BaseUSDC);
        } else if (index3 == 3) {
            await withdrawTokenToChain('Linea', walletCEX[i], wallet[i], info.LINEA);
        } else if (index3 == 4) {
            await withdrawTokenToChain('Sophon', walletCEX[i], wallet[i], info.SOPH);
        } else if (index3 == 5) {
            await withdrawTokenToChain('Gravity', walletCEX[i], wallet[i], info.atUSD);
        } else if (index3 == 6) {
            await withdrawTokenToChain('Gravity', walletCEX[i], wallet[i], info.atETH);
        } 
         
        if (index4 == 0) { //withdrawTokenTestnet
            await withdrawTokenToChain('Sepolia', walletCEX[i], wallet[i], info.USDCsepolia);
        } else if (index4 == 1) {
            await withdrawTokenToChain('Sepolia', walletCEX[i], wallet[i], info.UNIsepolia);
        } else if (index4 == 2) {
            await withdrawTokenToChain('Sepolia', walletCEX[i], wallet[i], info.EUROz);
        }



        if (index5 == 0) { //Dexs 
            await okxDexEthTotoken('Linea', wallet[i], info.LineaETH, info.LineaUSDC);
        } else if (index5 == 1) {
            await SwapAerodromeUniversal(info.rpcBase, info.baseToken, wallet[i])
        } else if (index5 == 2) {
            await await SwapUniswap({
                    rpcUrl: info.rpcArbitrum,
                    tokenIn:   'ETH',                        // ← native
                    tokenOut:    info.arbUSDC,     // ← ERC20
                    privateKey: wallet[i],
                });
        } else if (index5 == 3) {
                await SwapUniswap({
                    rpcUrl: info.rpcArbitrum,
                    tokenIn: info.arbUSDC,                         // ← native
                    tokenOut:  'ETH',       // ← ERC20
                    privateKey: wallet[i],
                });
        } else if (index5 == 4) {
            await await SwapUniswap({
                    rpcUrl: info.rpcBase,
                    tokenIn:   'ETH',                        // ← native
                    tokenOut:    info.BaseLMTS,     // ← ERC20
                    privateKey: wallet[i],
                });
        } else if (index5 == 5) {
                await SwapUniswap({
                    rpcUrl: info.rpcBase,
                    tokenIn: info.BaseLMTS,                         // ← native
                    tokenOut:  'ETH',       // ← ERC20
                    privateKey: wallet[i],
                });
        } else if (index5 == 6) {
                await SwapPancake({
                    rpcUrl: info.rpcBase,
                    tokenIn:  info.QUID,                         // ← native
                    tokenOut:   info.BaseUSDC,     // ← ERC20
                    privateKey: wallet[i],
                });
        } else if (index5 == 7) {
                await SwapPancake({
                    rpcUrl: info.rpcBase,
                    tokenIn:   info.BaseUSDbC,                        // ← native
                    tokenOut:   info.BaseUSDT,    // ← ERC20
                    privateKey: wallet[i],
                });
        }
      
        if (index6 == 0) { //testStage
            await claimToken('Ethereum', wallet[i]);
            await withdrawTokenToChain('Ethereum', walletCEX[i], wallet[i], info.suiAgent);

        }
 
        if (index7 == 0) { //CEXs
            await startOkx('SOPH')
        } else if (index7 == 1) {
            await startBinance('SOPH')
        } else if (index7 == 2) {
            await startGate('SUIAGENT')
        } else if (index7 == 3) {
            await startBybit('SUI')
        }

        if (index8 == 0) { //balances
            await getBalanceEtherium()
        }

        await timeout(pauseWalletTime);
    }
    console.log(chalk.bgMagentaBright('Process End!'));
    logger.log('Process End!');
})();
