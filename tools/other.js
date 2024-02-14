import Web3 from 'web3';
import fs from 'fs';
import consoleStamp from 'console-stamp';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { fromWei, getETHAmount, getEstimateGas, getGasPrice, getPriorityGasPrice, numberToHex, sendEVMTX, toWei} from './web3.js';
dotenv.config();

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

export const info = {
    rpcEthereum: 'https://eth.llamarpc.com',
    rpcArbitrum: 'https://rpc.ankr.com/arbitrum',
    rpcOptimism: 'https://1rpc.io/op',
    rpcPolygon: 'https://polygon.llamarpc.com',
    rpcAvalanche: 'https://rpc.ankr.com/avalanche',
    rpcBSC: 'https://bsc.publicnode.com',
    rpcFantom: 'https://1rpc.io/ftm',
    rpcCore: 'https://rpc.coredao.org',
    rpcHarmony: 'https://rpc.ankr.com/harmony',
    rpczkSync: 'https://zksync.drpc.org',
    rpcLinea: `https://linea-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    rpcSepolia: `https://ethereum-sepolia.publicnode.com`,
    rpcManta: 'https://pacific-rpc.manta.network/http',
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
    // explorerStarknet: 'https://voyager.online/tx/',
    // Starknet: {
    //     ETH: '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    //     ETHAbi: '0x48624e084dc68d82076582219c7ed8cb0910c01746cca3cd72a28ecfe07e42d',
    // },
    
    random: generateRandomAmount(process.env.PERCENT_TRANSFER_MIN / 100, process.env.PERCENT_TRANSFER_MAX / 100, 3),
    argentVersion: process.env.ARGENT_CREATE_VERSION,
}

export const getTrueAmount = async(rpc, address, type) => {
    const amount = info.typeValue == 'procent'
        ? toWei(parseFloat(fromWei(numberToHex(multiply(await getETHAmount(rpc, address),
            generateRandomAmount(process.env['Value_' + type + '_Min'], process.env['Value_' + type + '_Max'], 0) / 100)), 'ether')).toFixed(4), 'ether')
        : toWei(generateRandomAmount(process.env['Value_' + type + '_Min'], process.env['Value_' + type + '_Max'], 5).toString(), 'ether');

    return amount;
}

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