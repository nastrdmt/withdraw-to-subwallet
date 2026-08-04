import Web3 from 'web3';

let readCursor = 0;

export const uniqueRpcUrls = urls => {
    return [...new Set(
        urls.filter(url =>
            typeof url === 'string' &&
            url.trim().length > 0
        )
    )];
};

const getRpcHost = rpcUrl => {
    try {
        return new URL(rpcUrl).hostname;
    } catch {
        return 'unknown-rpc';
    }
};

const getErrorText = error => {
    return [
        error?.message,
        error?.data?.message,
        error?.response?.data?.message,
        error?.response?.data?.error?.message
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
};

export const isRetryableRpcError = error => {
    const text = getErrorText(error);

    const status = Number(
        error?.status ||
        error?.response?.status
    );

    const code = Number(
        error?.code ||
        error?.data?.code ||
        error?.response?.data?.error?.code
    );

    if (
        [408, 425, 429, 500, 502, 503, 504]
            .includes(status)
    ) {
        return true;
    }

    if (code === -32005) {
        return true;
    }

    return [
        'too many requests',
        'rate limit',
        'timeout',
        'timed out',
        'invalid json rpc response',
        'network error',
        'connection error',
        'connection not open',
        'socket hang up',
        'econnreset',
        'etimedout',
        'enotfound',
        'bad gateway',
        'service unavailable',
        'gateway timeout'
    ].some(value => text.includes(value));
};

const withTimeout = (promise, timeoutMs) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const error = new Error(
                `RPC timeout after ${timeoutMs} ms`
            );

            error.code = 'RPC_TIMEOUT';
            reject(error);
        }, timeoutMs);

        Promise.resolve(promise)
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
};

export const createRpcPool = rpcUrls => {
    const urls = uniqueRpcUrls(rpcUrls);

    if (urls.length === 0) {
        throw new Error('RPC pool is empty');
    }

    const run = async (
        action,
        {
            label = 'RPC request',
            rotate = true,
            timeoutMs = 15000
        } = {}
    ) => {
        const startIndex = rotate
            ? readCursor++ % urls.length
            : 0;

        let lastError;

        for (let attempt = 0; attempt < urls.length; attempt++) {
            const index =
                (startIndex + attempt) % urls.length;

            const rpcUrl = urls[index];

            try {
                return await withTimeout(
                    action(rpcUrl),
                    timeoutMs
                );
            } catch (error) {
                lastError = error;

                if (!isRetryableRpcError(error)) {
                    throw error;
                }

                const nextIndex =
                    (index + 1) % urls.length;

                console.log(
                    `[RPC] ${label}: ` +
                    `${getRpcHost(rpcUrl)} unavailable, ` +
                    `switching to ${getRpcHost(urls[nextIndex])}`
                );
            }
        }

        throw lastError;
    };

    return {
        urls,
        run
    };
};

const broadcastRawTransaction = (
    rpcUrl,
    rawTransaction,
    timeoutMs
) => {
    const web3 = new Web3(
        new Web3.providers.HttpProvider(rpcUrl)
    );

    return withTimeout(
        new Promise((resolve, reject) => {
            web3.eth
                .sendSignedTransaction(rawTransaction)
                .once('transactionHash', resolve)
                .once('error', reject);
        }),
        timeoutMs
    );
};

export const sendEVMTXWithFallback = async ({
    rpcUrls,
    typeTx,
    gasLimit,
    toAddress,
    value,
    data,
    privateKey,
    maxFeeOrGasPrice,
    maxPriorityFee,
    explorer = '',
    timeoutMs = 5000,
    preparedTransactionData = null
}) => {
    const urls = uniqueRpcUrls(rpcUrls);
    const pool = createRpcPool(urls);

    const transactionData =
    preparedTransactionData ||
    await pool.run(
        async rpcUrl => {
            const web3 = new Web3(
                new Web3.providers.HttpProvider(rpcUrl)
            );

            const fromAddress = web3.eth.accounts
                .privateKeyToAccount(privateKey)
                .address;

            const [chainId, nonce] = await Promise.all([
                web3.eth.getChainId(),
                web3.eth.getTransactionCount(
                    fromAddress,
                    'pending'
                )
            ]);

            return {
                chainId,
                nonce,
                fromAddress
            };
        },
        {
            label: 'chainId/nonce',
            rotate: false
        }
    );

    const web3 = new Web3();

    let transaction;

    if (typeTx === 0) {
        transaction = {
            from: transactionData.fromAddress,
            to: toAddress,
            value: value || '0x0',
            data,
            gas: gasLimit,
            nonce: transactionData.nonce,
            chainId: transactionData.chainId,
            gasPrice: web3.utils.toWei(
                maxFeeOrGasPrice.toString(),
                'gwei'
            )
        };
    } else if (typeTx === 2) {
        transaction = {
            from: transactionData.fromAddress,
            to: toAddress,
            value: value || '0x0',
            data,
            gas: gasLimit,
            nonce: transactionData.nonce,
            chainId: transactionData.chainId,
            maxFeePerGas: web3.utils.toWei(
                maxFeeOrGasPrice.toString(),
                'gwei'
            ),
            maxPriorityFeePerGas: web3.utils.toWei(
                maxPriorityFee.toString(),
                'gwei'
            )
        };
    } else {
        throw new Error(
            `Unsupported transaction type: ${typeTx}`
        );
    }

    const signed = await web3.eth.accounts
        .signTransaction(transaction, privateKey);

    const expectedHash = signed.transactionHash;
    let lastError;

    for (const rpcUrl of urls) {
        try {
            const hash = await broadcastRawTransaction(
                rpcUrl,
                signed.rawTransaction,
                timeoutMs
            );

            console.log(
                explorer
                    ? `TX: ${explorer}${hash}`
                    : `TX: ${hash}`
            );

            return hash;
        } catch (error) {
            lastError = error;

            const text = getErrorText(error);

            if (text.includes('already known')) {
                return expectedHash;
            }

            if (!isRetryableRpcError(error)) {
                throw error;
            }

            console.log(
                `[RPC] Broadcast failed through ` +
                `${getRpcHost(rpcUrl)}, trying next RPC`
            );
        }
    }

    // Первый RPC мог принять транзакцию,
    // но не успеть вернуть хеш до timeout.
    const foundTransaction = await pool.run(
        async rpcUrl => {
            const provider = new Web3(
                new Web3.providers.HttpProvider(rpcUrl)
            );

            return await provider.eth.getTransaction(
                expectedHash
            );
        },
        {
            label: 'transaction verification',
            rotate: false
        }
    ).catch(() => null);

    if (foundTransaction) {
        return expectedHash;
    }

    throw lastError;
};