'use client';

import React from "react";
import {chakra} from "@chakra-ui/react";
import {LuArrowRight} from "react-icons/lu";
import type {Asset} from "@bze/bze-ui-kit";

import {useScanToken, useTokenActivity} from "@/hooks/token-activity";
import {ACTIVITY_SECTION_ID, type ScanToken, tokenActivityPath} from "@/lib/token-activity";

import {TsCard, TsLinkButton, TsSection} from "../kit";
import {ActivityRow, ActivityRowSkeleton} from "./activity-row";
import {ActivityEmpty, ActivityError} from "./activity-states";

/** Rows the token page shows before "See all activity". */
export const SNIPPET_ROWS = 5;

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "8 holders · 9 transfers in the last 24 hours" (holders only once Scan has a snapshot). */
export function activityPulse(token: Pick<ScanToken, "holders_count" | "transfers_24h">): string {
    return [
        ...(token.holders_count !== null ? [count(token.holders_count, "holder", "holders")] : []),
        `${count(token.transfers_24h.count, "transfer", "transfers")} in the last 24 hours`,
    ].join(" · ");
}

/**
 * "Activity · T right now" on the token page: its last few transactions from BZE Scan (one row
 * per transaction, with the fee it paid), then a link to the Activity page.
 */
export function ActivitySnippet({asset}: { asset: Asset }) {
    const token = {denom: asset.denom, symbol: asset.ticker, exponent: asset.decimals};
    const activity = useTokenActivity(token, {rows: SNIPPET_ROWS});
    const {data: stats} = useScanToken(asset.denom);
    const rows = activity.rows.slice(0, SNIPPET_ROWS);

    return (
        <TsSection
            id={ACTIVITY_SECTION_ID}
            eyebrow="Activity"
            title={`${asset.ticker} right now`}
            description={stats ? activityPulse(stats) : undefined}
            action={
                <TsLinkButton variant="ghost" href={tokenActivityPath(asset.denom)} borderRadius="12px" px="20px">
                    See all activity
                    <chakra.span aria-hidden="true" display="inline-flex"><LuArrowRight size={14}/></chakra.span>
                </TsLinkButton>
            }
        >
            {activity.isError ? (
                <ActivityError symbol={asset.ticker} onRetry={activity.retry}/>
            ) : activity.isLoading ? (
                <TsCard overflow="hidden" aria-busy="true" aria-label={`Loading ${asset.ticker} activity`}>
                    {Array.from({length: SNIPPET_ROWS}, (_, i) => <ActivityRowSkeleton key={i} first={i === 0}/>)}
                </TsCard>
            ) : rows.length === 0 ? (
                <ActivityEmpty symbol={asset.ticker}/>
            ) : (
                <TsCard overflow="hidden" role="list" aria-label={`Latest ${asset.ticker} activity`}>
                    {rows.map((row, i) => <ActivityRow key={row.txHash} row={row} token={token} first={i === 0}/>)}
                </TsCard>
            )}
        </TsSection>
    );
}
