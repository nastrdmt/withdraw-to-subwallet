import {
    discoverPancakeV3Routes,
    getCachedPancakeV3Routes,
    getPancakeV3RouteCacheKey
} from '../src/pancakeV3.js';

import {
    createRpcPool,
    uniqueRpcUrls
} from '../src/rpcPool.js';

import {
    log
} from '../src/other.js';


const activeWatchers = new Map();


const getRoutesSignature = routes => {
    return routes
        .map(route => {
            return [
                route.tokens
                    .map(token => token.toLowerCase())
                    .join('>'),

                route.fees.join('>'),

                route.pools
                    .map(pool => pool.toLowerCase())
                    .join('>')
            ].join(':');
        })
        .sort()
        .join('|');
};


export const startPancakeV3RouteWatcher = ({
    rpcUrls,
    cfg,
    tokenIn,
    tokenOut,
    intervalMs = 1000
}) => {
    const urls = uniqueRpcUrls(rpcUrls);

    if (urls.length === 0) {
        throw new Error(
            'Pancake V3 watcher RPC list is empty'
        );
    }

    const watcherKey =
        getPancakeV3RouteCacheKey({
            cfg,
            tokenIn,
            tokenOut
        });

    /*
     * Для одной пары запускается только
     * один watcher на весь процесс.
     */
    if (activeWatchers.has(watcherKey)) {
        return activeWatchers.get(watcherKey);
    }

    const rpcPool = createRpcPool(urls);

    const state = {
        running: false,
        stopped: false,
        ready: false,

        scans: 0,
        routesCount: 0,

        startedAt: Date.now(),
        updatedAt: null,

        lastRpcError: null,
        lastRoutesSignature: null
    };

    let timer = null;
    let readyResolved = false;
    let resolveReady;

    const ready = new Promise(resolve => {
        resolveReady = resolve;
    });

    const scheduleNextScan = () => {
        if (state.stopped) {
            return;
        }

        timer = setTimeout(
            scan,
            Math.max(250, Number(intervalMs))
        );
    };

    const scan = async () => {
        if (
            state.stopped ||
            state.running
        ) {
            return;
        }

        state.running = true;
        state.scans++;

        try {
            const routes = await rpcPool.run(
                currentRpc =>
                    discoverPancakeV3Routes({
                        rpcUrl: currentRpc,
                        cfg,
                        tokenIn,
                        tokenOut
                    }),
                {
                    label:
                        'Pancake V3 route discovery',

                    rotate: true,
                    timeoutMs: 30000
                }
            );

            if (state.stopped) {
                return;
            }

            const signature =
                getRoutesSignature(routes);

            state.ready = true;
            state.routesCount = routes.length;
            state.updatedAt = Date.now();
            state.lastRpcError = null;

            if (
                signature !==
                state.lastRoutesSignature
            ) {
                state.lastRoutesSignature =
                    signature;

                log(
                    'info',
                    `[Pancake V3 Watcher] ` +
                    `Found ${routes.length} prepared routes`,
                    'green'
                );
            }

            if (!readyResolved) {
                readyResolved = true;

                resolveReady({
                    routes,
                    cached:
                        getCachedPancakeV3Routes({
                            cfg,
                            tokenIn,
                            tokenOut
                        })
                });
            }
        } catch (error) {
            const message =
                error?.message ||
                String(error);

            /*
             * До создания пула отсутствие маршрута
             * является нормальным состоянием.
             * Одинаковую ошибку каждую секунду
             * в лог не выводим.
             */
            if (
                message !==
                state.lastRpcError
            ) {
                state.lastRpcError = message;

                log(
                    'info',
                    `[Pancake V3 Watcher] ` +
                    `Waiting for routes: ${message}`,
                    'yellow'
                );
            }
        } finally {
            state.running = false;
            scheduleNextScan();
        }
    };

    const controller = {
        key: watcherKey,
        ready,

        getState: () => {
            return {
                ...state
            };
        },

        getCachedRoutes: () => {
            return getCachedPancakeV3Routes({
                cfg,
                tokenIn,
                tokenOut
            });
        },

        scanNow: async () => {
            await scan();

            return getCachedPancakeV3Routes({
                cfg,
                tokenIn,
                tokenOut
            });
        },

        stop: () => {
            state.stopped = true;

            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            activeWatchers.delete(watcherKey);

            if (!readyResolved) {
                readyResolved = true;
                resolveReady(null);
            }

            log(
                'info',
                '[Pancake V3 Watcher] Stopped',
                'yellow'
            );
        }
    };

    activeWatchers.set(
        watcherKey,
        controller
    );

    /*
     * Первый поиск запускается сразу,
     * но start-функцию не блокирует.
     */
    void scan();

    return controller;
};