'use client';

import {useCallback, useMemo, useState} from "react";
import {useInfiniteQuery, useQueries} from "@tanstack/react-query";

import {
    activityRow,
    type ActivityRow,
    type ActivityToken,
    groupTransfers,
    type ScanClient,
    type ScanPage,
    type ScanTransfer,
    type ScanTx,
} from "@/lib/token-activity";

import {scanKeys, scanRetry} from "./queries";
import {useScanClient} from "./scan-client";

export interface TokenActivityOptions {
    /** Rows wanted at first, and how many more each `loadMore` asks for. */
    rows?: number;
    /** Transfer rows read per Scan page (100 at most). */
    pageSize?: number;
}

export interface TokenActivity {
    rows: ActivityRow[];
    /** Nothing to show yet. */
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

// Scan pages read for one page of rows at most, so a token whose history is nothing but
// block-level rows can't keep the loop going.
const MAX_SCAN_PAGES = 10;

/**
 * One page of rows: Scan transfer pages from `cursor` until they hold `rows` complete
 * transactions (block-level rows can fill whole Scan pages), or Scan has no more.
 */
async function readRows(
    client: ScanClient,
    denom: string,
    cursor: string | null,
    {rows, pageSize}: { rows: number; pageSize: number },
    signal: AbortSignal,
): Promise<ScanPage<ScanTransfer>> {
    const items: ScanTransfer[] = [];
    let next = cursor;
    for (let read = 0; read < MAX_SCAN_PAGES; read++) {
        const page = await client.tokenTransfers(denom, {cursor: next, limit: pageSize}, signal);
        items.push(...page.items);
        next = page.next_cursor;
        if (!next || groupTransfers(items, true).length >= rows) break;
    }

    return {items, next_cursor: next};
}

/**
 * The token's Activity: one row per transaction (see lib/token-activity/rows.ts), newest first.
 * Each row's transaction is read for its fee, signer and message count; the row shows at once
 * and fills in when it arrives.
 */
export function useTokenActivity(token: ActivityToken | undefined, {rows: step = 25, pageSize = 100}: TokenActivityOptions = {}): TokenActivity {
    const client = useScanClient();
    const denom = token?.denom ?? "";
    const [wanted, setWanted] = useState(step);

    const transfers = useInfiniteQuery({
        queryKey: scanKeys.tokenActivity(denom, pageSize, step),
        queryFn: ({pageParam, signal}) => readRows(client, denom, pageParam, {rows: step, pageSize}, signal),
        initialPageParam: null as string | null,
        getNextPageParam: (last: ScanPage<ScanTransfer>) => last.next_cursor ?? undefined,
        enabled: Boolean(denom),
        retry: scanRetry,
    });
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

    const loadMore = useCallback(() => {
        const next = wanted + step;
        setWanted(next);
        if (groups.length < next && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, [wanted, step, groups.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
    const retry = useCallback(() => {
        if (isFetchNextPageError) void fetchNextPage();
        else void refetch();
    }, [isFetchNextPageError, fetchNextPage, refetch]);

    const isError = transfers.isError && !data;

    return {
        rows,
        isLoading: Boolean(token) && transfers.isPending && !isError,
        isError,
        isLoadingMore: isFetchingNextPage,
        isLoadMoreError: isFetchNextPageError,
        hasMore: groups.length > wanted || hasNextPage,
        loadMore,
        retry,
    };
}
