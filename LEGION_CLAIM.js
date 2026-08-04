import 'dotenv/config';

import {
    loadLegionClaimConfig,
    runLegionAccounts
} from './function/legionClaim.js';
import { prepareLegionLock } from './function/legionPrepare.js';

const readArgument = (name, fallback = null) => {
    const direct = process.argv.find(value => value.startsWith(`${name}=`));

    if (direct) return direct.slice(name.length + 1);

    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1]
        ? process.argv[index + 1]
        : fallback;
};

const mode = String(readArgument('--mode', 'check')).toLowerCase();
const configPath = readArgument(
    '--config',
    process.env.LEGION_CLAIM_CONFIG || './LEGION_CLAIM_CONFIG.json'
);
const accountArgument = readArgument('--account', '');
const accountIds = accountArgument
    ? accountArgument.split(',').map(value => value.trim()).filter(Boolean)
    : [];
const replaceLock = process.argv.includes('--replace-lock');

if (!['check', 'prepare', 'watch', 'auto'].includes(mode)) {
    throw new Error('Supported modes: check, prepare, watch, auto');
}

const { config, configDir, configPath: absoluteConfigPath } =
    loadLegionClaimConfig(configPath, {
        useLock: mode !== 'prepare'
    });

console.log(`[Legion] Config: ${absoluteConfigPath}`);
console.log(`[Legion] Mode: ${mode}`);

if (mode === 'check') {
    console.log('[Legion] Read-only mode: no transaction will be signed or sent');
} else if (mode === 'prepare') {
    console.log('[Legion] Prepare mode: Factory/API discovery and lock creation only');
} else if (mode === 'watch') {
    console.log('[Legion] Simulation mode: the script will wait, but never broadcast');
} else {
    console.log('[Legion] AUTO MODE: a validated claim transaction may be broadcast');
}

const results = mode === 'prepare'
    ? [await prepareLegionLock({
        config,
        configDir,
        replaceLock
    })]
    : await runLegionAccounts({
        config,
        configDir,
        mode,
        accountIds
    });

console.table(results.map(result => ({
    account: result.account,
    status: result.status || (result.published ? 'PUBLISHED' : 'NOT_PUBLISHED'),
    walletAddress: result.walletAddress || '',
    hash: result.hash || '',
    blockNumber: result.blockNumber || '',
    error: result.error || ''
})));

if (results.some(result => result.status === 'FAILED')) {
    process.exitCode = 1;
}
