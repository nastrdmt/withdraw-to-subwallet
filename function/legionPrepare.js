import Web3 from 'web3';
import { ethers } from 'ethers';

import {
    createRpcPool,
    isRetryableRpcError
} from '../src/rpcPool.js';
import { legionTokenDistributorFactoryEventAbi } from '../src/abi.js';
import {
    createLegionLock,
    resolveLegionLockPath,
    writeLegionLock
} from '../src/legionLock.js';
import {
    LegionHttpError,
    WaitForClaimError,
    getAccountApiState,
    getJson,
    loadAccountSecrets,
    loadPrivateKey,
    makeProvider,
    readOnChainState,
    resolveRpcUrls,
    sameAddress,
    sleep,
    validateAndBuildDistribution
} from './legionClaim.js';

const API_ORIGIN = 'https://api.legion.cc';

const prepareLog = message => {
    console.log(`[Legion prepare] ${message}`);
};

const getTuple = value =>
    value && typeof value[0] === 'object'
        ? value[0]
        : value;

const normalizeProjectToken = projectResponse => {
    const rounds = Array.isArray(projectResponse?.rounds)
        ? projectResponse.rounds
        : [];
    const candidates = rounds.filter(round =>
        round?.distributionType === 'CLAIM' &&
        Web3.utils.isAddress(round?.token?.address || '') &&
        String(round?.token?.chainId || '')
    );

    if (candidates.length === 0) {
        throw new WaitForClaimError(
            'project API has no CLAIM round with a configured token yet'
        );
    }

    const identities = new Map();

    for (const round of candidates) {
        const tokenAddress = Web3.utils.toChecksumAddress(round.token.address);
        const chainId = String(round.token.chainId);
        const key = `${chainId}:${tokenAddress.toLowerCase()}`;

        identities.set(key, {
            chainId,
            tokenAddress,
            tokenSymbol: String(round.token.symbol || ''),
            tokenDecimals: Number(round.token.decimals),
            roundId: round.id
        });
    }

    if (identities.size !== 1) {
        throw new Error(
            'Project has multiple CLAIM token candidates; pin roundId manually'
        );
    }

    const token = [...identities.values()][0];

    if (
        !token.tokenSymbol ||
        !Number.isInteger(token.tokenDecimals) ||
        token.tokenDecimals < 0 ||
        token.tokenDecimals > 255
    ) {
        throw new Error('Project token metadata is invalid');
    }

    return token;
};

const getProjectTokenForAccount = async ({
    config,
    account,
    secrets
}) => {
    const projectSlug = config.projectSlug || config.distributionSlug;

    if (!projectSlug) {
        throw new Error('projectSlug and distributionSlug are empty');
    }

    const projectResponse = await getJson({
        url: `${API_ORIGIN}/projects/${encodeURIComponent(projectSlug)}/simple`,
        cookie: secrets.apiCookie,
        timeoutMs: Number(config.requestTimeoutMs || 6000)
    });

    const returnedSlug = String(projectResponse?.project?.slug || '');

    if (returnedSlug.toLowerCase() !== String(projectSlug).toLowerCase()) {
        throw new Error(`${account.id}: project API returned another slug`);
    }

    return normalizeProjectToken(projectResponse);
};

const assertSameProjectToken = tokens => {
    const first = tokens[0];

    for (const token of tokens.slice(1)) {
        if (
            token.chainId !== first.chainId ||
            !sameAddress(token.tokenAddress, first.tokenAddress) ||
            token.tokenSymbol !== first.tokenSymbol ||
            token.tokenDecimals !== first.tokenDecimals
        ) {
            throw new Error('Legion accounts returned different project tokens');
        }
    }

    return first;
};

const decodeFactoryLog = log => {
    const web3 = new Web3();
    const decoded = web3.eth.abi.decodeLog(
        legionTokenDistributorFactoryEventAbi.inputs,
        log.data,
        log.topics.slice(1)
    );
    const initParams = getTuple(
        decoded.distributorInitParams || decoded[1]
    );

    return {
        distributorAddress: Web3.utils.toChecksumAddress(
            decoded.distributorInstance || decoded[0]
        ),
        askToken: Web3.utils.toChecksumAddress(
            initParams.askToken || initParams[3]
        ),
        totalAmountToDistribute: String(
            initParams.totalAmountToDistribute || initParams[6]
        ),
        transactionHash: log.transactionHash,
        blockNumber: Number(log.blockNumber),
        logIndex: Number(log.logIndex)
    };
};

const getFactoryTopic = () =>
    new Web3().eth.abi.encodeEventSignature(
        legionTokenDistributorFactoryEventAbi
    );

const getLogsFromAnyRpc = async ({ rpcUrls, filter }) => {
    let lastError;

    for (const rpcUrl of rpcUrls) {
        try {
            return await makeProvider(rpcUrl).eth.getPastLogs(filter);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to read Legion factory logs');
};

const getLogsAdaptive = async ({
    rpcUrls,
    factoryAddress,
    topic,
    fromBlock,
    toBlock
}) => {
    try {
        return await getLogsFromAnyRpc({
            rpcUrls,
            filter: {
                address: factoryAddress,
                topics: [topic],
                fromBlock,
                toBlock
            }
        });
    } catch (error) {
        const text = String(error?.message || '').toLowerCase();
        const rangeLimited = [
            'block range',
            'range should work',
            'please limit',
            'response size',
            'query returned more than',
            'too many results'
        ].some(value => text.includes(value));

        if (!rangeLimited || fromBlock >= toBlock) throw error;

        const middle = Math.floor((fromBlock + toBlock) / 2);
        const left = await getLogsAdaptive({
            rpcUrls,
            factoryAddress,
            topic,
            fromBlock,
            toBlock: middle
        });
        const right = await getLogsAdaptive({
            rpcUrls,
            factoryAddress,
            topic,
            fromBlock: middle + 1,
            toBlock
        });

        return [...left, ...right];
    }
};

const scanFactoryRange = async ({
    rpcUrls,
    factoryConfig,
    tokenAddress,
    fromBlock,
    toBlock
}) => {
    if (fromBlock > toBlock) return [];

    const chunkSize = Math.max(
        1,
        Number(factoryConfig.logChunkSize || 2000)
    );
    const topic = getFactoryTopic();
    const matches = [];

    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, toBlock);
        const logs = await getLogsAdaptive({
            rpcUrls,
            factoryAddress: factoryConfig.address,
            topic,
            fromBlock: start,
            toBlock: end
        });

        for (const log of logs) {
            const event = decodeFactoryLog(log);

            if (sameAddress(event.askToken, tokenAddress)) {
                matches.push(event);
            }
        }
    }

    return matches;
};

const getLatestBlock = async rpcPool =>
    Number(await rpcPool.run(
        async rpcUrl => await makeProvider(rpcUrl).eth.getBlockNumber(),
        { label: 'Legion factory latest block' }
    ));

const findContractCreationBlock = async ({
    rpcPool,
    distributorAddress,
    lowerBound
}) => {
    let low = Number(lowerBound || 0);
    let high = await getLatestBlock(rpcPool);

    const latestCode = await rpcPool.run(
        async rpcUrl =>
            await makeProvider(rpcUrl).eth.getCode(distributorAddress, high),
        { label: 'Legion distributor latest code', rotate: false }
    );

    if (!latestCode || latestCode === '0x') {
        throw new Error('Distributor bytecode is missing at latest block');
    }

    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const code = await rpcPool.run(
            async rpcUrl =>
                await makeProvider(rpcUrl).eth.getCode(
                    distributorAddress,
                    middle
                ),
            { label: 'Legion distributor creation search' }
        );

        if (code && code !== '0x') {
            high = middle;
        } else {
            low = middle + 1;
        }
    }

    return low;
};

const verifyFactoryProvenance = async ({
    rpcPool,
    rpcUrls,
    factoryConfig,
    distributorAddress,
    tokenAddress,
    knownCandidates
}) => {
    const factoryAddress = Web3.utils.toChecksumAddress(factoryConfig.address);
    let event = knownCandidates.find(candidate =>
        sameAddress(candidate.distributorAddress, distributorAddress)
    );

    if (!event) {
        const creationBlock = await findContractCreationBlock({
            rpcPool,
            distributorAddress,
            lowerBound: factoryConfig.deploymentBlock
        });
        const logs = await getLogsAdaptive({
            rpcUrls,
            factoryAddress,
            topic: getFactoryTopic(),
            fromBlock: creationBlock,
            toBlock: creationBlock
        });

        event = logs
            .map(decodeFactoryLog)
            .find(candidate =>
                sameAddress(candidate.distributorAddress, distributorAddress)
            );
    }

    if (!event) {
        throw new Error('Distributor was not created by the pinned Legion Factory');
    }

    if (!sameAddress(event.askToken, tokenAddress)) {
        throw new Error('Factory event askToken does not match project token');
    }

    const transaction = await rpcPool.run(
        async rpcUrl =>
            await makeProvider(rpcUrl).eth.getTransaction(
                event.transactionHash
            ),
        { label: 'Legion factory creation transaction', rotate: false }
    );

    if (!transaction) {
        throw new Error('Legion factory creation transaction is missing');
    }

    const trustedDeployers = factoryConfig.trustedDeployers || [];

    if (
        trustedDeployers.length > 0 &&
        !trustedDeployers.some(address => sameAddress(address, transaction.from))
    ) {
        throw new Error('Factory transaction sender is not a pinned Legion deployer');
    }

    return {
        factoryAddress,
        deployerAddress: Web3.utils.toChecksumAddress(transaction.from),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        totalAmountToDistribute: event.totalAmountToDistribute
    };
};

const getPublishedStates = async ({ config, contexts }) => {
    const settled = await Promise.allSettled(
        contexts.map(context =>
            getAccountApiState({
                config,
                account: context.account,
                secrets: context.secrets,
                includeSignatures: false
            })
        )
    );

    const states = [];

    for (const result of settled) {
        if (result.status === 'fulfilled') {
            states.push(result.value);
            continue;
        }

        const error = result.reason;

        if (error instanceof WaitForClaimError) {
            return null;
        }

        if (
            error instanceof LegionHttpError && [
                408,
                425,
                429
            ].includes(error.status) ||
            error instanceof LegionHttpError && error.status >= 500
        ) {
            return null;
        }

        if (error instanceof LegionHttpError && error.status === 401) {
            throw new Error('One of the Legion API sessions expired (HTTP 401)');
        }

        throw error;
    }

    return states;
};

const assertSharedDistribution = claims => {
    const first = claims[0];

    for (const claim of claims.slice(1)) {
        if (
            claim.chainId !== first.chainId ||
            !sameAddress(claim.tokenAddress, first.tokenAddress) ||
            !sameAddress(claim.distributorAddress, first.distributorAddress) ||
            claim.tokenSymbol !== first.tokenSymbol ||
            claim.tokenDecimals !== first.tokenDecimals ||
            claim.claimStartTime !== first.claimStartTime
        ) {
            throw new Error(
                'Legion accounts returned different shared distribution fields'
            );
        }
    }

    return first;
};

export const prepareLegionLock = async ({
    config,
    configDir,
    replaceLock = false
}) => {
    if (!config.lockFile) {
        throw new Error('lockFile is not configured');
    }

    const contexts = config.accounts.map(account => {
        const privateKey = loadPrivateKey(account, configDir);

        return {
            account,
            walletAddress: new ethers.Wallet(privateKey).address,
            secrets: loadAccountSecrets(account, configDir)
        };
    });

    prepareLog(`checking project ${config.projectSlug || config.distributionSlug}`);

    let projectTokens;

    while (!projectTokens) {
        try {
            projectTokens = await Promise.all(
                contexts.map(context =>
                    getProjectTokenForAccount({
                        config,
                        account: context.account,
                        secrets: context.secrets
                    })
                )
            );
        } catch (error) {
            if (error instanceof LegionHttpError && error.status === 401) {
                throw new Error('One of the Legion API sessions expired (HTTP 401)');
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
                prepareLog(error.message);
                await sleep(Number(config.pollIntervalMs || 1000));
                continue;
            }

            throw error;
        }
    }
    const projectToken = assertSameProjectToken(projectTokens);
    const chainConfig = config.chains?.[projectToken.chainId];

    if (!chainConfig) {
        throw new Error(`Project token chain ${projectToken.chainId} is not allowed`);
    }

    const factoryConfig = chainConfig.legionFactory;

    if (!factoryConfig?.address || !Web3.utils.isAddress(factoryConfig.address)) {
        throw new Error('Pinned Legion Factory is missing for this chain');
    }

    const rpcUrls = resolveRpcUrls(chainConfig);
    const rpcPool = createRpcPool(rpcUrls);
    const latestAtStart = await getLatestBlock(rpcPool);
    const lookbackBlocks = Number(factoryConfig.lookbackBlocks || 100000);
    let scanCursor = Math.max(
        Number(factoryConfig.watchStartBlock || 0),
        Number(factoryConfig.deploymentBlock || 0),
        latestAtStart - lookbackBlocks
    );
    let knownCandidates = [];
    let lastStatus = '';
    let apiStates;

    while (!apiStates) {
        apiStates = await getPublishedStates({ config, contexts });

        if (apiStates) break;

        const latest = await getLatestBlock(rpcPool);

        if (scanCursor <= latest) {
            let found;

            try {
                found = await scanFactoryRange({
                    rpcUrls,
                    factoryConfig,
                    tokenAddress: projectToken.tokenAddress,
                    fromBlock: scanCursor,
                    toBlock: latest
                });
            } catch (error) {
                if (!isRetryableRpcError(error)) throw error;

                prepareLog('temporary Factory RPC error; retrying');
                await sleep(Number(config.pollIntervalMs || 1000));
                continue;
            }

            for (const candidate of found) {
                if (!knownCandidates.some(item =>
                    sameAddress(item.distributorAddress, candidate.distributorAddress)
                )) {
                    knownCandidates.push(candidate);
                    prepareLog(
                        `factory candidate: ${candidate.distributorAddress} ` +
                        `(block ${candidate.blockNumber})`
                    );
                }
            }

            scanCursor = latest + 1;
        }

        const status = knownCandidates.length > 0
            ? 'factory candidate found; waiting for Legion distribution API'
            : 'waiting for Factory event and Legion distribution API';

        if (status !== lastStatus) {
            prepareLog(status);
            lastStatus = status;
        }

        await sleep(Number(config.pollIntervalMs || 1000));
    }

    const claims = apiStates.map((apiState, index) =>
        validateAndBuildDistribution({
            config,
            account: contexts[index].account,
            walletAddress: contexts[index].walletAddress,
            listItem: apiState.listItem,
            distribution: apiState.distribution,
            requirePins: false
        })
    );
    const shared = assertSharedDistribution(claims);

    if (
        shared.chainId !== projectToken.chainId ||
        !sameAddress(shared.tokenAddress, projectToken.tokenAddress) ||
        shared.tokenSymbol !== projectToken.tokenSymbol ||
        shared.tokenDecimals !== projectToken.tokenDecimals
    ) {
        throw new Error('Distribution token differs from project API token');
    }

    await Promise.all(
        claims.map(claim => readOnChainState({ rpcPool, claim }))
    );

    const provenance = await verifyFactoryProvenance({
        rpcPool,
        rpcUrls,
        factoryConfig,
        distributorAddress: shared.distributorAddress,
        tokenAddress: shared.tokenAddress,
        knownCandidates
    });

    const lock = createLegionLock({
        version: 1,
        projectSlug: config.projectSlug || config.distributionSlug,
        distributionSlug: config.distributionSlug,
        chainId: shared.chainId,
        tokenAddress: shared.tokenAddress,
        tokenSymbol: shared.tokenSymbol,
        tokenDecimals: shared.tokenDecimals,
        distributorAddress: shared.distributorAddress,
        claimStartTime: shared.claimStartTime,
        factoryAddress: provenance.factoryAddress,
        deployerAddress: provenance.deployerAddress,
        creationTransactionHash: provenance.transactionHash,
        creationBlock: provenance.blockNumber,
        totalAmountToDistribute: provenance.totalAmountToDistribute,
        accounts: claims.map((claim, index) => ({
            id: String(contexts[index].account.id),
            walletAddress: claim.recipientAddress,
            claimAmount: claim.claimAmount,
            vesting: claim.vesting
        }))
    });
    const lockPath = resolveLegionLockPath(config, configDir);
    const writeResult = writeLegionLock({
        lock,
        lockPath,
        replace: replaceLock
    });

    prepareLog(
        writeResult.changed
            ? `lock created: ${writeResult.lockPath}`
            : `existing lock already matches: ${writeResult.lockPath}`
    );

    if (writeResult.backupPath) {
        prepareLog(`previous lock moved to: ${writeResult.backupPath}`);
    }

    return {
        account: 'all',
        status: writeResult.changed ? 'LOCK_CREATED' : 'LOCK_UNCHANGED',
        walletAddress: '',
        hash: provenance.transactionHash,
        blockNumber: provenance.blockNumber,
        lockPath: writeResult.lockPath
    };
};

export const verifyLegionFactoryForSelfTest = verifyFactoryProvenance;
export const scanLegionFactoryForSelfTest = scanFactoryRange;
