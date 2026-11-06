'use client';

import {useMemo} from "react";

import {useScanAccountActivity} from "@/hooks/token-activity";
import type {ActivityRow, ActivityToken} from "@/lib/token-activity";
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
 * (`/accounts/{address}/activity?denom=`), 25 a page. The rows come from the activity items
 * alone; no transaction is read per row.
 */
export function useHolderActivity(address: string, token: ActivityToken | undefined): HolderActivity {
    const activity = useScanAccountActivity(address, token?.denom);
    const {data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch} = activity;

    const rows = useMemo(() => {
        if (!token) return [];
        return (data?.pages ?? [])
            .flatMap((page) => page.items)
            .map((item) => holderActivityRow(item, token, address))
            .filter((row): row is ActivityRow => Boolean(row));
    }, [data, token, address]);

    return {
        rows,
        isLoading: Boolean(token) && activity.isPending,
        isError: activity.isError && !data,
        isLoadingMore: isFetchingNextPage,
        isLoadMoreError: isFetchNextPageError,
        hasMore: Boolean(hasNextPage),
        loadMore: () => void fetchNextPage(),
        retry: () => void (isFetchNextPageError ? fetchNextPage() : refetch()),
    };
}
