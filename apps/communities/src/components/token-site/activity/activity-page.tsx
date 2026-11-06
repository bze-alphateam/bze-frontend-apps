'use client';

import React, {Suspense, useMemo, useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {type Asset, DEFAULT_DENOM_BRANDING, isIbcDenom, useAssets} from "@bze/bze-ui-kit";

import {useScanToken, useScanTokenEvents, useScanTokenHolders, useTokenActivity} from "@/hooks/token-activity";
import {useSupplySplit} from "@/hooks/token-site/useSupplySplit";
import {tokenPagePath, useDenomParam} from "@/hooks/useNavigation";
import {formatUnits, type ScanToken, tokenHolderPath, tokenTxPath} from "@/lib/token-activity";

import {TokenSiteTheme, TsCard, ts} from "../kit";
import {ActivityRow, ActivityRowSkeleton} from "./activity-row";
import {ActivityEmpty, ActivityError} from "./activity-states";
import {HistoryTimeline} from "./history-timeline";
import {HoldersTable} from "./holders-table";
import {InnerHero, InnerSite} from "./inner-site";
import {EmptyCard, ErrorCard, InsetNote, type InnerStat, LoadMore, PillTabs, Shimmer, StatGrid, StatsSkeleton, TabPanel} from "./parts";
import {SupplySplitCard} from "./supply-split-card";

type ActivityTab = "activity" | "holders" | "history";

/** Rows the Activity tab shows at first, and adds on each "Load more". */
const ACTIVITY_ROWS = 25;

const count = (n: number) => n.toLocaleString("en-US");

const createdDate = (time: string | null): string | undefined => {
    if (!time) return undefined;
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return undefined;

    return new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"}).format(date);
};

/**
 * The header's five numbers: holders, transfers and amount moved in 24 hours, then the supply and
 * the creation date of a factory token, or what came over and where from for an IBC token.
 */
export function activityStats(token: ScanToken, ticker: string, exponent: number, ibc: boolean): InnerStat[] {
    const supply = token.supply ? `${formatUnits(token.supply, exponent)} ${ticker}` : "—";
    const stats: InnerStat[] = [
        {
            id: "holders",
            label: "Holders",
            value: token.holders_count === null ? "—" : count(token.holders_count),
            note: token.holders_count === null ? "after the next snapshot" : `own 1 ${ticker} or more`,
        },
        {id: "transfers", label: "Transfers · 24h", value: count(token.transfers_24h.count), note: "token moves"},
        {id: "moved", label: "Moved · 24h", value: `${formatUnits(token.transfers_24h.amount, exponent)} ${ticker}`, note: "summed over those moves"},
    ];
    if (ibc) {
        const chain = token.origin_chain?.name ?? token.origin_chain?.chain_id ?? "Another chain";
        return [
            ...stats,
            {id: "supply", label: "On BeeZee", value: supply, note: "brought over so far"},
            {id: "origin", label: "Comes from", value: chain, note: "cross-chain token"},
        ];
    }

    const created = createdDate(token.created_time);
    return [
        ...stats,
        {id: "supply", label: "Supply", value: supply, note: token.admin ? "admin can still mint" : "fixed: no admin"},
        {id: "created", label: "Created", value: created ?? "—", note: created ? "on BeeZee" : "not indexed yet"},
    ];
}

function ActivityTabPanel({asset}: { asset: Asset }) {
    const token = useMemo(() => ({denom: asset.denom, symbol: asset.ticker, exponent: asset.decimals}), [asset]);
    const activity = useTokenActivity(token, {rows: ACTIVITY_ROWS});

    return (
        <TabPanel value="activity" gap="14px">
            <chakra.span fontSize="14px" color={ts.muted}>Newest first. One row per transaction, with the network fee it paid.</chakra.span>
            {activity.isError ? (
                <ActivityError symbol={asset.ticker} onRetry={activity.retry}/>
            ) : activity.isLoading ? (
                <TsCard overflow="hidden" aria-busy="true" aria-label={`Loading ${asset.ticker} activity`}>
                    {Array.from({length: 5}, (_, i) => <ActivityRowSkeleton key={i} first={i === 0}/>)}
                </TsCard>
            ) : activity.rows.length === 0 ? (
                <ActivityEmpty symbol={asset.ticker}/>
            ) : (
                <>
                    <TsCard overflow="hidden" role="list" aria-label={`${asset.ticker} activity`}>
                        {activity.rows.map((row, i) => <ActivityRow key={row.txHash} row={row} token={token} first={i === 0}/>)}
                    </TsCard>
                    <LoadMore
                        hasMore={activity.hasMore}
                        isLoading={activity.isLoadingMore}
                        hasError={activity.isLoadMoreError}
                        onLoadMore={activity.isLoadMoreError ? activity.retry : activity.loadMore}
                    />
                </>
            )}
        </TabPanel>
    );
}

function HoldersTabPanel({asset, token}: { asset: Asset; token: ScanToken }) {
    const holders = useScanTokenHolders(asset.denom);
    const firstPage = holders.data?.pages[0]?.items;
    const split = useSupplySplit(asset.denom, token.supply, firstPage);
    const list = useMemo(() => (holders.data?.pages ?? []).flatMap((page) => page.items), [holders.data]);
    const supplyText = token.supply ? `${formatUnits(token.supply, asset.decimals)} ${asset.ticker}` : "";
    const rows = useMemo(() => list.map((holder) => ({
        rank: holder.rank,
        address: holder.address,
        label: holder.label,
        balance: formatUnits(holder.balance, asset.decimals),
        share: holder.share_pct === null ? null : Number(holder.share_pct),
    })), [list, asset.decimals]);

    if (token.holders_count === null) {
        return (
            <TabPanel value="holders" gap="20px">
                <InsetNote>Holders appear after the next hourly snapshot.</InsetNote>
            </TabPanel>
        );
    }

    return (
        <TabPanel value="holders" gap="20px">
            {split.isError ? (
                <ErrorCard onRetry={split.retry}>Couldn&apos;t work out where the {asset.ticker} is. BZE Scan or the node didn&apos;t answer.</ErrorCard>
            ) : split.parts ? (
                <SupplySplitCard parts={split.parts} ticker={asset.ticker} decimals={asset.decimals} supplyText={supplyText}/>
            ) : (
                <Shimmer h="220px" borderRadius="16px" data-testid="supply-split-loading"/>
            )}

            {holders.isError && !holders.data ? (
                <ErrorCard onRetry={() => void holders.refetch()}>Couldn&apos;t load the {asset.ticker} holders. BZE Scan didn&apos;t answer.</ErrorCard>
            ) : holders.isPending ? (
                <Shimmer h="320px" borderRadius="16px" data-testid="holders-loading"/>
            ) : rows.length === 0 ? (
                <EmptyCard title="No holders yet">Nobody holds {asset.ticker} in the last snapshot.</EmptyCard>
            ) : (
                <>
                    <HoldersTable rows={rows} creator={token.creator} holderHref={(address) => tokenHolderPath(asset.denom, address)}/>
                    <LoadMore
                        hasMore={holders.hasNextPage}
                        isLoading={holders.isFetchingNextPage}
                        hasError={holders.isFetchNextPageError}
                        onLoadMore={() => void holders.fetchNextPage()}
                    />
                    {!holders.hasNextPage && (
                        <chakra.span fontSize="13px" color={ts.muted}>
                            {`All ${count(rows.length)} accounts of the snapshot shown. “Holders” counts owners of 1 ${asset.ticker} or more (${count(token.holders_count)}).`}
                        </chakra.span>
                    )}
                </>
            )}
        </TabPanel>
    );
}

function HistoryTabPanel({asset}: { asset: Asset }) {
    const events = useScanTokenEvents(asset.denom);
    const {denomTicker} = useAssets();
    const list = useMemo(() => (events.data?.pages ?? []).flatMap((page) => page.items), [events.data]);
    const context = useMemo(() => ({
        ticker: asset.ticker,
        decimals: asset.decimals,
        tickerOf: (denom: string) => (denom === asset.denom ? asset.ticker : denomTicker(denom)),
    }), [asset, denomTicker]);

    return (
        <TabPanel value="history">
            {events.isError && !events.data ? (
                <ErrorCard onRetry={() => void events.refetch()}>Couldn&apos;t load the {asset.ticker} history. BZE Scan didn&apos;t answer.</ErrorCard>
            ) : events.isPending ? (
                <Shimmer h="320px" borderRadius="16px" data-testid="history-loading"/>
            ) : list.length === 0 ? (
                <EmptyCard title="No history indexed yet">Changes to {asset.ticker} (its admin, details, brand kit, new pools) show up here.</EmptyCard>
            ) : (
                <HistoryTimeline
                    events={list}
                    denom={asset.denom}
                    context={context}
                    txHref={(hash) => tokenTxPath(asset.denom, hash)}
                    footer={events.hasNextPage || events.isFetchNextPageError ? (
                        <Flex direction="column" pl="30px">
                            <LoadMore hasMore={events.hasNextPage} isLoading={events.isFetchingNextPage} hasError={events.isFetchNextPageError} onLoadMore={() => void events.fetchNextPage()}/>
                        </Flex>
                    ) : (
                        <chakra.span fontSize="14px" color={ts.muted} pl="30px">Earlier history isn&apos;t indexed yet.</chakra.span>
                    )}
                />
            )}
        </TabPanel>
    );
}

function ActivityContent({asset}: { asset: Asset }) {
    const ibc = isIbcDenom(asset.denom);
    const stats = useScanToken(asset.denom);
    const [picked, setPicked] = useState<ActivityTab>("activity");
    // IBC tokens have no History (their events live on their own chain).
    const tab = ibc && picked === "history" ? "activity" : picked;

    const tabs = [
        {value: "activity" as const, label: "Activity"},
        {value: "holders" as const, label: "Holders", count: typeof stats.data?.holders_count === "number" ? count(stats.data.holders_count) : undefined},
        ...(ibc ? [] : [{value: "history" as const, label: "History"}]),
    ];

    return (
        <>
            <InnerHero
                back={{href: tokenPagePath(asset.denom), label: asset.name}}
                eyebrow={`${asset.ticker} · Activity`}
                titleId="activity-title"
                title={
                    <chakra.h1 id="activity-title" m="0" fontSize={{base: "30px", md: "36px"}} lineHeight="1.1" fontWeight={800} letterSpacing="-0.02em">
                        What&apos;s happening with {asset.ticker}
                    </chakra.h1>
                }
            >
                <chakra.p m="0" fontSize="16px" lineHeight="1.55" color={ts.muted} maxW="620px">
                    Every transaction that moves {asset.ticker}, straight from the BeeZee blockchain.
                </chakra.p>
            </InnerHero>

            {stats.isError ? (
                <ErrorCard onRetry={() => void stats.refetch()}>Couldn&apos;t load the {asset.ticker} numbers. BZE Scan didn&apos;t answer.</ErrorCard>
            ) : stats.data ? (
                <StatGrid stats={activityStats(stats.data, asset.ticker, asset.decimals, ibc)}/>
            ) : (
                <StatsSkeleton/>
            )}

            <PillTabs label="Activity views" tabs={tabs} value={tab} onChange={setPicked}/>

            {tab === "activity" && <ActivityTabPanel asset={asset}/>}
            {tab === "holders" && stats.data && <HoldersTabPanel asset={asset} token={stats.data}/>}
            {tab === "holders" && stats.isPending && <TabPanel value="holders"><Shimmer h="220px" borderRadius="16px"/></TabPanel>}
            {tab === "history" && <HistoryTabPanel asset={asset}/>}
        </>
    );
}

function ActivityPageContent() {
    const denom = useDenomParam() ?? "";

    return <InnerSite denom={denom}>{(asset) => <ActivityContent asset={asset}/>}</InnerSite>;
}

/** `/token/activity?denom=`: the token's own explorer (Activity, Holders, History) in its brand kit. */
export function ActivityPage() {
    return (
        <Suspense fallback={<TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><div/></TokenSiteTheme>}>
            <ActivityPageContent/>
        </Suspense>
    );
}
