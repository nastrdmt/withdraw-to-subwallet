/*
 * Read-only Legion claim availability check.
 *
 * Usage:
 * 1. Log in at https://app.legion.cc.
 * 2. Open DevTools -> Console.
 * 3. Paste this entire file and press Enter.
 *
 * Optional: change REQUESTED_SLUG if Legion publishes QUID under another slug.
 * This script only performs GET requests. It never connects a wallet, signs data,
 * sends a transaction, or prints cookies/full signatures.
 */

(async () => {
  'use strict';

  const REQUESTED_SLUG = 'quid';
  const API_ORIGIN = 'https://api.legion.cc';
  const APP_ORIGIN = 'https://app.legion.cc';

  const shortHex = (value) => {
    if (typeof value !== 'string' || !value.startsWith('0x')) return null;
    return value.length > 18
      ? `${value.slice(0, 10)}...${value.slice(-6)} (${(value.length - 2) / 2} bytes)`
      : value;
  };

  const isIntegerString = (value) =>
    typeof value === 'string' && /^[0-9]+$/.test(value);

  const getJson = async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';
    let body;

    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      const text = await response.text();
      throw new Error(
        `${new URL(url).host} returned HTTP ${response.status}, not JSON` +
        (text ? ` (${text.slice(0, 80)})` : '')
      );
    }

    if (!response.ok) {
      const message = body?.message || body?.error || JSON.stringify(body);
      throw new Error(`${new URL(url).host} HTTP ${response.status}: ${message}`);
    }

    return body;
  };

  const report = {
    checkedAt: new Date().toISOString(),
    requestedSlug: REQUESTED_SLUG,
    listSession: 'unknown',
    signaturesSession: 'not checked',
    found: false,
    claimReady: false,
    reasons: [],
  };

  try {
    console.log(`[Legion] Checking distributions for slug "${REQUESTED_SLUG}"...`);

    const distributions = await getJson(`${API_ORIGIN}/distributions`);
    if (!Array.isArray(distributions)) {
      throw new Error('Unexpected /distributions response: expected an array');
    }

    report.listSession = 'OK';
    report.availableDistributions = distributions.map((item) => ({
      slug: item.slug,
      projectName: item.projectName,
      distributionType: item.distributionType,
      tgeClaimed: item.tgeClaimed,
      walletAddress: item.walletAddress,
    }));

    const normalizedSlug = REQUESTED_SLUG.toLowerCase();
    const exact = distributions.find(
      (item) => String(item.slug || '').toLowerCase() === normalizedSlug
    );
    const candidates = distributions.filter((item) =>
      String(item.slug || '').toLowerCase().includes(normalizedSlug) ||
      String(item.projectName || '').toLowerCase().includes(normalizedSlug)
    );

    if (!exact) {
      report.reasons.push(`Distribution slug "${REQUESTED_SLUG}" is not published for this account`);
      report.candidates = candidates.map((item) => ({
        slug: item.slug,
        projectName: item.projectName,
        distributionType: item.distributionType,
      }));

      console.table(report.availableDistributions);
      console.log('[Legion] RESULT', report);
      return report;
    }

    report.found = true;

    const distribution = await getJson(
      `${API_ORIGIN}/distributions/${encodeURIComponent(exact.slug)}`
    );
    const recipient = distribution?.recipient || {};
    const claimStartMs = Date.parse(distribution?.claimStartTime);
    const claimStarted = Number.isFinite(claimStartMs) && Date.now() >= claimStartMs;

    report.distribution = {
      id: distribution?.id,
      slug: distribution?.slug,
      projectId: distribution?.projectId,
      distributionType: distribution?.distributionType,
      chain: distribution?.chain,
      contractAddress: distribution?.contract?.address || null,
      token: distribution?.token
        ? {
            name: distribution.token.name,
            symbol: distribution.token.symbol,
            address: distribution.token.address,
            decimals: distribution.token.decimals,
          }
        : null,
      recipientWallet: recipient.walletAddress || null,
      claimAmount: recipient.claimAmount || null,
      claimStartTime: distribution?.claimStartTime || null,
      claimStarted,
      vesting: {
        vestingStartTime: recipient.vestingStartTime,
        vestingDurationSeconds: recipient.vestingDurationSeconds,
        vestingCliffDurationSeconds: recipient.vestingCliffDurationSeconds,
        vestingType: recipient.vestingType,
        epochDurationSeconds: recipient.epochDurationSeconds,
        numberOfEpochs: recipient.numberOfEpochs,
        tokenAllocationOnTGERate: recipient.tokenAllocationOnTGERate,
      },
      transactionsCount: Array.isArray(distribution?.transactions)
        ? distribution.transactions.length
        : null,
    };

    if (distribution?.distributionType !== 'CLAIM') {
      report.reasons.push(`Distribution type is ${distribution?.distributionType}, not CLAIM`);
    }
    if (distribution?.chain?.type !== 'EVM') {
      report.reasons.push(`Chain type is ${distribution?.chain?.type}, not EVM`);
    }
    if (!distribution?.contract?.address) {
      report.reasons.push('Distributor contract address is missing');
    }
    if (!distribution?.token?.address) {
      report.reasons.push('Token address is missing');
    }
    if (!recipient.walletAddress) {
      report.reasons.push('Recipient wallet is missing');
    }
    if (!isIntegerString(recipient.claimAmount) || BigInt(recipient.claimAmount) <= 0n) {
      report.reasons.push('claimAmount is missing, invalid, or zero');
    }
    if (!Number.isFinite(claimStartMs)) {
      report.reasons.push('claimStartTime is missing or invalid');
    } else if (!claimStarted) {
      report.reasons.push(`Claim has not started; starts at ${distribution.claimStartTime}`);
    }
    if (exact.tgeClaimed === true) {
      report.reasons.push('tgeClaimed is already true');
    }

    try {
      const signatures = await getJson(
        `${APP_ORIGIN}/api/distributions/signatures?slug=${encodeURIComponent(exact.slug)}`
      );

      report.signaturesSession = 'OK';
      report.signatures = {
        claimMessage: shortHex(signatures?.claimMessage),
        claimSignature: shortHex(signatures?.claimSignature),
        vestingMessage: shortHex(signatures?.vestingMessage),
        vestingSignature: shortHex(signatures?.vestingSignature),
        claimMessageValid:
          typeof signatures?.claimMessage === 'string' &&
          /^0x[0-9a-fA-F]{64}$/.test(signatures.claimMessage),
        vestingMessageValid:
          typeof signatures?.vestingMessage === 'string' &&
          /^0x[0-9a-fA-F]{64}$/.test(signatures.vestingMessage),
        claimSignatureValid:
          typeof signatures?.claimSignature === 'string' &&
          /^0x[0-9a-fA-F]{130}$/.test(signatures.claimSignature),
        vestingSignatureValid:
          typeof signatures?.vestingSignature === 'string' &&
          /^0x[0-9a-fA-F]{130}$/.test(signatures.vestingSignature),
      };

      if (!report.signatures.claimMessageValid) report.reasons.push('claimMessage is not bytes32');
      if (!report.signatures.vestingMessageValid) report.reasons.push('vestingMessage is not bytes32');
      if (!report.signatures.claimSignatureValid) report.reasons.push('claimSignature is not 65 bytes');
      if (!report.signatures.vestingSignatureValid) report.reasons.push('vestingSignature is not 65 bytes');
    } catch (error) {
      report.signaturesSession = 'FAILED';
      report.reasons.push(`Signatures unavailable: ${error.message}`);
    }

    report.claimReady = report.reasons.length === 0;

    console.log('[Legion] Distribution');
    console.table(report.distribution);
    console.log(
      report.claimReady
        ? '[Legion] READY: server returned complete claim data'
        : '[Legion] NOT READY:',
      report.claimReady ? report : report.reasons
    );
    console.log('[Legion] Full safe report', report);
    return report;
  } catch (error) {
    report.reasons.push(error.message);
    console.error('[Legion] CHECK FAILED', report);
    return report;
  }
})();
