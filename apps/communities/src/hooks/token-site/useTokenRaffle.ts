'use client';

import {type RefObject, useCallback, useEffect, useMemo, useRef, useState} from "react";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {bze} from "@bze/bzejs";
import type {RaffleSDKType, RaffleWinnerSDKType} from "@bze/bzejs/bze/burner/raffle";
import {
    checkAddressWonRaffle,
    getChainFeed,
    getChainName,
    getFromLocalStorage,
    getRafflesOrThrow,
    getRaffleWinners,
    getSettings,
    setInLocalStorage,
    TTL_NO_EXPIRY,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetsContext,
    useBZETx,
    useToast,
} from "@bze/bze-ui-kit";

import {
    entrySummary,
    isEntryExpired,
    isEntryResolved,
    newRaffleEntry,
    parseEntries,
    type RaffleEntry,
    recentWinners,
    resolveEntry,
    serializeEntries,
} from "@/lib/token-site/raffle";
import {useNextBurning} from "@/hooks/useNextBurning";
import {walletAmount} from "@/lib/token-site/wallet";

const {joinRaffle} = bze.burner.MessageComposer.withTypeUrl;

/**
 * While the chain feed is down, tickets are checked on a timer instead of on each new block.
 * Blocks come every ~6 s and a ticket is drawn per block, so a little slower than that.
 */
export const RAFFLE_POLL_MS = 7_000;

/**
 * A live feed that brought no block for this long is treated as down: "live" only means some
 * notification arrived on the socket, not that this page's NewBlock subscription gets any.
 */
const BLOCK_STALL_MS = 10_000;

/** How often entries past their hour on the page are dropped. */
const EXPIRY_CHECK_MS = 60_000;

const NEW_BLOCK_QUERY = "tm.event='NewBlock'";

/** The wallet's joins of T's raffle, kept in browser storage so a reload resumes the draw. */
const storageKey = (address: string, denom: string) => `communities:raffle:${address}:${denom}`;

function readEntries(key: string | undefined): RaffleEntry[] {
    if (!key) return [];

    const now = Date.now();
    return parseEntries(getFromLocalStorage(key)).filter((entry) => !isEntryExpired(entry, now));
}

/** The height of a `tm.event='NewBlock'` notification, if it carries one. */
function newBlockHeight(result: unknown): number | undefined {
    const height = (result as { data?: { value?: { block?: { header?: { height?: unknown } } } } } | undefined)
        ?.data?.value?.block?.header?.height;
    const value = Number(height);

    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/**
 * The last block the shared chain feed reported, whether the feed is live, and when this page
 * last heard of a block (ms; read at check time, so it lives in a ref).
 */
function useChainHeight(): { height?: number; live: boolean; lastBlockAt: RefObject<number | undefined> } {
    const [height, setHeight] = useState<number>();
    const [live, setLive] = useState(false);
    const lastBlockAt = useRef<number | undefined>(undefined);

    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint) return;

        // The feed shares one subscription per query: this joins the app listener's NewBlock one.
        const feed = getChainFeed(rpcEndpoint);
        const unsubscribe = feed.subscribe(NEW_BLOCK_QUERY, (result) => {
            const value = newBlockHeight(result);
            if (value === undefined) return;

            lastBlockAt.current = Date.now();
            setHeight((previous) => Math.max(previous ?? 0, value));
        });
        const unwatch = feed.onStatus((status) => setLive(status === "live"));

        return () => {
            unsubscribe();
            unwatch();
        };
    }, []);

    return {height, live, lastBlockAt};
}

interface Loaded {
    denom: string;
    raffle?: RaffleSDKType;
    winners: RaffleWinnerSDKType[];
}

export interface TokenRaffle {
    isLoading: boolean;
    /** T's raffle; absent when the burner runs none for it. */
    raffle?: RaffleSDKType;
    /** Newest first, at most 5. */
    winners: RaffleWinnerSDKType[];
    /**
     * The connected wallet's joins, oldest first: kept in browser storage (per wallet and T) until
     * an hour after their last draw, so a reload picks the draw up where it was.
     */
    entries: RaffleEntry[];
    /** The last block the chain feed reported; absent until one arrives. */
    height?: number;
    /** Buys `tickets` tickets; resolves to the new entry's id, or undefined when the tx failed. */
    join: (tickets: number) => Promise<string | undefined>;
    /** Whether an entry's result view is open; unwatched entries report through toasts. */
    watch: (id: string, watched: boolean) => void;
}

interface CheckContext {
    address?: string;
    key?: string;
    denom: string;
    entries: RaffleEntry[];
    asset?: { ticker: string; decimals: number };
    toast: ReturnType<typeof useToast>["toast"];
    reload: () => void;
    reloadNextBurn: () => Promise<void> | void;
    updateBalances: () => void;
    setEntries: (forKey: string, update: (previous: RaffleEntry[]) => RaffleEntry[]) => void;
}

/**
 * Resolves every pending join as far as the chain has drawn, reading each block once however many
 * joins draw in it, then applies the results if the wallet and T are still the ones it started for.
 * A failed read leaves the entries as they were for the next block to retry. A check that ends after
 * the page was left only saves its results, so the next visit shows them without toasts.
 */
async function checkOnce(context: { current: CheckContext }, mounted: { current: boolean }): Promise<void> {
    const {address, key, denom, entries} = context.current;
    const pending = entries.filter((entry) => !isEntryResolved(entry));
    if (!address || !key || pending.length === 0) return;

    const blocks = new Map<number, ReturnType<typeof checkAddressWonRaffle>>();
    const checkBlock = (block: number) => {
        let answer = blocks.get(block);
        if (!answer) {
            answer = checkAddressWonRaffle(address, denom, block);
            blocks.set(block, answer);
        }
        return answer;
    };

    let resolved: RaffleEntry[];
    try {
        resolved = await Promise.all(pending.map((entry) => resolveEntry(entry, checkBlock)));
    } catch (error) {
        console.error("raffle: checking the draw failed, retrying on the next block", error);
        return;
    }

    const {key: currentKey, entries: currentEntries, asset, toast, reload, reloadNextBurn, updateBalances, setEntries} = context.current;
    if (currentKey !== key) return;

    const now = Date.now();
    const changed = resolved
        .map((after, index) => ({before: pending[index], after}))
        .filter(({before, after}) => after !== before)
        .map(({before, after}) => ({
            before,
            after: {
                ...after,
                results: after.results.map((result, index) => (index < before.results.length ? result : {...result, at: now})),
                resolvedAt: isEntryResolved(after) ? now : undefined,
            },
        }));
    if (changed.length === 0) return;

    const apply = (list: RaffleEntry[]) => list.map((entry) => {
        const update = changed.find(({after}) => after.id === entry.id)?.after;
        return update ? {...update, watched: entry.watched} : entry;
    });
    if (!mounted.current) {
        setInLocalStorage(key, serializeEntries(apply(readEntries(key))), TTL_NO_EXPIRY);
        return;
    }

    const ticker = asset?.ticker ?? denom;
    const amount = (uAmount: BigNumber) => `${walletAmount(uAmountToBigNumberAmount(uAmount, asset?.decimals ?? 0))} ${ticker}`;
    changed.forEach(({before, after}) => {
        // Results nobody is looking at come as toasts: whether the dialog shows the join is read now.
        if (currentEntries.find((entry) => entry.id === after.id)?.watched ?? before.watched) return;

        after.results.slice(before.results.length).forEach((result, offset) => {
            if (result.won) toast.success(`${ticker} raffle: ticket ${before.results.length + offset + 1} won`, `You won ${amount(result.amount)}.`);
        });
        if (isEntryResolved(after)) {
            const summary = entrySummary(after);
            toast.info(
                `${ticker} raffle: all ${after.tickets} ${after.tickets === 1 ? "ticket" : "tickets"} drawn`,
                summary.won > 0 ? `${summary.won} won, ${amount(summary.amount)} in total.` : "No winning ticket this time.",
            );
        }
    });
    setEntries(key, apply);
    // A run that follows straight away (blocks arrived meanwhile) starts from these results, not
    // from the entries of the last render.
    context.current = {...context.current, entries: apply(currentEntries)};

    // Every draw moves the pot; a win adds a winner and pays out of the pot, so the raffle, the
    // next burn and the balance are read again right away.
    reload();
    if (changed.some(({before, after}) => after.results.slice(before.results.length).some((result) => result.won))) {
        void reloadNextBurn();
        updateBalances();
    }
}

/** Throws when the raffles can't be read, so a failed read never looks like "no raffle". */
async function loadRaffle(denom: string): Promise<Loaded> {
    const raffle = (await getRafflesOrThrow()).find((candidate) => candidate.denom === denom);
    const winners = raffle ? recentWinners(await getRaffleWinners(denom), raffle.winners) : [];

    return {denom, raffle, winners};
}

/**
 * T's burn raffle (Business Logic R11): the raffle and its latest winners, joining it, and the
 * result of every ticket the connected wallet bought here. The chain draws ticket i of a join in
 * block `height + 2 + i`, so each join is checked on every new block (on a timer while the chain
 * feed is down) until all its tickets are drawn. Joins live in browser storage per wallet and T,
 * and work without it. Results nobody is watching also come as toasts; a win refreshes the
 * raffle and the next burn at once.
 */
export function useTokenRaffle(denom: string): TokenRaffle {
    const {address} = useChain(getChainName());
    const {asset} = useAsset(denom);
    const {updateBalances} = useAssetsContext();
    const {tx} = useBZETx();
    const {toast} = useToast();
    const {reload: reloadNextBurn} = useNextBurning();
    const {height, live, lastBlockAt} = useChainHeight();
    const [loaded, setLoaded] = useState<Loaded>();
    const [version, setVersion] = useState(0);

    // Entries belong to one wallet and T: a change of either reads that pair's entries from storage.
    const key = address ? storageKey(address, denom) : undefined;
    const restored = useMemo(() => readEntries(key), [key]);
    const [store, setStore] = useState<{ key: string; entries: RaffleEntry[] }>();
    const entries = useMemo(() => (key && store?.key === key ? store.entries : restored), [key, store, restored]);
    const keyRef = useRef(key);
    useEffect(() => {
        keyRef.current = key;
    }, [key]);

    /** Updates `forKey`'s entries; ignored once the wallet or T changed under an in-flight check or tx. */
    const setEntries = useCallback((forKey: string, update: (previous: RaffleEntry[]) => RaffleEntry[]) => {
        setStore((previous) => {
            if (forKey !== keyRef.current) return previous;

            const base = previous?.key === forKey ? previous.entries : restored;
            const next = update(base);
            return next === base ? previous : {key: forKey, entries: next};
        });
    }, [restored]);

    useEffect(() => {
        if (store) setInLocalStorage(store.key, serializeEntries(store.entries), TTL_NO_EXPIRY);
    }, [store]);

    // Results stay an hour after the last draw, then leave the page and storage.
    useEffect(() => {
        if (!key) return;

        const id = setInterval(() => {
            const now = Date.now();
            setEntries(key, (previous) => {
                const kept = previous.filter((entry) => !isEntryExpired(entry, now));
                return kept.length === previous.length ? previous : kept;
            });
        }, EXPIRY_CHECK_MS);

        return () => clearInterval(id);
    }, [key, setEntries]);

    useEffect(() => {
        let current = true;
        // A failed read keeps the last good raffle (or keeps loading); the next draw reads it again.
        loadRaffle(denom).then((result) => {
            if (current) setLoaded(result);
        }).catch((error) => console.error("raffle: reading the raffle failed", error));

        return () => {
            current = false;
        };
    }, [denom, version]);

    const reload = useCallback(() => setVersion((value) => value + 1), []);

    // A check reads what it needs when it runs, so a refresh of the asset, the balances or the
    // entries never cancels one in flight; it only re-applies to the wallet and T it started for.
    const latest = useRef({address, key, denom, entries, asset, toast, reload, reloadNextBurn, updateBalances, setEntries});
    useEffect(() => {
        latest.current = {address, key, denom, entries, asset, toast, reload, reloadNextBurn, updateBalances, setEntries};
    });

    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // One check at a time; a block that arrives meanwhile asks for one more run after it.
    const checking = useRef(false);
    const again = useRef(false);

    const check = useCallback(async () => {
        if (checking.current) {
            again.current = true;
            return;
        }
        checking.current = true;
        try {
            do {
                again.current = false;
                await checkOnce(latest, mounted);
            } while (again.current);
        } finally {
            checking.current = false;
        }
    }, []);

    const hasPending = entries.some((entry) => !isEntryResolved(entry));

    // With the feed down, or live but bringing no block, a timer stands in for new blocks.
    useEffect(() => {
        if (!key || !hasPending) return;

        const id = setInterval(() => {
            const heard = lastBlockAt.current;
            if (live && heard !== undefined && Date.now() - heard < BLOCK_STALL_MS) return;

            void check();
        }, RAFFLE_POLL_MS);
        return () => clearInterval(id);
    }, [key, hasPending, live, check, lastBlockAt]);

    // Each new block may have drawn the next ticket.
    useEffect(() => {
        if (live && height !== undefined) void check();
    }, [height, live, check]);

    const join = useCallback(async (tickets: number) => {
        if (!address || !key) return undefined;

        let height: number | undefined;
        const ok = await tx([joinRaffle({creator: address, denom, tickets: BigInt(tickets)})], {
            onSuccess: (result) => {
                height = result.height;
            },
        });
        // A join needs the block it was included in: its tickets are drawn from `height + 2` on.
        if (!ok || height === undefined || !Number.isSafeInteger(height) || height <= 0) return undefined;

        const entry = newRaffleEntry(`${height}-${Date.now()}`, height, tickets);
        setEntries(key, (previous) => [...previous, entry]);
        updateBalances();
        reload();

        return entry.id;
    }, [address, key, denom, tx, updateBalances, reload, setEntries]);

    const watch = useCallback((id: string, watched: boolean) => {
        if (key) setEntries(key, (previous) => previous.map((entry) => (entry.id === id ? {...entry, watched} : entry)));
    }, [key, setEntries]);

    const data = loaded?.denom === denom ? loaded : undefined;

    return {
        isLoading: data === undefined,
        raffle: data?.raffle,
        winners: data?.winners ?? [],
        entries,
        height,
        join,
        watch,
    };
}
