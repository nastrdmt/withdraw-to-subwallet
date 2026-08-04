import { info, log } from './other.js';
import { ethers } from "ethers";
import { abiUniversalRouter } from './abi.js';
import { getDataTx } from './web3.js';
import { getBestAeroPath, getAeroCandidatePaths, quoteAeroPreparedPaths } from "./aerodromeQuote.js";
import { multiply } from "mathjs";

const SWAP_EXACT_IN = "0x0c";

const ERC20_DECIMALS_ABI = [
    {
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function"
    }
];

const getPrepareTestAmount = async(rpc, addressToken) => {
    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const token = new ethers.Contract(addressToken, ERC20_DECIMALS_ABI, provider);

    const decimals = await token.decimals();

    if (addressToken.toLowerCase() === info.BaseUSDC.toLowerCase()) {
        return ethers.utils.parseUnits("0.2", decimals).toString();
    }

    return ethers.utils.parseUnits("3000", decimals).toString();
};

export const prepareAeroPaths = async(rpc, addressFrom, addressToken, slippageSwap) => {
    const testAmount = await getPrepareTestAmount(rpc, addressToken);

    const paths = await getAeroCandidatePaths({
        rpc,
        tokenIn: addressToken,
        tokenOut: info.WETH,
    });

    if (!paths?.length) return null;

    // console.log(`PREPARED RAW PATHS: ${paths.length}`);
    console.log(`TEST AMOUNT: ${testAmount}`);

    const routes = await quoteAeroPreparedPaths({
        rpc,
        paths,
        amountIn: testAmount,
    });

    if (!routes?.length) return null;

    routes.sort((a, b) => {
        const aHops = a.tokens.length;
        const bHops = b.tokens.length;

        if (aHops !== bHops) return aHops - bHops;

        if (a.amountOut.gt(b.amountOut)) return -1;
        if (a.amountOut.lt(b.amountOut)) return 1;

        return 0;
    });

    const preparedRoutes = routes.slice(0, 3);

    // console.log(`PREPARED QUOTED ROUTES: ${preparedRoutes.length}`);

    for (const r of preparedRoutes) {
        // console.log("PREPARED ROUTE:");
        // console.log("PATH:", r.path);
        // console.log("TOKENS:", r.tokens.join(" -> "));
        // console.log("CODES:", r.codes.join(" -> "));
    }

    return preparedRoutes;
};

export const dataSwapAerodromeUniversalPrepared = async(
    rpc,
    addressFrom,
    addressToken,
    amountToken,
    slippageSwap,
    preparedPaths
) => {
    const routes = await quoteAeroPreparedPaths({
        rpc,
        paths: preparedPaths,
        amountIn: amountToken,
    });

    if (!routes?.length) {
        console.log("NO QUOTED PREPARED ROUTE FOUND");
        return null;
    }

    // direct path сначала
    routes.sort((a, b) => {
        const aHops = a.tokens.length;
        const bHops = b.tokens.length;

        if (aHops !== bHops) {
            return aHops - bHops;
        }

        if (a.amountOut.gt(b.amountOut)) return -1;
        if (a.amountOut.lt(b.amountOut)) return 1;

        return 0;
    });
    
    const routesToTry = routes.slice(0, 2);

    for (const best of routesToTry ) {
        const amountOutMin = parseInt(
            multiply(best.amountOut.toString(), slippageSwap)
        );

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
        const COMMANDS = "0x000c";

        const swapInput = ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "bytes", "bool"],
            [
                info.aeroBaseUniversalRouter,
                amountToken.toString(),
                amountOutMin,
                best.path,
                true
            ]
        );

        const unwrapInput = ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256"],
            [
                addressFrom,
                amountOutMin
            ]
        );

        try {
            const tx = await getDataTx(
                rpc,
                abiUniversalRouter,
                info.aeroBaseUniversalRouter,
                "execute",
                [
                    COMMANDS,
                    [
                        swapInput,
                        unwrapInput
                    ],
                    deadline
                ],
                null,
                addressFrom
            );

            // console.log("EXECUTABLE PREPARED ROUTE FOUND");
            console.log("PATH:", best.path);

            return {
                ...tx,
                best,
                amountOutMin,
            };

        } catch(e) {
            console.log("PREPARED ROUTE FAILED:", best.tokens.join(" -> "));
            console.log("FAILED CODES:", best.codes.join(" -> "));
            console.log(e?.message || e);
            continue;
        }
    }

    console.log("NO EXECUTABLE PREPARED ROUTE FOUND");
    return null;
};

export const dataSwapAerodromeUniversal = async(rpc, addressFrom, addressToken, amountToken, slippageSwap) => {  
    
    const routes = await getBestAeroPath({
        rpc: rpc,
        tokenIn: addressToken,
        tokenOut: info.WETH,
        amountIn: amountToken,
    });
// console.log('routes', routes)
    if (!routes || !routes.length) {
        console.log("NO AERODROME ROUTE FOUND");
        return null;
    }
    const routesToTry = routes.slice(0, 2);
    for (const best of routesToTry) {

            const amountOutMin = parseInt(multiply(best.amountOut.toString(), slippageSwap)
        );

            const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
            const COMMANDS = "0x000c";
            const swapInput = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "bytes", "bool"],
        [
            info.aeroBaseUniversalRouter,
            amountToken.toString(),
            amountOutMin,
            best.path,
            true
        ]
        );

        const unwrapInput = ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256"],
            [
                addressFrom,
                amountOutMin
            ]
        );

        try {

            const tx = await getDataTx(
                rpc,
                abiUniversalRouter,
                info.aeroBaseUniversalRouter,
                "execute",
                [
                    COMMANDS,
                    [
                        swapInput,
                        unwrapInput
                    ],
                    deadline
                ],
                null,
                addressFrom
            );

            console.log('EXECUTABLE ROUTE FOUND');
            console.log('PATH:', best.path);

            return {
                ...tx,
                best
            };

        } catch(e) {

            console.log('ROUTE FAILED:', best.tokens.join(' -> '));
            console.log('FAILED CODES:', best.codes.join(' -> '));
            console.log(e?.message || e);

            continue;
        }
    }

    console.log("NO EXECUTABLE AERODROME ROUTE FOUND");
    return null;
};