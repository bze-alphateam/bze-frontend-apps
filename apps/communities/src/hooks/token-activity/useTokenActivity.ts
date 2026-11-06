'use client';

import {useCallback, useEffect, useMemo, useState} from "react";
import {useQueries} from "@tanstack/react-query";

import {activityRow, type ActivityRow, type ActivityToken, groupTransfers, type ScanTx} from "@/lib/token-activity";

import {scanKeys, scanRetry, useScanTokenTransfers} from "./queries";
import {useScanClient} from "./scan-client";

export interface TokenActivityOptions {
    /** Rows wanted at first, and how many more each `loadMore` asks for. */
    rows?: number;
    /** Transfer rows read per Scan page (100 at most). */
    pageSize?: number;
}

export interface TokenActivity {
    rows: ActivityRow[];
    /** Nothing to show yet: the first page, or more pages before the first complete transaction. */
    isLoading: boolean;
    /** The first read failed; nothing to show. */
    isError: boolean;
    /** Reading the rows after those shown. */
    isLoadingMore: boolean;
    /** Reading more rows failed; the rows shown stay. */
    isLoadMoreError: boolean;
    /** More rows exist after those shown. */
    hasMore: boolean;
    loadMore: () => void;
    /** Reads again what failed. */
    retry: () => void;
}

/**
 * The token's Activity: one row per transaction (see lib/token-activity/rows.ts), newest first.
 * Scan pages by transfer row, so pages are read until `rows` complete transactions are loaded
 * (block-level rows can fill a whole page). Each row's transaction is read for its fee, signer
 * and message count; the row shows at once and fills in when it arrives.
 */
export function useTokenActivity(token: ActivityToken | undefined, {rows: step = 25, pageSize = 100}: TokenActivityOptions = {}): TokenActivity {
    const client = useScanClient();
    const [wanted, setWanted] = useState(step);
    const transfers = useScanTokenTransfers(token?.denom, pageSize);
    const {data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch} = transfers;

    const groups = useMemo(
        () => groupTransfers(data?.pages.flatMap((page) => page.items) ?? [], hasNextPage),
        [data, hasNextPage],
    );
    const shown = useMemo(() => groups.slice(0, wanted), [groups, wanted]);

    const txQueries = useQueries({
        queries: shown.map((group) => ({
            queryKey: scanKeys.tx(group.txHash),
            queryFn: ({signal}: { signal: AbortSignal }) => client.tx(group.txHash, signal),
            // A committed transaction never changes.
            staleTime: Infinity,
            retry: scanRetry,
        })),
    });
    const txs = useMemo(() => {
        const map = new Map<string, ScanTx>();
        for (const query of txQueries) if (query.data) map.set(query.data.hash.toUpperCase(), query.data);
        return map;
    }, [txQueries]);

    const rows = useMemo(
        () => (token ? shown.map((group) => activityRow(group, txs.get(group.txHash.toUpperCase()), token)) : []),
        [shown, txs, token],
    );

    const needsPage = groups.length < wanted && hasNextPage && !isFetchingNextPage && !isFetchNextPageError;
    useEffect(() => {
        if (needsPage) void fetchNextPage();
    }, [needsPage, fetchNextPage]);

    const loadMore = useCallback(() => setWanted((current) => current + step), [step]);
    const retry = useCallback(() => {
        if (isFetchNextPageError) void fetchNextPage();
        else void refetch();
    }, [isFetchNextPageError, fetchNextPage, refetch]);

    const isError = transfers.isError && !data;
    const isLoadingMore = !isError && (isFetchingNextPage || needsPage);

    return {
        rows,
        isLoading: Boolean(token) && (transfers.isPending || (rows.length === 0 && isLoadingMore)),
        isError,
        isLoadingMore,
        isLoadMoreError: isFetchNextPageError,
        hasMore: groups.length > wanted || hasNextPage,
        loadMore,
        retry,
    };
}
