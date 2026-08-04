import { info } from "./other.js";
import { ethers } from "ethers";
import { abiLegacyFactory, abiSlipstreamFactory, abiQuoter, abiMulticall3 } from "./abi.js";

const MODE = "FAST";
const USE_STABLE = MODE === "FULL";

const CONNECTORS = [
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
    "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", // cbBTC
];

const TICK_SPACINGS = [1, 10, 50, 60, 100, 200, 500, 10000];

const ZERO = "0x0000000000000000000000000000000000000000";

const clean = (x) => x.toLowerCase();

const codeLegacy = (stable) => stable ? "400001" : "400000";

const codesForPool = (pool) => {
    if (pool.kind === "legacy-volatile") {
        return ["400000", "000064", "080064"];
    }

    if (pool.kind === "legacy-stable") {
        return ["400001"];
    }

    const tick = BigInt(pool.tickSpacing.toString());
    const tickHex = tick.toString(16).padStart(4, "0");

    return ["00" + tickHex, "10" + tickHex];
};

const encodePath = (tokens, codes) => {
    let out = clean(tokens[0]).replace(/^0x/, "");

    for (let i = 0; i < codes.length; i++) {
        out += codes[i];
        out += clean(tokens[i + 1]).replace(/^0x/, "");
    }

    return "0x" + out;
};

const makeMulticall = (provider, multicallIface) => {
    return async(calls) => {
        const data = multicallIface.encodeFunctionData("aggregate3", [calls]);

        const res = await provider.call({
            to: info.multicall3Aero,
            data,
        });

        return multicallIface.decodeFunctionResult("aggregate3", res)[0];
    };
};

export const getAeroCandidatePaths = async({ rpc, tokenIn, tokenOut }) => {
    // console.log("prepare tokenIn", tokenIn);
    // console.log("prepare tokenOut", tokenOut);

    const provider = new ethers.providers.JsonRpcProvider(rpc);

    const legacyIface = new ethers.utils.Interface(abiLegacyFactory);
    const slipstreamIface = new ethers.utils.Interface(abiSlipstreamFactory);
    const multicallIface = new ethers.utils.Interface(abiMulticall3);

    const multicall = makeMulticall(provider, multicallIface);

    const findPoolsForPair = async(tokenA, tokenB) => {
        tokenA = clean(tokenA);
        tokenB = clean(tokenB);

        const calls = [];
        const meta = [];

        for (const stable of USE_STABLE ? [false, true] : [false]) {
            calls.push({
                target: info.legacyFactory,
                allowFailure: true,
                callData: legacyIface.encodeFunctionData("getPool", [
                    tokenA,
                    tokenB,
                    stable,
                ]),
            });

            meta.push({ type: "legacy", stable });
        }

        for (const tick of TICK_SPACINGS) {
            calls.push({
                target: info.slipstreamFactory,
                allowFailure: true,
                callData: slipstreamIface.encodeFunctionData("getPool", [
                    tokenA,
                    tokenB,
                    tick,
                ]),
            });

            meta.push({ type: "cl", tick });
        }

        const returned = await multicall(calls);
        const pools = [];

        for (let i = 0; i < returned.length; i++) {
            const r = returned[i];
            if (!r.success) continue;

            let pool;

            try {
                if (meta[i].type === "legacy") {
                    pool = legacyIface.decodeFunctionResult("getPool", r.returnData)[0];
                } else {
                    pool = slipstreamIface.decodeFunctionResult("getPool", r.returnData)[0];
                }
            } catch {
                continue;
            }

            if (clean(pool) === clean(ZERO)) continue;

            if (meta[i].type === "legacy") {
                pools.push({
                    tokenA,
                    tokenB,
                    pool: clean(pool),
                    code: codeLegacy(meta[i].stable),
                    kind: meta[i].stable ? "legacy-stable" : "legacy-volatile",
                });
            } else {
                pools.push({
                    tokenA,
                    tokenB,
                    pool: clean(pool),
                    tickSpacing: meta[i].tick,
                    kind: `cl-${meta[i].tick}`,
                });
            }
        }

        return pools;
    };

    const inToken = clean(tokenIn);
    const outToken = clean(tokenOut);

    const connectors = CONNECTORS
        .map(clean)
        .filter((x) => x !== inToken && x !== outToken);

    const routes = [
        [inToken, outToken],
        ...connectors.map((c) => [inToken, c, outToken]),
    ];

    const routeData = await Promise.all(
        routes.map(async(tokens) => {
            const hopPools = await Promise.all(
                tokens.slice(0, -1).map((token, i) =>
                    findPoolsForPair(token, tokens[i + 1])
                )
            );

            if (hopPools.some((pools) => !pools.length)) {
                return [];
            }

            const paths = [];

            const combine = (idx, edges) => {
                if (idx === hopPools.length) {
                    paths.push({
                        tokens,
                        codes: edges.map((e) => e.code),
                        pools: edges.map((e) => e.pool),
                        kinds: edges.map((e) => e.kind),
                        path: encodePath(tokens, edges.map((e) => e.code)),
                    });
                    return;
                }

                for (const pool of hopPools[idx]) {
                    for (const code of codesForPool(pool)) {
                        combine(idx + 1, [
                            ...edges,
                            {
                                code,
                                pool: pool.pool,
                                kind: pool.kind + "-" + code,
                            },
                        ]);
                    }
                }
            };

            combine(0, []);
            return paths;
        })
    );

    return routeData.flat();
};

export const quoteAeroPreparedPaths = async({ rpc, paths, amountIn }) => {
    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const quoterIface = new ethers.utils.Interface(abiQuoter);
    const multicallIface = new ethers.utils.Interface(abiMulticall3);

    const multicall = makeMulticall(provider, multicallIface);

    const calls = paths.map((p) => ({
        target: info.quoterAero,
        allowFailure: true,
        callData: quoterIface.encodeFunctionData("quoteExactInput", [
            p.path,
            amountIn,
        ]),
    }));

    const quoted = await multicall(calls);
    const results = [];

    for (let i = 0; i < quoted.length; i++) {
        const r = quoted[i];
        const p = paths[i];

        if (!r.success) continue;

        try {
            const decoded = quoterIface.decodeFunctionResult(
                "quoteExactInput",
                r.returnData
            );

            const amountOut = decoded[0];

            if (!amountOut.isZero()) {
                results.push({
                    ...p,
                    amountOut,
                });
            }
        } catch {}
    }

    results.sort((a, b) => {
        if (a.amountOut.gt(b.amountOut)) return -1;
        if (a.amountOut.lt(b.amountOut)) return 1;
        return 0;
    });

    return results;
};

export const getBestAeroPath = async({ rpc, tokenIn, tokenOut, amountIn }) => {
    const paths = await getAeroCandidatePaths({
        rpc,
        tokenIn,
        tokenOut,
    });

    if (!paths?.length) return null;

    return await quoteAeroPreparedPaths({
        rpc,
        paths,
        amountIn,
    });
};