'use client';

import {useMemo} from "react";
import {useInfiniteQuery, useQuery} from "@tanstack/react-query";

import {ScanError, type ScanPage} from "@/lib/token-activity";

import {useScanClient} from "./scan-client";

// React Query reads of BZE Scan for the token site. The QueryClient is ui-kit's (EvmProvider):
// 60 s stale time, no refetch on focus. Lists page by Scan's cursor (`useInfiniteQuery`).

export const scanKeys = {
    all: ["scan"] as const,
    token: (denom: string) => ["scan", "token", denom] as const,
    tokenTransfers: (denom: string, limit: number) => ["scan", "token", denom, "transfers", limit] as const,
    /** `useTokenActivity`'s pages: Scan transfer pages read until `rows` complete transactions. */
    tokenActivity: (denom: string, limit: number, rows: number) => ["scan", "token", denom, "activity", limit, rows] as const,
    tokenEvents: (denom: string, limit: number) => ["scan", "token", denom, "events", limit] as const,
    tokenHolders: (denom: string, limit: number) => ["scan", "token", denom, "holders", limit] as const,
    account: (address: string) => ["scan", "account", address] as const,
    accountActivity: (address: string, denom: string, limit: number) => ["scan", "account", address, "activity", denom, limit] as const,
    tx: (hash: string) => ["scan", "tx", hash.toUpperCase()] as const,
    modules: () => ["scan", "modules"] as const,
};

/** Retry a failed read twice, never a 400 or 404: Scan's answer won't change. */
export const scanRetry = (failures: number, error: Error): boolean =>
    !(error instanceof ScanError && (error.status === 400 || error.status === 404)) && failures < 2;

const pageOptions = {
    initialPageParam: null as string | null,
    getNextPageParam: (last: ScanPage<unknown>) => last.next_cursor ?? undefined,
    retry: scanRetry,
};

/** The token's stats: holders_count, transfers_24h, supply, created_time, its last 20 events… */
export function useScanToken(denom: string | undefined) {
    const client = useScanClient();
    return useQuery({
        queryKey: scanKeys.token(denom ?? ""),
        queryFn: ({signal}) => client.token(denom!, signal),
        enabled: Boolean(denom),
        retry: scanRetry,
    });
}

/** Every indexed move of the token, newest first, `limit` rows a page. */
export function useScanTokenTransfers(denom: string | undefined, limit = 100) {
    const client = useScanClient();
    return useInfiniteQuery({
        queryKey: scanKeys.tokenTransfers(denom ?? "", limit),
        queryFn: ({pageParam, signal}) => client.tokenTransfers(denom!, {cursor: pageParam, limit}, signal),
        enabled: Boolean(denom),
        ...pageOptions,
    });
}

/** The token's events (the History tab), newest first. */
export function useScanTokenEvents(denom: string | undefined, limit = 25) {
    const client = useScanClient();
    return useInfiniteQuery({
        queryKey: scanKeys.tokenEvents(denom ?? "", limit),
        queryFn: ({pageParam, signal}) => client.tokenEvents(denom!, {cursor: pageParam, limit}, signal),
        enabled: Boolean(denom),
        ...pageOptions,
    });
}

/** The last holders snapshot, largest balance first. */
export function useScanTokenHolders(denom: string | undefined, limit = 25) {
    const client = useScanClient();
    return useInfiniteQuery({
        queryKey: scanKeys.tokenHolders(denom ?? "", limit),
        queryFn: ({pageParam, signal}) => client.tokenHolders(denom!, {cursor: pageParam, limit}, signal),
        enabled: Boolean(denom),
        ...pageOptions,
    });
}

/** An account: what Scan indexed plus the node's live balances, staking and rewards. */
export function useScanAccount(address: string | undefined) {
    const client = useScanClient();
    return useQuery({
        queryKey: scanKeys.account(address ?? ""),
        queryFn: ({signal}) => client.account(address!, signal),
        enabled: Boolean(address),
        retry: scanRetry,
    });
}

/** What each transaction or block did to the address, newest first; with `denom`, only the rows moving it. */
export function useScanAccountActivity(address: string | undefined, denom?: string, limit = 25) {
    const client = useScanClient();
    return useInfiniteQuery({
        queryKey: scanKeys.accountActivity(address ?? "", denom ?? "", limit),
        queryFn: ({pageParam, signal}) => client.accountActivity(address!, {denom, cursor: pageParam, limit}, signal),
        enabled: Boolean(address),
        ...pageOptions,
    });
}

/** A transaction; a 404 (`error.isNotFound`) means Scan hasn't indexed it yet. */
export function useScanTx(hash: string | undefined) {
    const client = useScanClient();
    return useQuery({
        queryKey: scanKeys.tx(hash ?? ""),
        queryFn: ({signal}) => client.tx(hash!, signal),
        enabled: Boolean(hash),
        retry: scanRetry,
    });
}

/** The module accounts Scan names. */
export function useScanModules() {
    const client = useScanClient();
    return useQuery({
        queryKey: scanKeys.modules(),
        queryFn: ({signal}) => client.modules(signal),
        staleTime: 60 * 60_000,
        retry: scanRetry,
    });
}

/** Module address → module name ("Burner", "DEX"); empty until read. */
export function useModuleNames(): ReadonlyMap<string, string> {
    const {data} = useScanModules();
    return useMemo(() => new Map((data?.items ?? []).map((m) => [m.address, m.name])), [data]);
}
