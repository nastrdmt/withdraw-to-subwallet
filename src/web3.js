import Web3 from 'web3';
import { info, privateToAddress, log, timeout } from './other.js';
import { abiToken } from './abi.js';
import { ethers } from "ethers";

export const waitTokenFast = async(wssRpc, rpc, addressToken, address) => {
    return new Promise((resolve, reject) => {
        let finished = false;

        const finish = async(source) => {
            if (finished) return;
            finished = true;

            try {
                const amountToken = await getAmountToken(rpc, addressToken, address);

                if (BigInt(amountToken.toString()) > 0n) {
                    log('info', `Token detected by ${source}`, 'green');

                    try {
                        await sub.unsubscribe();
                        web3.currentProvider.disconnect();
                    } catch {}

                    resolve(amountToken);
                } else {
                    finished = false;
                }
            } catch (e) {
                finished = false;
            }
        };

        const web3 = new Web3(new Web3.providers.WebsocketProvider(wssRpc));
        const token = new web3.eth.Contract(abiToken, addressToken);

        // Слушаем все Transfer токена, фильтруем вручную.
        // Так надежнее, чем filter: { to: address }
        const sub = token.events.Transfer({});

        sub.on("connected", (id) => {
            log('info', `WSS Transfer subscribed: ${id}`, 'green');
        });

        sub.on("data", async(event) => {
            const to = event?.returnValues?.to?.toLowerCase();

            if (to !== address.toLowerCase()) return;

            const value = event?.returnValues?.value;

            if (!value || BigInt(value.toString()) === 0n) return;

            log('info', `WSS Transfer event fired`, 'green');
            log('info', `Token detected by Transfer event`, 'green');

            finished = true;

            try {
                await sub.unsubscribe();
                web3.currentProvider.disconnect();
            } catch {}

            resolve(value.toString());
        });

        sub.on("error", async(e) => {
            log('info', `WSS error. Backup polling still active`, 'yellow');
        });

        const polling = async() => {
            while (!finished) {
                await timeout(500);

                if (finished) break;

                await finish('backup polling');
            }
        };

        polling();
    });
};

export const getDataTx = async(rpc, abi, addressContract, nameFunc, property, amountTx, addressFrom) => {
    const w3 = getProvider(rpc);
    const contract = new w3.eth.Contract(abi, addressContract);

    const data = contract.methods[nameFunc](...property);
    const encodeABI = data.encodeABI();

    let estimateGas;
    try {
        estimateGas = await data.estimateGas({ from: addressFrom, value: amountTx });
        ;
    } catch (e) {
        console.log('[getDataTx] estimateGas ERROR =', e?.message || e);
        throw e;
    }

    return { encodeABI, estimateGas, addressContract, amountTx };
}

export const getGasPrice = async(rpcProvider) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpcProvider));
    const gasPrice = await w3.eth.getGasPrice();
    const gasPriceInGwei = w3.utils.fromWei(gasPrice, 'Gwei');

    return gasPriceInGwei;
}

export const getEstimateGas = async (rpc, tokenAddress, amount, from, to) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));

    try {
        // Если tokenAddress === '0x', значит это нативная монета (ETH, MATIC и т.д.)
        if (tokenAddress.toLowerCase() === '0x' || tokenAddress === '0x0000000000000000000000000000000000000000') {
            const gas = await w3.eth.estimateGas({
                from: from,
                to: to,
                value: w3.utils.toHex(amount),
                data: '0x'
            });
            return gas;
        } else {
            // Это ERC-20 токен — подготавливаем вызов transfer(to, amount)
            const token = new w3.eth.Contract(abiToken, tokenAddress);
            const data = token.methods.transfer(to, amount).encodeABI();

            const gas = await w3.eth.estimateGas({
                from: from,
                to: tokenAddress,
                value: '0x0',
                data: data
            });
            return gas;
        }
    } catch (err) {
        console.error('❌ Ошибка при getEstimateGas:', err.message);
        return undefined;
    }
};
export const getPriorityGasPrice = async(rpc) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const latestBlock = await w3.eth.getBlock('latest', true);

    for (let i = latestBlock.transactions.length - 1; i >= 0; i--) {
        const transaction = latestBlock.transactions[i];

        if (transaction.maxFeePerGas) {
            return transaction.maxFeePerGas;
        }
    }
}

export const getAmountToken = async(rpc, tokenAddress, walletAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const token = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await token.methods.balanceOf(
        walletAddress
    ).call();

    return data;
}

export const getETHAmount = async(rpc, walletAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const data = await w3.eth.getBalance(walletAddress);
    return data;
}

export const toWei = (amount, type) => {
    const w3 = new Web3();
    return w3.utils.toWei(amount, type);
}

export const fromWei = (amount, type) => {
    const w3 = new Web3();
    return w3.utils.fromWei(amount, type);
}

export const numberToHex = (number) => {
    const w3 = new Web3();
    return w3.utils.numberToHex(number);
}

export const getTransferData = (toAddress, amount) => {
    const signature = '0xa9059cbb';  // Взять первые 4 байта (8 символов) хеша функции transfer
    const recipientBytes = Web3.utils.padLeft(toAddress, 64);  // Преобразовать адрес получателя в 32-байтовый шестнадцатеричный формат
    const amountHex = Web3.utils.padLeft(Web3.utils.toHex(amount), 64); // Преобразовать количество токенов в 32-байтовый шестнадцатеричный формат
    const data = signature + recipientBytes.replace('0x', '') + amountHex.replace('0x', ''); // Склеить сигнатуру функции и параметры вместе, чтобы получить данные вызова
    
    return  data; // Возвращаем данные вызова с префиксом '0x'
}

export const getEstimatedGasLimit = async (rpc, from, to, data, value) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));

    try {
        const gasLimit = await w3.eth.estimateGas({
            from,
            to,
            data,
            value: value.toString()
        });

        return gasLimit;
    } catch (err) {
        console.error('Ошибка в estimateGas:', err);
        throw err;
    }
};

export const sendEVMTX = async(rpc, typeTx, gasLimit, toAddress, value, data, privateKey, maxFeeOrGasPrice, maxPriorityFee) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const fromAddress = privateToAddress(privateKey);

    const chainId = await w3.eth.getChainId();
    const nonce = await w3.eth.getTransactionCount(fromAddress, 'pending');

    let tx;

    if (typeTx == 0) {
        tx = {
            from: fromAddress,
            gas: gasLimit,
            gasPrice: w3.utils.toWei(maxFeeOrGasPrice.toString(), 'Gwei'),
            chainId,
            to: toAddress,
            nonce,
            value: value || '0x0',
            data
        };
    } else if (typeTx == 2) {
        tx = {
            from: fromAddress,
            gas: gasLimit,
            maxFeePerGas: w3.utils.toWei(maxFeeOrGasPrice.toString(), 'Gwei'),
            maxPriorityFeePerGas: w3.utils.toWei(maxPriorityFee.toString(), 'Gwei'),
            chainId,
            to: toAddress,
            nonce,
            value: value || '0x0',
            data
        };
    } else {
        throw new Error(`Unsupported tx type: ${typeTx}`);
    }

    const tSign = Date.now();
    const signedTx = await w3.eth.accounts.signTransaction(tx, privateKey);
    // console.log(`[TIME] SIGN TX: ${Date.now() - tSign} ms`);

    const key = Object.keys(info).find(k => info[k] === rpc);
    const chain = key ? key.slice(3) : '';
    const explorer = info['explorer' + chain] || '';

    return new Promise((resolve, reject) => {
        const tBroadcast = Date.now();

        w3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .once('transactionHash', (hash) => {
                if (explorer) {
                    console.log(`${chain} TX: ${explorer + hash}`);
                } else {
                    console.log(`TX: ${hash}`);
                }

                // console.log(`[TIME] BROADCAST HASH: ${Date.now() - tBroadcast} ms`);

                resolve(hash);
            })
            .once('receipt', (receipt) => {
                // console.log(`[TIME] RECEIPT: ${Date.now() - tBroadcast} ms`);
            })
            .once('error', (error) => {
                console.log(`Error Tx: ${error}`);
                reject(error);
            });
    });
};

export const checkAllowance = async(rpc, tokenAddress, walletAddress, spender) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const token = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await token.methods.allowance(
        walletAddress,
        spender
    ).call();

    return data;
}

export const getProvider = (rpc) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    return w3;
}

export const dataApprove = async(rpc, tokenAddress, contractAddress, amountApprove, fromAddress) => {
    const w3 = getProvider(rpc);
    const contract = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = contract.methods.approve(
        contractAddress,
        numberToHex(amountApprove),
    );
    const encodeABI = data.encodeABI();
    const estimateGas = await data.estimateGas({ from: fromAddress });

    return { encodeABI, estimateGas };
}

export const getDataCall = async(rpc, abi, addressContract, nameFunc, property) => {
    const w3 = getProvider(rpc);
    const contract = new w3.eth.Contract(abi, addressContract);

    const data = await contract.methods[nameFunc](...property).call();

    return data;
}

export const rawCall = async (rpc, to, data, from = null, value = null) => {
    const w3 = getProvider(rpc);

    const tx = {
        to,
        data
    };

    if (from !== null) tx.from = from;
    if (value !== null) tx.value = value;

    return await w3.eth.call(tx);
};

export const stringToHex = (string) => {
    const w3 = new Web3();
    return w3.utils.stringToHex(string);
}

export const encodeParams = (types, params) => {
    const w3 = new Web3();
    return w3.eth.abi.encodeParameters(types, params);
}

export const decodeParams = (types, data) => {
    const w3 = new Web3();
    return w3.eth.abi.decodeParameters(types, data);
}

export const signPermit2Single = async ({
  chainId,
  permit2,
  token,
  owner,         // address
  spender,       // router address
  amount,        // uint160-like (влезает в uint160)
  nonce,         // uint48-like
  expiration,    // uint48 unix timestamp
  sigDeadline,   // uint256 unix timestamp
  privateKey
}) => {
  const wallet = new ethers.Wallet(privateKey);

  const domain = {
    name: 'Permit2',
    chainId: Number(chainId),
    verifyingContract: permit2
  };

  const types = {
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' }
    ],
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' }
    ]
  };

  const message = {
    details: { token, amount, expiration, nonce },
    spender,
    sigDeadline
  };

  // ethers v5
  const signature = await wallet._signTypedData(domain, types, message);
  return signature;
};

export const buildPermit2PermitInput = ({
  token,
  amount,
  expiration,
  nonce,
  spender,
  sigDeadline,
  signature
}) => {
  const permitSingle = [
    [token, amount, expiration, nonce], // details
    spender,
    sigDeadline
  ];

  return encodeParams(
    [
      'tuple(tuple(address,uint160,uint48,uint48),address,uint256)',
      'bytes'
    ],
    [
      permitSingle,
      signature
    ]
  );
};

export const getDecimal = async(rpc, tokenAddress) => {
    const w3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const token = new w3.eth.Contract(abiToken, w3.utils.toChecksumAddress(tokenAddress));

    const data = await token.methods.decimals().call();

    return data;
}