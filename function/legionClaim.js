import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import Web3 from 'web3';
import { ethers } from 'ethers';

import { info } from '../src/other.js';
import { createRpcPool, uniqueRpcUrls } from '../src/rpcPool.js';
import {
    legionClaimErc20Abi,
    legionTokenDistributorAbi
} from '../src/abi.js';
import { applyLegionLock } from '../src/legionLock.js';

const API_ORIGIN = 'https://api.legion.cc';
const APP_ORIGIN = 'https://app.legion.cc';
const CLAIM_SELECTOR = '0x57e72d9f';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const UINT64_MAX = '18446744073709551615';
const UINT256_MAX =
    '115792089237316195423570985008687907853269984665640564039457584007913129639935';

export class WaitForClaimError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WaitForClaimError';
    }
}

export class LegionHttpError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'LegionHttpError';
        this.status = status;
    }
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const accountLog = (accountId, message) => {
    console.log(`[Legion ${accountId}] ${message}`);
};

const normalizeDecimal = value => {
    const normalized = String(value ?? '').replace(/^0+(?=\d)/, '');
    return normalized || '0';
};

const compareDecimalStrings = (left, right) => {
    const a = normalizeDecimal(left);
    const b = normalizeDecimal(right);

    if (a.length !== b.length) {
        return a.length > b.length ? 1 : -1;
    }

    if (a === b) return 0;
    return a > b ? 1 : -1;
};

const multiplyDecimalStrings = (left, right) => {
    const a = normalizeDecimal(left);
    const b = normalizeDecimal(right);

    if (a === '0' || b === '0') return '0';

    const result = new Array(a.length + b.length).fill(0);

    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            const position = i + j + 1;
            const product = Number(a[i]) * Number(b[j]) + result[position];

            result[position] = product % 10;
            result[position - 1] += Math.floor(product / 10);
        }
    }

    return result.join('').replace(/^0+/, '') || '0';
};

const isIntegerString = value =>
    typeof value === 'string' && /^[0-9]+$/.test(value);

const assertIntegerRange = (value, maximum, label) => {
    const text = String(value ?? '');

    if (
        !isIntegerString(text) ||
        compareDecimalStrings(text, maximum) > 0
    ) {
        throw new Error(`${label} is outside the supported integer range`);
    }

    return normalizeDecimal(text);
};

export const sameAddress = (left, right) =>
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.toLowerCase() === right.toLowerCase();

const requireAddress = (value, label) => {
    if (!Web3.utils.isAddress(value || '')) {
        throw new Error(`${label} is not a valid EVM address`);
    }

    return Web3.utils.toChecksumAddress(value);
};

const requirePinnedAddress = (value, label) => {
    if (!value) {
        throw new Error(`${label} is not pinned in the config`);
    }

    return requireAddress(value, label);
};

const getTuple = value => {
    if (value && typeof value[0] === 'object') return value[0];
    return value;
};

const getBoolean = value => value === true || value === 'true';

const readLines = filePath =>
    fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

const resolveFromConfig = (configDir, filePath) =>
    path.isAbsolute(filePath)
        ? filePath
        : path.resolve(configDir, filePath);

export const loadPrivateKey = (account, configDir) => {
    let privateKey;

    if (account.privateKeyEnv) {
        privateKey = process.env[account.privateKeyEnv];
    } else if (account.walletFile) {
        const walletPath = resolveFromConfig(configDir, account.walletFile);
        const wallets = readLines(walletPath);
        const walletIndex = Number(account.walletIndex);

        if (!Number.isInteger(walletIndex) || walletIndex < 0) {
            throw new Error(`${account.id}: walletIndex must be a zero-based integer`);
        }

        privateKey = wallets[walletIndex];
    }

    if (!privateKey) {
        throw new Error(`${account.id}: private key source is empty`);
    }

    const normalized = privateKey.startsWith('0x')
        ? privateKey
        : `0x${privateKey}`;

    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
        throw new Error(`${account.id}: invalid private key format`);
    }

    return normalized;
};

const readSecretSource = ({ envName, filePath, configDir, label }) => {
    let value;

    if (envName) {
        value = process.env[envName];
    } else if (filePath) {
        value = fs.readFileSync(
            resolveFromConfig(configDir, filePath),
            'utf8'
        );
    }

    value = String(value ?? '').trim();

    if (!value) {
        throw new Error(`${label} is missing`);
    }

    if (/[\r\n]/.test(value)) {
        throw new Error(`${label} contains an unsafe newline`);
    }

    return value;
};

const makeNamedCookie = (secret, cookieName) => {
    const parts = secret.split(';').map(value => value.trim());
    const named = parts.find(value =>
        value.toLowerCase().startsWith(`${cookieName.toLowerCase()}=`)
    );

    if (named) return named;
    return `${cookieName}=${secret}`;
};

export const loadAccountSecrets = (account, configDir) => {
    const apiSecret = readSecretSource({
        envName: account.apiCookieEnv,
        filePath: account.apiCookieFile,
        configDir,
        label: `${account.id}: DYNAMIC_JWT_TOKEN`
    });

    const appSecret = readSecretSource({
        envName: account.appCookieEnv,
        filePath: account.appCookieFile,
        configDir,
        label: `${account.id}: session`
    });

    return {
        apiCookie: makeNamedCookie(apiSecret, 'DYNAMIC_JWT_TOKEN'),
        appCookie: makeNamedCookie(appSecret, 'session')
    };
};

const safeResponseMessage = body => {
    if (!body || typeof body !== 'object') return 'request failed';

    const message = body.message || body.error || body.detail;
    return typeof message === 'string'
        ? message.slice(0, 200)
        : 'request failed';
};

export const getJson = async ({ url, cookie, timeoutMs }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                accept: 'application/json',
                cookie,
                origin: APP_ORIGIN,
                referer: `${APP_ORIGIN}/`
            }
        });

        if (response.status >= 300 && response.status < 400) {
            throw new LegionHttpError(
                `${new URL(url).host} returned an unexpected redirect`,
                response.status
            );
        }

        const contentType = response.headers.get('content-type') || '';

        if (!contentType.toLowerCase().includes('application/json')) {
            throw new LegionHttpError(
                `${new URL(url).host} returned HTTP ${response.status}, not JSON`,
                response.status
            );
        }

        const body = await response.json();

        if (!response.ok) {
            throw new LegionHttpError(
                `${new URL(url).host} HTTP ${response.status}: ${safeResponseMessage(body)}`,
                response.status
            );
        }

        return body;
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new WaitForClaimError(
                `${new URL(url).host} request timed out`
            );
        }

        if (error instanceof LegionHttpError) {
            throw error;
        }

        if (error?.name === 'FetchError') {
            throw new WaitForClaimError(
                `${new URL(url).host} is temporarily unavailable`
            );
        }

        throw error;
    } finally {
        clearTimeout(timer);
    }
};

const getSignaturesState = async ({ slug, secrets, timeoutMs }) => {
    try {
        return await getJson({
            url: `${APP_ORIGIN}/api/distributions/signatures?slug=${encodeURIComponent(slug)}`,
            cookie: secrets.appCookie,
            timeoutMs
        });
    } catch (error) {
        if (error instanceof LegionHttpError && error.status === 401) {
            throw error;
        }

        if (
            error instanceof WaitForClaimError ||
            error instanceof LegionHttpError && [
                400,
                404,
                408,
                409,
                422,
                425,
                429
            ].includes(error.status) ||
            error instanceof LegionHttpError && error.status >= 500
        ) {
            return { unavailableError: error.message };
        }

        throw error;
    }
};

export const getAccountApiState = async ({
    config,
    account,
    secrets,
    includeSignatures = true
}) => {
    const requestTimeoutMs = Number(config.requestTimeoutMs || 6000);

    const distributions = await getJson({
        url: `${API_ORIGIN}/distributions`,
        cookie: secrets.apiCookie,
        timeoutMs: requestTimeoutMs
    });

    if (!Array.isArray(distributions)) {
        throw new Error('Legion /distributions response is not an array');
    }

    const slug = String(config.distributionSlug || '').toLowerCase();

    if (!slug) {
        throw new Error('distributionSlug is empty in the config');
    }

    const listItem = distributions.find(item =>
        String(item?.slug || '').toLowerCase() === slug
    );

    if (!listItem) {
        throw new WaitForClaimError(
            `distribution "${config.distributionSlug}" is not published for this account`
        );
    }

    const distributionPromise = getJson({
        url: `${API_ORIGIN}/distributions/${encodeURIComponent(listItem.slug)}`,
        cookie: secrets.apiCookie,
        timeoutMs: requestTimeoutMs
    });
    const signaturesPromise = includeSignatures
        ? getSignaturesState({
            slug: listItem.slug,
            secrets,
            timeoutMs: requestTimeoutMs
        })
        : Promise.resolve(null);
    const [distribution, signatures] = await Promise.all([
        distributionPromise,
        signaturesPromise
    ]);

    return { listItem, distribution, signatures };
};

const validateHex = (value, bytes, label) => {
    const expression = new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`);

    if (!expression.test(value || '')) {
        throw new WaitForClaimError(`${label} is not available or invalid`);
    }
};

export const validateAndBuildDistribution = ({
    config,
    account,
    walletAddress,
    listItem,
    distribution,
    requirePins
}) => {
    if (distribution?.distributionType !== 'CLAIM') {
        throw new Error(
            `Unexpected distributionType: ${distribution?.distributionType}`
        );
    }

    if (distribution?.chain?.type !== 'EVM') {
        throw new Error(`Unexpected chain type: ${distribution?.chain?.type}`);
    }

    const chainId = String(distribution?.chain?.id || '');
    const chainConfig = config.chains?.[chainId];

    if (!chainConfig) {
        throw new Error(`Chain ${chainId} is not explicitly allowed in the config`);
    }

    const recipient = distribution?.recipient || {};
    const recipientAddress = requireAddress(
        recipient.walletAddress,
        'distribution recipient'
    );

    if (!sameAddress(recipientAddress, walletAddress)) {
        throw new Error('Private key address does not match distribution recipient');
    }

    if (account.expectedWalletAddress) {
        const expectedWallet = requireAddress(
            account.expectedWalletAddress,
            `${account.id}: expectedWalletAddress`
        );

        if (!sameAddress(expectedWallet, walletAddress)) {
            throw new Error(`${account.id}: pinned wallet does not match private key`);
        }
    } else if (requirePins) {
        throw new Error(`${account.id}: expectedWalletAddress is not pinned`);
    }

    const distributorAddress = requireAddress(
        distribution?.contract?.address,
        'distribution contract'
    );

    const tokenAddress = requireAddress(
        distribution?.token?.address,
        'distribution token'
    );
    const tokenDecimals = Number(distribution?.token?.decimals);
    const tokenSymbol = String(distribution?.token?.symbol || '');

    if (
        !Number.isInteger(tokenDecimals) ||
        tokenDecimals < 0 ||
        tokenDecimals > 255
    ) {
        throw new Error('distribution token decimals are invalid');
    }

    if (!tokenSymbol) {
        throw new Error('distribution token symbol is missing');
    }

    if (requirePins) {
        const expectedChainId = String(config.expected?.chainId || '');
        const expectedDistributor = requirePinnedAddress(
            config.expected?.distributorAddress,
            'expected.distributorAddress'
        );
        const expectedToken = requirePinnedAddress(
            config.expected?.tokenAddress,
            'expected.tokenAddress'
        );

        if (chainId !== expectedChainId) {
            throw new Error(`Chain changed: expected ${expectedChainId}, got ${chainId}`);
        }

        if (!sameAddress(distributorAddress, expectedDistributor)) {
            throw new Error('Distributor address differs from the pinned address');
        }

        if (!sameAddress(tokenAddress, expectedToken)) {
            throw new Error('Token address differs from the pinned address');
        }

        if (
            config.expected?.tokenDecimals !== undefined &&
            Number(config.expected.tokenDecimals) !== tokenDecimals
        ) {
            throw new Error('Token decimals differ from the pinned value');
        }

        if (
            config.expected?.tokenSymbol &&
            String(config.expected.tokenSymbol) !== tokenSymbol
        ) {
            throw new Error('Token symbol differs from the pinned value');
        }
    }

    const claimAmount = assertIntegerRange(
        String(recipient.claimAmount ?? ''),
        UINT256_MAX,
        'recipient.claimAmount'
    );

    if (claimAmount === '0') {
        throw new Error('recipient.claimAmount is zero');
    }

    if (requirePins) {
        const expectedClaimAmount = String(account.expectedClaimAmount || '');

        if (!isIntegerString(expectedClaimAmount)) {
            throw new Error(`${account.id}: expectedClaimAmount is not pinned`);
        }

        if (normalizeDecimal(expectedClaimAmount) !== claimAmount) {
            throw new Error(`${account.id}: claim amount differs from the pinned amount`);
        }
    }

    const vestingTypeName = String(recipient.vestingType ?? '');
    const mappedVestingType = config.vestingTypes?.[vestingTypeName];

    if (!Number.isInteger(mappedVestingType) || mappedVestingType < 0) {
        throw new Error(`Unsupported vestingType: ${vestingTypeName}`);
    }

    const vesting = [
        assertIntegerRange(
            String(recipient.vestingStartTime ?? ''),
            UINT64_MAX,
            'vestingStartTime'
        ),
        assertIntegerRange(
            String(recipient.vestingDurationSeconds ?? ''),
            UINT64_MAX,
            'vestingDurationSeconds'
        ),
        assertIntegerRange(
            String(recipient.vestingCliffDurationSeconds ?? ''),
            UINT64_MAX,
            'vestingCliffDurationSeconds'
        ),
        assertIntegerRange(
            String(mappedVestingType),
            '255',
            'vestingType'
        ),
        assertIntegerRange(
            String(recipient.epochDurationSeconds ?? ''),
            UINT64_MAX,
            'epochDurationSeconds'
        ),
        assertIntegerRange(
            String(recipient.numberOfEpochs ?? ''),
            UINT64_MAX,
            'numberOfEpochs'
        ),
        assertIntegerRange(
            String(recipient.tokenAllocationOnTGERate ?? ''),
            UINT64_MAX,
            'tokenAllocationOnTGERate'
        )
    ];

    if (requirePins && account.expectedVesting !== undefined) {
        if (
            !Array.isArray(account.expectedVesting) ||
            account.expectedVesting.map(String).join(',') !== vesting.join(',')
        ) {
            throw new Error(`${account.id}: vesting differs from the locked value`);
        }
    }

    const claimStartMs = Date.parse(distribution?.claimStartTime);

    if (!Number.isFinite(claimStartMs)) {
        throw new Error('claimStartTime is missing or invalid');
    }

    if (
        requirePins &&
        config.expected?.claimStartTime &&
        distribution.claimStartTime !== config.expected.claimStartTime
    ) {
        throw new Error('claimStartTime differs from the locked value');
    }

    if (listItem?.tgeClaimed === true) {
        throw new Error('Legion API reports that this allocation is already claimed');
    }

    return {
        chainId,
        chainConfig,
        distributorAddress,
        tokenAddress,
        tokenSymbol,
        tokenDecimals,
        recipientAddress,
        claimAmount,
        vesting,
        claimStartMs,
        claimStartTime: distribution.claimStartTime
    };
};

export const resolveRpcUrls = chainConfig => {
    const fromInfo = (chainConfig.rpcInfoKeys || [])
        .map(key => info[key]);
    const fromEnv = (chainConfig.rpcEnvNames || [])
        .map(name => process.env[name]);

    const urls = uniqueRpcUrls([
        ...(chainConfig.rpcUrls || []),
        ...fromInfo,
        ...fromEnv
    ]);

    if (urls.length === 0) {
        throw new Error('No RPC URLs are configured for the distribution chain');
    }

    return urls;
};

export const makeProvider = rpcUrl =>
    new Web3(new Web3.providers.HttpProvider(rpcUrl));

export const readOnChainState = async ({ rpcPool, claim }) => {
    const chainId = await rpcPool.run(
        async rpcUrl => String(await makeProvider(rpcUrl).eth.getChainId()),
        { label: 'Legion chain ID', rotate: false }
    );

    if (chainId !== claim.chainId) {
        throw new Error(`RPC chain ID ${chainId} does not match ${claim.chainId}`);
    }

    const [
        code,
        distributorConfigRaw,
        investorPositionRaw,
        tokenBalance,
        paused
    ] =
        await Promise.all([
            rpcPool.run(
                async rpcUrl =>
                    await makeProvider(rpcUrl).eth.getCode(claim.distributorAddress),
                { label: 'Legion distributor bytecode' }
            ),
            rpcPool.run(
                async rpcUrl => {
                    const web3 = makeProvider(rpcUrl);
                    const contract = new web3.eth.Contract(
                        legionTokenDistributorAbi,
                        claim.distributorAddress
                    );

                    return await contract.methods
                        .distributorConfiguration()
                        .call();
                },
                { label: 'Legion distributor config' }
            ),
            rpcPool.run(
                async rpcUrl => {
                    const web3 = makeProvider(rpcUrl);
                    const contract = new web3.eth.Contract(
                        legionTokenDistributorAbi,
                        claim.distributorAddress
                    );

                    return await contract.methods
                        .investorPosition(claim.recipientAddress)
                        .call();
                },
                { label: 'Legion investor position' }
            ),
            rpcPool.run(
                async rpcUrl => {
                    const web3 = makeProvider(rpcUrl);
                    const token = new web3.eth.Contract(
                        legionClaimErc20Abi,
                        claim.tokenAddress
                    );

                    return await token.methods
                        .balanceOf(claim.distributorAddress)
                        .call();
                },
                { label: 'Legion distributor token balance' }
            ),
            rpcPool.run(
                async rpcUrl => {
                    const web3 = makeProvider(rpcUrl);
                    const contract = new web3.eth.Contract(
                        legionTokenDistributorAbi,
                        claim.distributorAddress
                    );

                    return await contract.methods.paused().call();
                },
                { label: 'Legion paused state' }
            ).catch(() => null)
        ]);

    if (!code || code === '0x') {
        throw new Error('Distributor has no bytecode');
    }

    const distributorConfig = getTuple(distributorConfigRaw);
    const investorPosition = getTuple(investorPositionRaw);

    if (!getBoolean(distributorConfig?.tokensSupplied)) {
        throw new WaitForClaimError('Distributor tokens are not supplied yet');
    }

    if (!sameAddress(distributorConfig?.askToken, claim.tokenAddress)) {
        throw new Error('On-chain distributor token does not match Legion API');
    }

    const legionSigner = requireAddress(
        distributorConfig?.legionSigner,
        'on-chain legionSigner'
    );

    if (sameAddress(legionSigner, ZERO_ADDRESS)) {
        throw new Error('On-chain legionSigner is the zero address');
    }

    if (getBoolean(investorPosition?.hasSettled)) {
        throw new Error('Investor position is already settled');
    }

    if (compareDecimalStrings(tokenBalance, claim.claimAmount) < 0) {
        throw new WaitForClaimError(
            'Distributor token balance is lower than this claim amount'
        );
    }

    if (getBoolean(paused)) {
        throw new WaitForClaimError('Distributor is paused');
    }

    return {
        chainId,
        code,
        tokensSupplied: true,
        askToken: requireAddress(distributorConfig.askToken, 'askToken'),
        legionSigner,
        hasSettled: false,
        vestingAddress: investorPosition?.vestingAddress || ZERO_ADDRESS,
        tokenBalance: String(tokenBalance),
        paused
    };
};

const validateSignatures = (signatures, legionSigner) => {
    if (signatures?.unavailableError) {
        throw new WaitForClaimError(
            `signatures are not ready: ${signatures.unavailableError}`
        );
    }

    validateHex(signatures?.claimMessage, 32, 'claimMessage');
    validateHex(signatures?.vestingMessage, 32, 'vestingMessage');
    validateHex(signatures?.claimSignature, 65, 'claimSignature');
    validateHex(signatures?.vestingSignature, 65, 'vestingSignature');

    let claimSigner;
    let vestingSigner;

    try {
        claimSigner = ethers.utils.verifyMessage(
            ethers.utils.arrayify(signatures.claimMessage),
            signatures.claimSignature
        );
        vestingSigner = ethers.utils.verifyMessage(
            ethers.utils.arrayify(signatures.vestingMessage),
            signatures.vestingSignature
        );
    } catch {
        throw new Error('Failed to recover Legion signature signer');
    }

    if (!sameAddress(claimSigner, vestingSigner)) {
        throw new Error('Claim and vesting signatures have different signers');
    }

    if (!sameAddress(claimSigner, legionSigner)) {
        throw new Error('Signature signer does not match on-chain legionSigner');
    }

    return requireAddress(claimSigner, 'recovered signer');
};

export const buildLegionClaimCalldata = ({ claim, signatures }) => {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(legionTokenDistributorAbi);
    const data = contract.methods
        .claimTokenAllocation(
            claim.claimAmount,
            claim.vesting,
            signatures.claimSignature,
            signatures.vestingSignature
        )
        .encodeABI();

    if (data.slice(0, 10).toLowerCase() !== CLAIM_SELECTOR) {
        throw new Error(
            `Unexpected Legion claim selector: ${data.slice(0, 10)}`
        );
    }

    return data;
};

const simulateClaim = async ({ rpcPool, claim, data }) => {
    const transaction = {
        from: claim.recipientAddress,
        to: claim.distributorAddress,
        data,
        value: '0x0'
    };

    const [callResult, estimateGas, nativeBalance] = await Promise.all([
        rpcPool.run(
            async rpcUrl =>
                await makeProvider(rpcUrl).eth.call(transaction, 'latest'),
            { label: 'Legion claim simulation', rotate: false }
        ),
        rpcPool.run(
            async rpcUrl =>
                await makeProvider(rpcUrl).eth.estimateGas(transaction),
            { label: 'Legion claim gas estimate' }
        ),
        rpcPool.run(
            async rpcUrl =>
                await makeProvider(rpcUrl).eth.getBalance(claim.recipientAddress),
            { label: 'Legion native balance' }
        )
    ]);

    if (callResult !== '0x' && callResult !== null) {
        throw new Error(`Unexpected eth_call result: ${String(callResult).slice(0, 18)}`);
    }

    return {
        estimateGas: String(estimateGas),
        nativeBalance: String(nativeBalance)
    };
};

const getFeeData = async ({ rpcPool, txType, multiplier }) => {
    const numericMultiplier = Number(multiplier || 1.15);

    if (!Number.isFinite(numericMultiplier) || numericMultiplier < 1) {
        throw new Error('gasPriceMultiplier must be at least 1');
    }

    if (Number(txType) === 0) {
        const gasPrice = await rpcPool.run(
            async rpcUrl => await makeProvider(rpcUrl).eth.getGasPrice(),
            { label: 'Legion gas price' }
        );

        return {
            gasPrice: String(Math.ceil(Number(gasPrice) * numericMultiplier))
        };
    }

    if (Number(txType) !== 2) {
        throw new Error(`Unsupported transaction type: ${txType}`);
    }

    const [block, gasPrice] = await Promise.all([
        rpcPool.run(
            async rpcUrl => await makeProvider(rpcUrl).eth.getBlock('pending'),
            { label: 'Legion pending block' }
        ),
        rpcPool.run(
            async rpcUrl => await makeProvider(rpcUrl).eth.getGasPrice(),
            { label: 'Legion gas price' }
        )
    ]);

    const baseFee = Number(block?.baseFeePerGas || 0);
    const suggestedGasPrice = Number(gasPrice);
    const priority = Math.max(suggestedGasPrice - baseFee, 1);
    const maxPriorityFeePerGas = Math.ceil(priority * numericMultiplier);
    const maxFeePerGas = Math.ceil(
        baseFee * 2 * numericMultiplier + maxPriorityFeePerGas
    );

    if (
        !Number.isSafeInteger(maxPriorityFeePerGas) ||
        !Number.isSafeInteger(maxFeePerGas)
    ) {
        throw new Error('RPC returned unsafe EIP-1559 fee values');
    }

    return {
        maxPriorityFeePerGas: String(maxPriorityFeePerGas),
        maxFeePerGas: String(maxFeePerGas)
    };
};

const broadcastSignedTransaction = async ({
    rpcUrls,
    rawTransaction,
    expectedHash,
    timeoutMs
}) => {
    let lastError;

    for (const rpcUrl of rpcUrls) {
        try {
            const web3 = makeProvider(rpcUrl);
            const hash = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('broadcast timeout'));
                }, timeoutMs);

                web3.eth.sendSignedTransaction(rawTransaction)
                    .once('transactionHash', value => {
                        clearTimeout(timer);
                        resolve(value);
                    })
                    .once('error', error => {
                        clearTimeout(timer);
                        reject(error);
                    });
            });

            return hash;
        } catch (error) {
            lastError = error;
            const text = String(error?.message || '').toLowerCase();

            if (
                text.includes('already known') ||
                text.includes('known transaction')
            ) {
                return expectedHash;
            }
        }
    }

    const pool = createRpcPool(rpcUrls);
    const found = await pool.run(
        async rpcUrl =>
            await makeProvider(rpcUrl).eth.getTransaction(expectedHash),
        { label: 'Legion broadcast verification', rotate: false }
    ).catch(() => null);

    if (found) return expectedHash;
    throw lastError || new Error('Failed to broadcast Legion claim');
};

const waitForReceipt = async ({ rpcPool, hash, pollMs, timeoutMs }) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const receipt = await rpcPool.run(
            async rpcUrl =>
                await makeProvider(rpcUrl).eth.getTransactionReceipt(hash),
            { label: 'Legion claim receipt' }
        ).catch(() => null);

        if (receipt) return receipt;
        await sleep(pollMs);
    }

    throw new Error(
        `Receipt timeout for ${hash}; automatic resend is disabled`
    );
};

const receiptSucceeded = receipt =>
    receipt?.status === true ||
    receipt?.status === 1 ||
    receipt?.status === '0x1';

const verifyClaimReceipt = async ({ rpcPool, claim, receipt, balanceBefore }) => {
    if (!receiptSucceeded(receipt)) {
        throw new Error('Legion claim receipt status is failed');
    }

    const web3 = new Web3();
    const claimEvent = legionTokenDistributorAbi.find(
        item => item.type === 'event' && item.name === 'TokenAllocationClaimed'
    );
    const claimTopic = web3.eth.abi.encodeEventSignature(claimEvent);
    const claimLog = (receipt.logs || []).find(log =>
        sameAddress(log.address, claim.distributorAddress) &&
        String(log.topics?.[0] || '').toLowerCase() === claimTopic.toLowerCase()
    );

    if (!claimLog) {
        throw new Error('Successful receipt has no TokenAllocationClaimed event');
    }

    const decodedEvent = web3.eth.abi.decodeLog(
        claimEvent.inputs,
        claimLog.data,
        claimLog.topics.slice(1)
    );

    if (!sameAddress(decodedEvent.investor, claim.recipientAddress)) {
        throw new Error('TokenAllocationClaimed investor does not match wallet');
    }

    const [positionRaw, balanceAfter] = await Promise.all([
        rpcPool.run(
            async rpcUrl => {
                const provider = makeProvider(rpcUrl);
                const contract = new provider.eth.Contract(
                    legionTokenDistributorAbi,
                    claim.distributorAddress
                );

                return await contract.methods
                    .investorPosition(claim.recipientAddress)
                    .call();
            },
            { label: 'Legion final investor position' }
        ),
        rpcPool.run(
            async rpcUrl => {
                const provider = makeProvider(rpcUrl);
                const token = new provider.eth.Contract(
                    legionClaimErc20Abi,
                    claim.tokenAddress
                );

                return await token.methods
                    .balanceOf(claim.recipientAddress)
                    .call();
            },
            { label: 'Legion final token balance' }
        )
    ]);

    const position = getTuple(positionRaw);

    if (!getBoolean(position?.hasSettled)) {
        throw new Error('Receipt succeeded but investor position is not settled');
    }

    return {
        amountToBeVested: String(decodedEvent.amountToBeVested),
        amountOnClaim: String(decodedEvent.amountOnClaim),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter)
    };
};

const sendClaim = async ({
    config,
    account,
    privateKey,
    rpcPool,
    rpcUrls,
    claim,
    data,
    simulation
}) => {
    const gasLimitMultiplier = Number(config.gasLimitMultiplier || 1.3);

    if (!Number.isFinite(gasLimitMultiplier) || gasLimitMultiplier < 1) {
        throw new Error('gasLimitMultiplier must be at least 1');
    }

    const gasLimit = String(
        Math.ceil(Number(simulation.estimateGas) * gasLimitMultiplier)
    );
    const txType = Number(claim.chainConfig.txType);

    const [nonce, feeData, balanceBefore] = await Promise.all([
        rpcPool.run(
            async rpcUrl =>
                await makeProvider(rpcUrl).eth.getTransactionCount(
                    claim.recipientAddress,
                    'pending'
                ),
            { label: 'Legion pending nonce', rotate: false }
        ),
        getFeeData({
            rpcPool,
            txType,
            multiplier: config.gasPriceMultiplier
        }),
        rpcPool.run(
            async rpcUrl => {
                const provider = makeProvider(rpcUrl);
                const token = new provider.eth.Contract(
                    legionClaimErc20Abi,
                    claim.tokenAddress
                );

                return await token.methods
                    .balanceOf(claim.recipientAddress)
                    .call();
            },
            { label: 'Legion initial token balance' }
        )
    ]);

    const maxGasPrice = txType === 2
        ? feeData.maxFeePerGas
        : feeData.gasPrice;
    const maximumFee = multiplyDecimalStrings(gasLimit, maxGasPrice);

    if (compareDecimalStrings(simulation.nativeBalance, maximumFee) < 0) {
        throw new Error(`${account.id}: insufficient native balance for claim gas`);
    }

    const transaction = {
        from: claim.recipientAddress,
        to: claim.distributorAddress,
        value: '0x0',
        data,
        gas: gasLimit,
        nonce,
        chainId: Number(claim.chainId)
    };

    if (txType === 0) {
        transaction.gasPrice = feeData.gasPrice;
    } else {
        transaction.type = 2;
        transaction.maxFeePerGas = feeData.maxFeePerGas;
        transaction.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    }

    const signer = new Web3();
    const signed = await signer.eth.accounts.signTransaction(
        transaction,
        privateKey
    );

    const hash = await broadcastSignedTransaction({
        rpcUrls,
        rawTransaction: signed.rawTransaction,
        expectedHash: signed.transactionHash,
        timeoutMs: Number(config.broadcastTimeoutMs || 5000)
    });

    accountLog(
        account.id,
        claim.chainConfig.explorer
            ? `TX: ${claim.chainConfig.explorer}${hash}`
            : `TX: ${hash}`
    );

    const receipt = await waitForReceipt({
        rpcPool,
        hash,
        pollMs: Number(config.receiptPollMs || 700),
        timeoutMs: Number(config.receiptTimeoutMs || 120000)
    });

    const verified = await verifyClaimReceipt({
        rpcPool,
        claim,
        receipt,
        balanceBefore
    });

    return { hash, receipt, verified };
};

const makeSafeApiReport = ({ account, walletAddress, apiState }) => {
    if (!apiState) {
        return {
            account: account.id,
            walletAddress,
            published: false
        };
    }

    const recipient = apiState.distribution?.recipient || {};

    return {
        account: account.id,
        walletAddress,
        published: true,
        slug: apiState.listItem?.slug,
        distributionType: apiState.distribution?.distributionType,
        chainId: String(apiState.distribution?.chain?.id || ''),
        distributorAddress: apiState.distribution?.contract?.address || null,
        tokenAddress: apiState.distribution?.token?.address || null,
        tokenSymbol: apiState.distribution?.token?.symbol || null,
        recipientAddress: recipient.walletAddress || null,
        claimAmount: recipient.claimAmount || null,
        claimStartTime: apiState.distribution?.claimStartTime || null,
        tgeClaimed: apiState.listItem?.tgeClaimed === true,
        signaturesAvailable:
            !apiState.signatures?.unavailableError &&
            typeof apiState.signatures?.claimSignature === 'string' &&
            typeof apiState.signatures?.vestingSignature === 'string'
    };
};

const checkAccountOnce = async ({ config, configDir, account }) => {
    const privateKey = loadPrivateKey(account, configDir);
    const walletAddress = new ethers.Wallet(privateKey).address;
    const secrets = loadAccountSecrets(account, configDir);

    try {
        const apiState = await getAccountApiState({ config, account, secrets });
        const report = makeSafeApiReport({ account, walletAddress, apiState });

        accountLog(account.id, 'read-only check completed');
        console.table(report);
        return report;
    } catch (error) {
        if (error instanceof WaitForClaimError) {
            const report = makeSafeApiReport({
                account,
                walletAddress,
                apiState: null
            });

            accountLog(account.id, error.message);
            return report;
        }

        throw error;
    }
};

const runAccountWorker = async ({ config, configDir, account, mode }) => {
    const privateKey = loadPrivateKey(account, configDir);
    const walletAddress = new ethers.Wallet(privateKey).address;
    const secrets = loadAccountSecrets(account, configDir);
    const pollIntervalMs = Number(config.pollIntervalMs || 1000);
    const distributionRefreshMs = Number(config.distributionRefreshMs || 10000);
    const preflightRefreshMs = Number(config.preflightRefreshMs || 30000);
    let lastWaitMessage = '';
    let lastWaitLoggedAt = 0;
    let cachedApiState = null;
    let apiStateCheckedAt = 0;
    let preflightCheckedAt = 0;
    let startRefreshDone = false;

    accountLog(account.id, `watching ${config.distributionSlug} for ${walletAddress}`);

    while (true) {
        try {
            const now = Date.now();
            const cachedStartMs = cachedApiState
                ? Date.parse(cachedApiState.distribution?.claimStartTime)
                : NaN;
            const crossedClaimStart =
                Number.isFinite(cachedStartMs) &&
                now >= cachedStartMs &&
                !startRefreshDone;
            const refreshDistribution =
                !cachedApiState ||
                now - apiStateCheckedAt >= distributionRefreshMs ||
                crossedClaimStart;

            if (refreshDistribution) {
                cachedApiState = await getAccountApiState({
                    config,
                    account,
                    secrets
                });
                apiStateCheckedAt = Date.now();

                const refreshedStartMs = Date.parse(
                    cachedApiState.distribution?.claimStartTime
                );

                if (
                    Number.isFinite(refreshedStartMs) &&
                    Date.now() >= refreshedStartMs
                ) {
                    startRefreshDone = true;
                }
            }

            const apiState = cachedApiState;
            const claim = validateAndBuildDistribution({
                config,
                account,
                walletAddress,
                listItem: apiState.listItem,
                distribution: apiState.distribution,
                requirePins: true
            });
            const rpcUrls = resolveRpcUrls(claim.chainConfig);
            const rpcPool = createRpcPool(rpcUrls);
            const signatures = apiState.signatures ||
                await getSignaturesState({
                    slug: apiState.listItem.slug,
                    secrets,
                    timeoutMs: Number(config.requestTimeoutMs || 6000)
                });

            // Do not reuse a signature response on the next fast polling pass.
            // The cached distribution remains, while signatures stay fresh.
            apiState.signatures = null;

            if (Date.now() < claim.claimStartMs) {
                if (
                    !signatures?.unavailableError &&
                    Date.now() - preflightCheckedAt >= preflightRefreshMs
                ) {
                    const preflightState = await readOnChainState({
                        rpcPool,
                        claim
                    });

                    validateSignatures(
                        signatures,
                        preflightState.legionSigner
                    );
                    preflightCheckedAt = Date.now();
                }

                const remainingMs = claim.claimStartMs - Date.now();
                throw new WaitForClaimError(
                    signatures?.unavailableError
                        ? `waiting for signatures; claim starts in ${Math.ceil(remainingMs / 1000)}s`
                        : `preflight ready; claim starts in ${Math.ceil(remainingMs / 1000)}s`
                );
            }

            if (signatures?.unavailableError) {
                throw new WaitForClaimError(
                    `waiting for signatures: ${signatures.unavailableError}`
                );
            }

            const onChainState = await readOnChainState({ rpcPool, claim });

            validateSignatures(
                signatures,
                onChainState.legionSigner
            );

            const data = buildLegionClaimCalldata({
                claim,
                signatures
            });
            const simulation = await simulateClaim({ rpcPool, claim, data });

            accountLog(
                account.id,
                `simulation passed; estimateGas=${simulation.estimateGas}`
            );

            if (mode !== 'auto') {
                return {
                    account: account.id,
                    status: 'SIMULATED',
                    walletAddress,
                    claim,
                    estimateGas: simulation.estimateGas
                };
            }

            const finalState = await readOnChainState({ rpcPool, claim });

            if (
                !sameAddress(finalState.askToken, onChainState.askToken) ||
                !sameAddress(finalState.legionSigner, onChainState.legionSigner) ||
                finalState.hasSettled
            ) {
                throw new Error('On-chain state changed after simulation');
            }

            const sent = await sendClaim({
                config,
                account,
                privateKey,
                rpcPool,
                rpcUrls,
                claim,
                data,
                simulation
            });

            accountLog(
                account.id,
                `CLAIM CONFIRMED in block ${sent.receipt.blockNumber}`
            );

            return {
                account: account.id,
                status: 'CONFIRMED',
                walletAddress,
                hash: sent.hash,
                blockNumber: sent.receipt.blockNumber,
                verified: sent.verified
            };
        } catch (error) {
            if (error instanceof LegionHttpError && error.status === 401) {
                throw new Error(`${account.id}: Legion session expired (HTTP 401)`);
            }

            if (
                error instanceof WaitForClaimError ||
                error instanceof LegionHttpError && [
                    408,
                    425,
                    429
                ].includes(error.status) ||
                error instanceof LegionHttpError && error.status >= 500
            ) {
                const message = error.message;
                const messageKey = message.replace(
                    /claim starts in \d+s$/,
                    'claim start countdown'
                );

                if (
                    messageKey !== lastWaitMessage ||
                    Date.now() - lastWaitLoggedAt >= 30000
                ) {
                    accountLog(account.id, message);
                    lastWaitMessage = messageKey;
                    lastWaitLoggedAt = Date.now();
                }

                await sleep(pollIntervalMs);
                continue;
            }

            throw error;
        }
    }
};

export const loadLegionClaimConfig = (
    configPath,
    { useLock = true } = {}
) => {
    const absolutePath = path.resolve(configPath);
    const rawConfig = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const configDir = path.dirname(absolutePath);
    const { config } = useLock
        ? applyLegionLock({
            config: rawConfig,
            configDir
        })
        : { config: rawConfig };

    if (!Array.isArray(config.accounts) || config.accounts.length === 0) {
        throw new Error('Legion config must contain at least one account');
    }

    return {
        config,
        configDir,
        configPath: absolutePath
    };
};

export const runLegionAccounts = async ({
    config,
    configDir,
    mode,
    accountIds = []
}) => {
    const selected = accountIds.length > 0
        ? config.accounts.filter(account => accountIds.includes(String(account.id)))
        : config.accounts;

    if (selected.length === 0) {
        throw new Error('No Legion accounts matched the requested account selector');
    }

    if (mode === 'auto') {
        if (
            config.requireLockForBroadcast === true &&
            !config._legionLock
        ) {
            throw new Error(
                'Auto mode requires a valid LEGION_CLAIM_LOCK; run --mode prepare first'
            );
        }

        if (config.allowBroadcast !== true) {
            throw new Error('Config allowBroadcast must be true for auto mode');
        }

        if (process.env.LEGION_BROADCAST_CONFIRM !== 'I_UNDERSTAND') {
            throw new Error(
                'Set LEGION_BROADCAST_CONFIRM=I_UNDERSTAND to enable broadcast'
            );
        }
    }

    const tasks = selected.map(account =>
        mode === 'check'
            ? checkAccountOnce({ config, configDir, account })
            : runAccountWorker({ config, configDir, account, mode })
    );

    const settled = await Promise.allSettled(tasks);

    return settled.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;

        return {
            account: selected[index].id,
            status: 'FAILED',
            error: result.reason?.message || String(result.reason)
        };
    });
};
