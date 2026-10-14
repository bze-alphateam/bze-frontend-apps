'use client';

import {useCallback, useEffect, useState} from "react";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {bze} from "@bze/bzejs";
import type {RaffleSDKType, RaffleWinnerSDKType} from "@bze/bzejs/bze/burner/raffle";
import {
    checkAddressWonRaffle,
    getChainName,
    getRaffles,
    getRaffleWinners,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetsContext,
    useBZETx,
    useToast,
} from "@bze/bze-ui-kit";

import {
    entrySummary,
    isEntryResolved,
    newRaffleEntry,
    type RaffleEntry,
    recentWinners,
    resolveEntry,
} from "@/lib/token-site/raffle";
import {walletAmount} from "@/lib/token-site/wallet";

const {joinRaffle} = bze.burner.MessageComposer.withTypeUrl;

/** Blocks come every ~6 s; a ticket is drawn per block, so check a little slower than that. */
export const RAFFLE_POLL_MS = 7_000;

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
    /** Joins made on this page, oldest first. */
    entries: RaffleEntry[];
    /** Buys `tickets` tickets; resolves to the new entry's id, or undefined when the tx failed. */
    join: (tickets: number) => Promise<string | undefined>;
    /** Whether an entry's result view is open; unwatched entries report through toasts. */
    watch: (id: string, watched: boolean) => void;
}

async function loadRaffle(denom: string): Promise<Loaded> {
    const raffle = (await getRaffles()).find((candidate) => candidate.denom === denom);
    const winners = raffle ? recentWinners(await getRaffleWinners(denom), raffle.winners) : [];

    return {denom, raffle, winners};
}

/**
 * T's burn raffle (Business Logic R11): the raffle and its latest winners, joining it, and the
 * result of every ticket bought on this page. The chain draws ticket i of a join in block
 * `height + 2 + i`, so each join is checked block by block until all its tickets are drawn
 * (the burner app's pending-contribution logic). Results nobody is watching come as toasts.
 */
export function useTokenRaffle(denom: string): TokenRaffle {
    const {address} = useChain(getChainName());
    const {asset} = useAsset(denom);
    const {updateBalances} = useAssetsContext();
    const {tx} = useBZETx();
    const {toast} = useToast();
    const [loaded, setLoaded] = useState<Loaded>();
    const [version, setVersion] = useState(0);
    const [entries, setEntries] = useState<RaffleEntry[]>([]);

    useEffect(() => {
        let current = true;
        void loadRaffle(denom).then((result) => {
            if (current) setLoaded(result);
        });

        return () => {
            current = false;
        };
    }, [denom, version]);

    const reload = useCallback(() => setVersion((value) => value + 1), []);

    // Draws resolve one block at a time; each change re-arms the poll with the latest entries.
    useEffect(() => {
        const pending = entries.filter((entry) => !isEntryResolved(entry));
        if (!address || pending.length === 0) return;

        const ticker = asset?.ticker ?? denom;
        const amount = (uAmount: BigNumber) => `${walletAmount(uAmountToBigNumberAmount(uAmount, asset?.decimals ?? 0))} ${ticker}`;
        const report = (before: RaffleEntry, after: RaffleEntry) => {
            if (after.watched) return;
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
        };

        let current = true;
        const poll = async () => {
            const resolved = await Promise.all(pending.map((entry) => resolveEntry(entry, (height) => checkAddressWonRaffle(address, denom, height))));
            if (!current) return;

            const changed = resolved.filter((entry, index) => entry !== pending[index]);
            if (changed.length === 0) return;

            changed.forEach((entry) => report(pending.find((before) => before.id === entry.id) ?? entry, entry));
            setEntries((previous) => previous.map((entry) => {
                const update = changed.find((candidate) => candidate.id === entry.id);
                return update ? {...update, watched: entry.watched} : entry;
            }));
            // Every draw moves the pot, and a win adds a winner.
            reload();
            if (changed.some((entry) => entry.results.some((result) => result.won))) updateBalances();
        };
        const id = setInterval(() => void poll(), RAFFLE_POLL_MS);

        return () => {
            current = false;
            clearInterval(id);
        };
    }, [entries, address, denom, asset, toast, reload, updateBalances]);

    const join = useCallback(async (tickets: number) => {
        if (!address) return undefined;

        let height: number | undefined;
        const ok = await tx([joinRaffle({creator: address, denom, tickets: BigInt(tickets)})], {
            onSuccess: (result) => {
                height = result.height;
            },
        });
        if (!ok || height === undefined) return undefined;

        const entry = newRaffleEntry(`${height}-${Date.now()}`, height, tickets);
        setEntries((previous) => [...previous, entry]);
        updateBalances();
        reload();

        return entry.id;
    }, [address, denom, tx, updateBalances, reload]);

    const watch = useCallback((id: string, watched: boolean) => {
        setEntries((previous) => previous.map((entry) => (entry.id === id ? {...entry, watched} : entry)));
    }, []);

    const data = loaded?.denom === denom ? loaded : undefined;

    return {
        isLoading: data === undefined,
        raffle: data?.raffle,
        winners: data?.winners ?? [],
        entries,
        join,
        watch,
    };
}
