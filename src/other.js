import Web3 from 'web3';
import fs from 'fs';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import { table } from 'table';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fromWei, getAmountToken, getETHAmount, getEstimateGas, getGasPrice, 
  getPriorityGasPrice, numberToHex, sendEVMTX, toWei, getDataCall} from './web3.js';
import { subtract, multiply, add } from 'mathjs';
import { abiInvestmentProof, abiToken } from './abi.js';

dotenv.config();

export const getNameKey = (object, property) => {
    return Object.keys(object)[Object.values(object).findIndex(e => e == property)];
}

export const log = (type, msg, color) => {
    const output = fs.createWriteStream(`history.log`, { flags: 'a' });
    const logger = new console.Console(output);
    consoleStamp(console, { format: ':date(HH:MM:ss) :label' });
    consoleStamp(logger, { format: ':date(yyyy/mm/dd HH:MM:ss) :label', stdout: output });

    if (!color) {
        console[type](msg);
    } else {
        console[type](chalk[color](msg));
    }
    logger[type](msg);
}

export const generateRandomAmount = (min, max, num) => {
    const amount = Number(Math.random() * (parseFloat(max) - parseFloat(min)) + parseFloat(min));
    return Number(parseFloat(amount).toFixed(num));
}

export const getTrueGasPrice = async(rpc) => {
    const gasPrice = multiply(info.increaseGasPrice, await waitGasPrice(rpc, info.needGasPrice, 7000)).toFixed(9);
    return gasPrice;
}

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


export const info = {
    rpcEthereum: 'https://ethereum-rpc.publicnode.com',
    rpcArbitrum: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_ARBITRUM_API_KEY}`,
    rpcOptimism: 'https://mainnet.optimism.io',
    rpcPolygon: 'https://polygon.llamarpc.com',
    rpcAvalanche: 'https://rpc.ankr.com/avalanche',
    rpcBSC: 'https://bsc.blockrazor.xyz',
    rpcFantom: 'https://1rpc.io/ftm',
    rpcCore: 'https://rpc.coredao.org',
    rpcHarmony: 'https://rpc.ankr.com/harmony',
    rpczkSync: 'https://mainnet.era.zksync.io',
    rpcLinea: `https://linea-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    rpcSepolia: `https://ethereum-sepolia.publicnode.com`,
    rpcManta: 'https://pacific-rpc.manta.network/http',
    rpcOPsepolia: 'sepolia.optimism.io',
    rpcBase: `https://base-mainnet.infura.io/v3/${process.env.INFURA_BASE_API_KEY}`,
    rpcBaseCDP: `https://api.developer.coinbase.com/rpc/v1/base/${process.env.COINBASE_CDP_BASE_API_KEY}`,
    rpcBaseAlchemy: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_BASE_API_KEY}`,
    rpcMEGAeth: 'https://mainnet.megaeth.com/rpc',
    rpcSOPHON: 'https://rpc-quicknode.sophon.xyz',
    rpcGravity: 'https://rpc.gravity.xyz',
    increaseGasPrice: Number(process.env.Increase_Gas_Price),
    needGasPrice: Number(process.env.Gas_Price_Max),
    slippageSwap: (100 - Number(process.env.SLIPPAGE_MAX)) / 100,
    pauseTime: generateRandomAmount(process.env.TIMEOUT_ACTION_SEC_MIN * 1000, process.env.TIMEOUT_ACTION_SEC_MAX * 1000, 0),

    wssBASE: `wss://base-mainnet.infura.io/ws/v3/${process.env.INFURA_WSS_API_KEY}`,
    wssETH: `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_WSS_API_KEY}`,
    wssARBITRUM: `wss://arbitrum-mainnet.infura.io/ws/v3/${process.env.INFURA_WSS_API_KEY}`,
    wssOPTIMISM: `wss://optimism-mainnet.infura.io/ws/v3/${process.env.INFURA_WSS_API_KEY}`,


    // rpcStarknet: process.env.Starknet_RPC,
    explorerEthereum: 'https://etherscan.io/tx/',
    explorerArbitrum: 'https://arbiscan.io/tx/',
    explorerOptimism: 'https://optimistic.etherscan.io/tx/',
    explorerPolygon: 'https://polygonscan.com/tx/',
    explorerAvalanche: 'https://snowtrace.io/tx/',
    explorerBSC: 'https://bscscan.com/tx/',
    explorerFantom: 'https://ftmscan.com/tx/',
    explorerCore: 'https://scan.coredao.org/tx/',
    explorerHarmony: 'https://explorer.harmony.one/tx/',
    explorerzkSync: 'https://explorer.zksync.io/tx/',
    explorerLinea: 'https://lineascan.build/tx/',
    explorerSepolia: 'https://sepolia.etherscan.io/tx/',
    explorerManta: 'https://pacific-explorer.manta.network/tx/',
    explorerOPsepolia: 'https://sepolia-optimism.etherscan.io/tx/',
    explorerBase: 'https://basescan.org/tx/',
    explorerMEGAeth: 'https://megaeth.blockscout.com/tx/',
    explorerSOPHON: 'https://explorer.sophon.xyz/tx/',
    explorerGravity: 'https://explorer.gravity.xyz/tx/',
    mantatoken: '0x95CeF13441Be50d20cA4558CC0a27B601aC544E5',
    USDCsepolia: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    UNIsepolia: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    USDTsepolia: '0xfb122130c4d28860dbc050a8e024a71a558eb0c1',
    ETH:'0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    LineaETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    ethUSDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    opUSDC: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    LineaUSDC: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
    LineaBUSD: '0x7d43aabc515c356145049227cee54b608342c0ad',
    LineaUSDT: '0xa219439258ca9da29e9cc4ce5596924745e12b93',
    LineaDAI: '0x4af15ec2a0bd43db75dd04e62faa3b8ef36b00d5',
    LineaFOXY: '0x5fbdf89403270a1846f5ae7d113a989f850d1566',
    OPUSDe: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    arbUSDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    BaseUSDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    BaseLMTS: '0x9eadbe35f3ee3bf3e28180070c429298a1b02f93',
    BaseUSDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    coinTerminalInvestProof: '0x9b0eba47330c54e8ec051f673319de2046e6da2e',
    suiAgent: '0xa4392e3cef22679fa36704d37e5a8192cf8350f2',
    NEWT: '0xd0ec028a3d21533fdd200838f39c85b03679285d',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    BaseUSDbC: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
    BaseAERO: '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
    baseToken: '0x63706e401c06ac8513145b7687a14804d17f814b',
    ceUSDT: '0xa219439258ca9da29e9cc4ce5596924745e12b93',
    ZK: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E',
    LINEA: '0x1789e0043623282d5dcc7f213d703c6d8bafbb04',
    Rayls: '0xb5f7b021a78f470d31d762c1dda05ea549904fbd',
    ALmanak: '0xDeFA1D21c5F1cbeac00eeB54B44C7D86467cc3a3',
    EUROz: '0xED1B7De57918f6B7c8a7a7767557f09A80eC2a35',
    cEUROz: '0xCD25e0e4972e075C371948c7137Bcd498C1F4e89',
    ZAMA: '0xA12CC123ba206d4031D1c7f6223D1C2Ec249f4f3',
    SOPH: '0x000000000000000000000000000000000000800A',
    atUSD: '0xc4af68dd5b96f0a544c4417407773fefdc97f58d',
    atETH: '0xc314b8637b05a294ae9d9c29300d5f667c748bad',
    random: generateRandomAmount(process.env.PERCENT_TRANSFER_MIN / 100, process.env.PERCENT_TRANSFER_MAX / 100, 3),

    WETH: '0x4200000000000000000000000000000000000006',
    aeroBaseUniversalRouter: '0xcAF22ce31298CF2BF1D152862F80216478ad7c67',
    multicall3Aero: '0xca11bde05977b3631167028862be2a173976ca11',
    quoterAero: '0xcd2a7d98e82d6107eac1828ce8deaa6acb65b555',
    legacyFactory: '0x420dd381b31aef6683db6b902084cb0ffece40da',
    slipstreamFactory: '0x5e7bb104d84c7cb9b682aac2f3d509f5f406809a',

    QUID: '0x1a44233FAe8D50F1AeB3a5d58dd426ff4814Cb53',
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    pancakeV3: {
    feeTiers: [100, 500, 2500, 10000],

    // Используется внутри ExactInputParams.
    deadlineSeconds: 180,

    // Запас к estimateGas: 1.20 = +20%.
    gasLimitMultiplier: 1.50,

        chains: {
            1: {
                name: 'Ethereum',
                nativeSymbol: 'ETH',
                txType: 2,

                wrappedNative:
                    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: [
                    // USDC
                    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',

                    // USDT
                    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
                ]
            },

            56: {
                name: 'BSC',
                nativeSymbol: 'BNB',
                txType: 0,

                wrappedNative:
                    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: [
                    // USDT
                    '0x55d398326f99059fF775485246999027B3197955',

                    // Binance-Peg USDC
                    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
                ]
            },

            42161: {
                name: 'Arbitrum',
                nativeSymbol: 'ETH',
                txType: 2,

                wrappedNative:
                    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: [
                    // Native USDC
                    '0xaf88d065e77c8cc2239327c5edb3a432268e5831',

                    // USDT
                    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'
                ]
            },

            59144: {
                name: 'Linea',
                nativeSymbol: 'ETH',
                txType: 2,

                wrappedNative:
                    '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: [
                    // USDC
                    '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',

                    // USDT
                    '0xA219439258ca9da29E9Cc4cE5596924745e12B93'
                ]
            },

            8453: {
                name: 'Base',
                nativeSymbol: 'ETH',
                txType: 2,

                wrappedNative:
                    '0x4200000000000000000000000000000000000006',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: [
                    // USDC
                    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

                    // Bridged USDT
                    '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
                ]
            },

            204: {
                name: 'opBNB',
                nativeSymbol: 'BNB',
                txType: 0,

                wrappedNative:
                    '0x4200000000000000000000000000000000000006',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: []
            },

            324: {
                name: 'zkSync',
                nativeSymbol: 'ETH',
                txType: 2,

                wrappedNative:
                    '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',

                factory:
                    '0x1BB72E0CbbEA93c08f535fc7856E0338D7F7a8aB',

                quoterV2:
                    '0x3d146FcE6c1006857750cBe8aF44f76a28041CCc',

                swapRouter:
                    '0xD70C70AD87aa8D45b8D59600342FB3AEe76E3c68',

                intermediateTokens: [
                    // USDC.e
                    '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',

                    // USDT
                    '0x493257fD37EDB34451f62EDF8D2a0C418852bA4C'
                ]
            },

            143: {
                name: 'Monad',
                nativeSymbol: 'MON',
                txType: 2,

                wrappedNative:
                    '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',

                factory:
                    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',

                quoterV2:
                    '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',

                swapRouter:
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14',

                intermediateTokens: []
            }
        }

    },
    
    pancakeInfinity: {
        chains: {
            8453: {
                name: 'Base',
                nativeSymbol: 'ETH',
                txType: 2,

                zeroCurrency:
                    '0x0000000000000000000000000000000000000000',

                wrappedNative:
                    '0x4200000000000000000000000000000000000006',

                vault:
                    '0x238a358808379702088667322f80aC48bAd5e6c4',

                clPoolManager:
                    '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',

                binPoolManager:
                    '0xC697d2898e0D09264376196696c51D7aBbbAA4a9',

                clQuoter:
                    '0xd0737C9762912dD34c3271197E362Aa736Df0926',

                binQuoter:
                    '0xc631f4b0fc2dd68ad45f74b2942628db117dd359',

                mixedQuoter:
                    '0x2dCbF7B985c8C5C931818e4E107bAe8aaC8dAB7C',

                permit2:
                    '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768',

                universalRouter:
                    '0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB',

                clDeploymentBlock:
                    30544106,

                binDeploymentBlock:
                    30544163
            }
        }
    }

}

export const getTrueAmount = async (rpc, address, type) => {
    const rawType = process.env.Type_Value ?? 'amount';
    const typeValue = rawType.replace(/['"]/g, '').toLowerCase(); // очищаем кавычки

    if (typeValue === 'max') {
        const balance = await getETHAmount(rpc, address);
        // const gasPrice = await getTrueGasPrice(rpc);
        // const fee = BigInt(21000) * BigInt(gasPrice);
        // const safeAmount = BigInt(balance) > fee ? BigInt(balance) - fee : 0n;
        return balance.toString();
    }

    if (typeValue === 'procent') {
        const fullBalance = await getETHAmount(rpc, address);
        const percent = generateRandomAmount(
            process.env['Value_' + type + '_Min'],
            process.env['Value_' + type + '_Max'],
            0
        );
        const amount = multiply(fullBalance, percent / 100);
        const formatted = toWei(
            parseFloat(fromWei(numberToHex(amount), 'ether')).toFixed(4),
            'ether'
        );
        return formatted;
    }

    // amount по умолчанию
    const fixedAmount = generateRandomAmount(
        process.env['Value_' + type + '_Min'],
        process.env['Value_' + type + '_Max'],
        5
    );
    return toWei(fixedAmount.toString(), 'ether');
};

const getTokenDecimals = async (rpc, tokenAddress) => {
    const body = {
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
            {
                to: tokenAddress,
                data: "0x313ce567" // это selector для функции decimals(): 0x313ce567
            },
            "latest"
        ],
        id: 1
    };

    const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const json = await res.json();
    if (json.result) {
        return parseInt(json.result, 16); // вернём число в десятичном формате
    } else {
        throw new Error("Failed to fetch token decimals");
    }
};

// Основная функция
export const getTrueTokenAmount = async (rpc, tokenAddress, address) => {
    const rawType = process.env.amount_token_type ?? 'amount';
    const typeValue = rawType.replace(/['"]/g, '').toLowerCase();

    const decimals = await getTokenDecimals(rpc, tokenAddress);
    if (isNaN(decimals)) {
        throw new Error(`Token decimals is NaN for ${tokenAddress}`);
    }

    if (typeValue === 'max') {
        const balance = await getAmountToken(rpc, tokenAddress, address);
        return balance; // already raw format
    }

    if (typeValue === 'amount') {
        const minStr = process.env.Value_token_send_Min ?? '1';
        const maxStr = process.env.Value_token_send_Max ?? '2';

        const min = parseFloat(minStr);
        const max = parseFloat(maxStr);
        const numDecimals = getDecimalPlaces(minStr, maxStr);

        const amountFloat = generateRandomAmountToken(min, max, numDecimals);
        if (isNaN(amountFloat)) {
            throw new Error(`Generated amountFloat is NaN: min=${min}, max=${max}, decimals=${decimals}`);
        }

        const multiplied = amountFloat * 10 ** decimals;
        if (isNaN(multiplied)) {
            throw new Error(`Invalid multiplication result: ${amountFloat} * 10^${decimals}`);
        }

        const rawAmount = BigInt(Math.floor(multiplied));
        return rawAmount.toString();
    }

    throw new Error(`Unknown amount_token_type: ${typeValue}`);
};

// Генерация случайного значения
export const generateRandomAmountToken = (min, max, numDecimals) => {
    const amount = Math.random() * (max - min) + min;
    return Number(amount.toFixed(numDecimals));
};

// Определение количества знаков после запятой
const getDecimalPlaces = (minStr, maxStr) => {
    const getDecimals = (val) => {
        const match = val.match(/\.(\d+)/);
        return match ? match[1].length : 0;
    };
    return Math.max(getDecimals(minStr), getDecimals(maxStr));
};


export const timeout = ms => new Promise(res => setTimeout(res, ms));

export const parseFile = (file) => {
    const data = fs.readFileSync(file, "utf-8");
    const array = (data.replace(/[^a-zA-Z0-9\n]/g,'')).split('\n');
    return array;
}

export const privateToAddress = (privateKey) => {
    const w3 = new Web3();
    return w3.eth.accounts.privateKeyToAccount(privateKey).address;
}

export const getBalanceEtherium = async () => {
    let dataTabl = [];
    const title = ['#', 'Wallet', 'ETH Mainnet', 'ETH Linea', 'ETH Base', 'USDC', 'USDC Linea', 'USDC Base'];
    dataTabl.push(title);

    const wallets = fs.readFileSync('wallets.txt', 'utf8')
        .split('\n')
        .map(wallet => wallet.trim())
        .filter(wallet => wallet.length > 0);

    let totalETHMainnet = 0;
    let totalETHLinea = 0;

    for (let i = 0; i < wallets.length; i++) {
        const address = wallets[i];
        let totalETHForAddress = 0;
        let totalETHLineaForAddress = 0;

        // ETH
        let amountETHMainnet = parseFloat(fromWei(await getETHAmount(info.rpcEthereum, address), 'ether')).toFixed(5);
        let amountETHLinea   = parseFloat(fromWei(await getETHAmount(info.rpcLinea, address), 'ether')).toFixed(5);
        let amountETHBase    = parseFloat(fromWei(await getETHAmount(info.rpcBase, address), 'ether')).toFixed(5);

        // USDC Mainnet
        let amountUSDCMain = "N/A";
        if (info.USDC) {
            let val = parseFloat(
                fromWei(await getAmountToken(info.rpcEthereum, info.USDC, address), "lovelace")
            );
            amountUSDCMain = val > 0 ? chalk.green(val.toFixed(2)) : chalk.red(val.toFixed(2));
        }

        // USDC Base
        let amountUSDCBase = "N/A";
        if (info.BaseUSDC) {
            let val = parseFloat(
                fromWei(await getAmountToken(info.rpcBase, info.BaseUSDC, address), "lovelace")
            );
            amountUSDCBase = val > 0 ? chalk.green(val.toFixed(2)) : chalk.red(val.toFixed(2));
        }
        // USDC Linea
        let amountUSDCLinea = "N/A";
        if (info.LineaUSDC) {
            let val = parseFloat(
                fromWei(await getAmountToken(info.rpcLinea, info.LineaUSDC, address), "lovelace")
            );
            amountUSDCLinea = val > 0 ? chalk.green(val.toFixed(2)) : chalk.red(val.toFixed(2));
        }

        // Красим ETH
        amountETHMainnet = amountETHMainnet > 0 ? chalk.green(amountETHMainnet) : chalk.red(amountETHMainnet);
        amountETHLinea   = amountETHLinea > 0   ? chalk.green(amountETHLinea)   : chalk.red(amountETHLinea);
        amountETHBase    = amountETHBase > 0    ? chalk.green(amountETHBase)    : chalk.red(amountETHBase);

        const nextArr = [
            `${i + 1}`,
            address,
            amountETHMainnet,
            amountETHLinea,
            amountETHBase,
            amountUSDCMain,
            amountUSDCLinea,
            amountUSDCBase
        ];

        totalETHForAddress += parseFloat(fromWei(await getETHAmount(info.rpcEthereum, address), 'ether'));
        totalETHLineaForAddress += parseFloat(fromWei(await getETHAmount(info.rpcLinea, address), 'ether'));

        totalETHMainnet += totalETHForAddress;
        totalETHLinea   += totalETHLineaForAddress;

        dataTabl.push(nextArr);
    }

    const totalRow = [
        '',
        chalk.blue("Total"),
        chalk.blue(totalETHMainnet.toFixed(5)),
        chalk.blue(totalETHLinea.toFixed(5)),
        '',
        '',
        '',
        ''
    ];
    dataTabl.push(totalRow);

    log('info', `\n${table(dataTabl)}`);
}

export const getTokenSymbol = async (rpc, tokenAddress) => {
    const web3 = new Web3(rpc);
    const contract = new web3.eth.Contract(abiToken, tokenAddress);
    return await contract.methods.symbol().call();
}

export async function waitForTokenBalance(getBalanceFn, symbol, checkInterval = 1000, log = console.log) {
    let amount = await getBalanceFn();

    // Если в .env установлено WAIT_TOKEN_IN_WALLET=no, не ждём
    if (process.env.WAIT_TOKEN_IN_WALLET?.toLowerCase() === 'no') {
        if (amount === 0 || amount === '0' || amount === 0n || BigInt(amount) === 0n) {
            log('info', `Balance ${symbol} = 0. Skipping wallet...`, 'yellow');
            return null; // возвращаем null, чтобы выше можно было пропустить
        }
        return amount;
    }

    // Обычный режим — ждём появления токенов
    while (amount === 0 || amount === '0' || amount === 0n || BigInt(amount) === 0n) {
        log('info', `Balance ${symbol} = 0. Waiting for token...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        amount = await getBalanceFn();
    }

    return amount;
}

export const getMaxPriorGasPrice = async (rpcUrl) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_maxPriorityFeePerGas',
      params: []
    })
  });

  const data = await response.json();
  const wei = parseInt(data.result, 16);
  return (wei / 1e9).toFixed(9); // Gwei
};



// Сопоставление названий сетей с их chainId
const CHAIN_IDS = {
  ethereum: '1',
  linea: '59144',
  bsc: '56',
  polygon: '137',
  arbitrum: '42161',
  optimism: '10',
  avalanche: '43114',
  base: '8453',
  zkSync: '324',
  fantom: '250',
  // добавляй по мере необходимости
};

export async function getSwapQuote(
  networkName,            // строка: например, 'linea'
  slippage,               // строка: например, '0.5'
  amountInEther,          // число: например, 0.001
  userWalletAddress,      // строка: адрес пользователя
  tokenFrom,              // строка: адрес токена from
  tokenTo                 // строка: адрес токена to
) {
  const chainIndex = CHAIN_IDS[networkName.toLowerCase()];
  if (!chainIndex) {
    throw new Error(`Неизвестная сеть: ${networkName}`);
  }
                  
  const urlBase = 'https://web3.okx.com/api/v5/dex/aggregator/swap';
  const method = 'GET';
  const requestPath = '/api/v5/dex/aggregator/swap';

  const params = {
    chainIndex,
    amount: amountInEther.toString(),
    fromTokenAddress: tokenFrom,
    toTokenAddress: tokenTo,
    slippage,
    userWalletAddress,
  };

  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${urlBase}?${queryString}`;
  const timestamp = new Date().toISOString();
  console.log('fullUrl', fullUrl)
  const preHash = timestamp + method + requestPath + '?' + queryString;
  const signature = crypto
    .createHmac('sha256', process.env.OKX_SECRET_KEY)
    .update(preHash)
    .digest('base64');

  const headers = {
    'OK-ACCESS-KEY': process.env.OKX_API_KEY,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
    'OK-ACCESS-PROJECT': process.env.OKX_PROJECT_ID,
  };

  try {
    const response = await fetch(fullUrl, { method, headers });
    const data = await response.json();

    if (data && data.code === '0') {
      // console.log('Котировка свапа:', data.data[0]);
      return data.data[0];
    } else {
      console.error('Ошибка API:', data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка запроса:', error);
    return null;
  }
}

export async function getApproveTransaction(
  networkName,
  approveAmount,
  tokenContractAddress,
  userWalletAddress,
) {
  const chainIndex = CHAIN_IDS[networkName.toLowerCase()];
  if (!chainIndex) {
    throw new Error(`Неизвестная сеть: ${networkName}`);
  }

  const urlBase = 'https://web3.okx.com/api/v5/dex/aggregator/approve-transaction';
  const method = 'GET';
  const requestPath = '/api/v5/dex/aggregator/approve-transaction';

  const params = {
    chainIndex,
    tokenContractAddress,
    approveAmount: approveAmount,
      };
// console.log('chainIndex2', chainIndex)
// console.log('tokenContractAddress2', tokenContractAddress)
// console.log('approveAmount2', approveAmount)
// console.log('userWalletAddress2', userWalletAddress)

  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${urlBase}?${queryString}`;
  const timestamp = new Date().toISOString();

  // Формируем строку для подписи
  const preHash = timestamp + method + requestPath + '?' + queryString;
  const signature = crypto
    .createHmac('sha256', process.env.OKX_SECRET_KEY)
    .update(preHash)
    .digest('base64');

  const headers = {
    'OK-ACCESS-KEY': process.env.OKX_API_KEY,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
    'OK-ACCESS-PROJECT': process.env.OKX_PROJECT_ID, // если есть проект ID — раскомментируй
  };

  try {
    const response = await fetch(fullUrl, { method, headers });
    const data = await response.json();

    if (data && data.code === '0') {
      return data.data;
    } else {
      console.error('Ошибка API approve-transaction:', data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка запроса approve-transaction:', error);
    return null;
  }
}

