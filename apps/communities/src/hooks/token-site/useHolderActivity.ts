'use client';

import {useMemo} from "react";
import {useQueries} from "@tanstack/react-query";

import {scanKeys, scanRetry, useScanAccountActivity, useScanClient} from "@/hooks/token-activity";
import type {ActivityRow, ActivityToken, ScanTx} from "@/lib/token-activity";
import {holderActivityRow} from "@/lib/token-activity/holder-rows";

export interface HolderActivity {
    rows: ActivityRow[];
    isLoading: boolean;
    isError: boolean;
    isLoadingMore: boolean;
    isLoadMoreError: boolean;
    hasMore: boolean;
    loadMore: () => void;
    retry: () => void;
}

/**
 * The holder page's activity: what each transaction did to the address's balance of the token
 * (`/accounts/{address}/activity?denom=`), 25 a page, each row's transaction read for its tag,
 * title and message count, like the Activity tab.
 */
export function useHolderActivity(address: string, token: ActivityToken | undefined): HolderActivity {
    const client = useScanClient();
    const activity = useScanAccountActivity(address, token?.denom);
    const {data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch} = activity;

    const items = useMemo(() => (data?.pages ?? []).flatMap((page) => page.items).filter((item) => item.tx_hash), [data]);
    const txQueries = useQueries({
        queries: items.map((item) => ({
            queryKey: scanKeys.tx(item.tx_hash!),
            queryFn: ({signal}: { signal: AbortSignal }) => client.tx(item.tx_hash!, signal),
            staleTime: Infinity,
            retry: scanRetry,
        })),
    });
    const txs = useMemo(() => {
        const map = new Map<string, ScanTx>();
        for (const query of txQueries) if (query.data) map.set(query.data.hash.toUpperCase(), query.data);
        return map;
    }, [txQueries]);

    const rows = useMemo(() => {
        if (!token) return [];
        return items
            .map((item) => holderActivityRow(item, txs.get(item.tx_hash!.toUpperCase()), token, address))
            .filter((row): row is ActivityRow => Boolean(row));
    }, [items, txs, token, address]);

    const isError = activity.isError && !data;

    return {
        rows,
        isLoading: Boolean(token) && activity.isPending,
        isError,
        isLoadingMore: isFetchingNextPage,
        isLoadMoreError: isFetchNextPageError,
        hasMore: Boolean(hasNextPage),
        loadMore: () => void fetchNextPage(),
        retry: () => void (isFetchNextPageError ? fetchNextPage() : refetch()),
    };
}
