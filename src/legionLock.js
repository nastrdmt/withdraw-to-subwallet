import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const fingerprintPayload = payload =>
    crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

const withoutFingerprint = lock => {
    const { fingerprint, ...payload } = lock;
    return payload;
};

export const createLegionLock = payload => ({
    ...payload,
    fingerprint: fingerprintPayload(payload)
});

export const validateLegionLock = lock => {
    if (!lock || lock.version !== 1) {
        throw new Error('Unsupported Legion lock version');
    }

    const payload = withoutFingerprint(lock);
    const expected = fingerprintPayload(payload);

    if (lock.fingerprint !== expected) {
        throw new Error('LEGION_CLAIM_LOCK fingerprint is invalid');
    }

    if (!Array.isArray(lock.accounts) || lock.accounts.length === 0) {
        throw new Error('LEGION_CLAIM_LOCK has no accounts');
    }

    return lock;
};

export const resolveLegionLockPath = (config, configDir) => {
    if (!config.lockFile) return null;

    return path.isAbsolute(config.lockFile)
        ? config.lockFile
        : path.resolve(configDir, config.lockFile);
};

export const applyLegionLock = ({ config, configDir }) => {
    const lockPath = resolveLegionLockPath(config, configDir);

    if (!lockPath || !fs.existsSync(lockPath)) {
        return { config, lock: null, lockPath };
    }

    const lock = validateLegionLock(
        JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    );

    if (lock.distributionSlug !== config.distributionSlug) {
        throw new Error(
            'LEGION_CLAIM_LOCK belongs to another distributionSlug'
        );
    }

    if (
        config.projectSlug &&
        lock.projectSlug !== config.projectSlug
    ) {
        throw new Error('LEGION_CLAIM_LOCK belongs to another projectSlug');
    }

    const chainConfig = config.chains?.[String(lock.chainId)];

    if (!chainConfig) {
        throw new Error('LEGION_CLAIM_LOCK chain is not allowed by config');
    }

    if (
        !chainConfig.legionFactory?.address ||
        chainConfig.legionFactory.address.toLowerCase() !==
            String(lock.factoryAddress).toLowerCase()
    ) {
        throw new Error('LEGION_CLAIM_LOCK Factory differs from config');
    }

    const trustedDeployers =
        chainConfig.legionFactory.trustedDeployers || [];

    if (
        trustedDeployers.length > 0 &&
        !trustedDeployers.some(address =>
            address.toLowerCase() === String(lock.deployerAddress).toLowerCase()
        )
    ) {
        throw new Error('LEGION_CLAIM_LOCK deployer is not trusted by config');
    }

    const lockedAccounts = new Map(
        lock.accounts.map(account => [String(account.id), account])
    );

    const merged = {
        ...config,
        expected: {
            ...config.expected,
            chainId: String(lock.chainId),
            tokenAddress: lock.tokenAddress,
            distributorAddress: lock.distributorAddress,
            tokenDecimals: lock.tokenDecimals,
            tokenSymbol: lock.tokenSymbol,
            claimStartTime: lock.claimStartTime
        },
        accounts: config.accounts.map(account => {
            const locked = lockedAccounts.get(String(account.id));

            if (!locked) {
                throw new Error(
                    `LEGION_CLAIM_LOCK has no account ${account.id}`
                );
            }

            return {
                ...account,
                expectedWalletAddress: locked.walletAddress,
                expectedClaimAmount: locked.claimAmount,
                expectedVesting: locked.vesting
            };
        }),
        _legionLock: lock,
        _legionLockPath: lockPath
    };

    return { config: merged, lock, lockPath };
};

export const writeLegionLock = ({
    lock,
    lockPath,
    replace = false
}) => {
    validateLegionLock(lock);

    if (!lockPath) {
        throw new Error('lockFile is not configured');
    }

    fs.mkdirSync(path.dirname(lockPath), { recursive: true });

    if (fs.existsSync(lockPath)) {
        const existing = validateLegionLock(
            JSON.parse(fs.readFileSync(lockPath, 'utf8'))
        );

        if (existing.fingerprint === lock.fingerprint) {
            return {
                changed: false,
                lockPath,
                backupPath: null
            };
        }

        if (!replace) {
            throw new Error(
                'LEGION_CLAIM_LOCK already exists with different data; use --replace-lock'
            );
        }
    }

    const temporaryPath = `${lockPath}.tmp-${process.pid}`;
    const serialized = `${JSON.stringify(lock, null, 2)}\n`;
    let backupPath = null;

    fs.writeFileSync(temporaryPath, serialized, {
        encoding: 'utf8',
        flag: 'wx'
    });

    try {
        if (fs.existsSync(lockPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            backupPath = `${lockPath}.backup-${timestamp}`;
            fs.renameSync(lockPath, backupPath);
        }

        fs.renameSync(temporaryPath, lockPath);
    } catch (error) {
        if (fs.existsSync(temporaryPath)) {
            fs.unlinkSync(temporaryPath);
        }

        if (
            backupPath &&
            fs.existsSync(backupPath) &&
            !fs.existsSync(lockPath)
        ) {
            fs.renameSync(backupPath, lockPath);
        }

        throw error;
    }

    return {
        changed: true,
        lockPath,
        backupPath
    };
};
