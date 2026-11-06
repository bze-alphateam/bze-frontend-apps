'use client';

import React, {Suspense, useMemo} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {useSearchParams} from "next/navigation";
import BigNumber from "bignumber.js";
import {type Asset, DEFAULT_DENOM_BRANDING, useAssets} from "@bze/bze-ui-kit";

import {useScanAccount, useScanToken, useScanTokenHolders} from "@/hooks/token-activity";
import {useHolderActivity} from "@/hooks/token-site/useHolderActivity";
import {useHolderStakes} from "@/hooks/token-site/useHolderStakes";
import {useDenomParam} from "@/hooks/useNavigation";
import {formatUnits, shortAddress, tokenActivityPath} from "@/lib/token-activity";
import {type StakePosition, totalStaked} from "@/lib/token-activity/holder-stakes";
import {formatShare} from "@/lib/token-activity/supply-split";

import {TokenSiteTheme, TsCard, TsFeaturedCard, ts, tsLabel} from "../kit";
import {ActivityRow, ActivityRowSkeleton} from "./activity-row";
import {ActivityError} from "./activity-states";
import {holderTag, TagPill} from "./holders-table";
import {InnerHero, InnerSite} from "./inner-site";
import {CopyButton, EmptyCard, InsetNote, LoadMore, RetryNote, Shimmer} from "./parts";

/** "20 NOAD" in the token. */
const amountOf = (amount: BigNumber.Value, asset: Asset) => `${formatUnits(new BigNumber(amount), asset.decimals)} ${asset.ticker}`;

/** "96.43 % of the supply", "less than 0.01 % of the supply". */
export function supplyShareText(balance: BigNumber.Value, supply: BigNumber.Value | null | undefined): string | undefined {
    const total = new BigNumber(supply ?? 0);
    if (!total.gt(0)) return undefined;
    const share = formatShare(new BigNumber(balance).div(total).times(100).toNumber());

    return share === "< 0.01 %" ? "less than 0.01 % of the supply" : `${share} of the supply`;
}

function BalanceCard({asset, address, supply}: { asset: Asset; address: string; supply?: string | null }) {
    const account = useScanAccount(address);
    const balance = account.data?.balances.find((item) => item.denom === asset.denom)?.amount ?? "0";
    const unreadable = account.isError || account.data?.live.available === false;
    const share = supplyShareText(balance, supply);

    return (
        <TsFeaturedCard flex="1 1 340px" minW="0" p={{base: "18px", md: "24px 28px"}} display="flex" flexDirection="column" gap="10px" data-testid="holder-balance">
            <chakra.span {...tsLabel}>Balance</chakra.span>
            {unreadable ? (
                <RetryNote onRetry={() => void account.refetch()}>
                    Couldn&apos;t read the balance from the node. The activity below is still up to date.
                </RetryNote>
            ) : account.data ? (
                <>
                    <chakra.span fontSize={{base: "28px", md: "36px"}} fontWeight={800} letterSpacing="-0.02em" fontVariantNumeric="tabular-nums" overflowWrap="anywhere">
                        {amountOf(balance, asset)}
                    </chakra.span>
                    {share && <chakra.span fontSize="15px" color={ts.muted}>{share}</chakra.span>}
                </>
            ) : (
                <Shimmer h="40px" w="70%"/>
            )}
        </TsFeaturedCard>
    );
}

function PositionRow({position, asset}: { position: StakePosition; asset: Asset }) {
    const {denomTicker} = useAssets();
    const name = position.kind === "pool" ? "Holders pool" : `Program paying ${denomTicker(position.prizeDenom ?? "")}`;
    const note = position.kind === "pool" ? "shares every reward the pool pays" : "fixed-term program";
    const lock = position.lockDays > 0 ? `${position.lockDays}-day unlock` : "instant unlock";
    const unlocking = position.unlocking.gt(0) ? `${amountOf(position.unlocking, asset)} unlocking` : "nothing unlocking";

    return (
        <chakra.div display="grid" gridTemplateColumns="minmax(0, 1fr) auto" gap="4px 12px" py="12px" borderTopWidth="1px" borderTopStyle="solid" borderTopColor={ts.border} data-testid="holder-position">
            <chakra.span fontSize="16px" fontWeight={600}>{name}</chakra.span>
            <chakra.span fontSize="16px" fontWeight={700} fontVariantNumeric="tabular-nums" textAlign="right">{amountOf(position.staked, asset)}</chakra.span>
            <chakra.span fontSize="14px" color={ts.muted}>{note}</chakra.span>
            <chakra.span fontSize="14px" color={ts.muted} textAlign="right">{`${lock} · ${unlocking}`}</chakra.span>
        </chakra.div>
    );
}

function StakedCard({asset, address}: { asset: Asset; address: string }) {
    const stakes = useHolderStakes(asset.denom, address);

    return (
        <TsCard flex="999 1 480px" minW="0" p={{base: "18px", md: "24px 28px"}} display="flex" flexDirection="column" gap="14px" data-testid="holder-staked">
            <Flex justify="space-between" align="baseline" gap="12px" wrap="wrap">
                <chakra.span {...tsLabel}>Staked</chakra.span>
                {stakes.isLoading ? <Shimmer h="26px" w="120px"/> : (
                    <chakra.span fontSize="22px" fontWeight={700} fontVariantNumeric="tabular-nums">{amountOf(totalStaked(stakes.positions), asset)}</chakra.span>
                )}
            </Flex>
            {stakes.isLoading ? null : stakes.positions.length > 0 ? (
                <Flex direction="column">
                    {stakes.positions.map((position) => <PositionRow key={position.id} position={position} asset={asset}/>)}
                </Flex>
            ) : stakes.isError ? (
                <InsetNote>Couldn&apos;t read the staking positions from the node.</InsetNote>
            ) : (
                <InsetNote>Not staking {asset.ticker} in the holders pool or any program.</InsetNote>
            )}
        </TsCard>
    );
}

function HolderActivityList({asset, address}: { asset: Asset; address: string }) {
    const token = useMemo(() => ({denom: asset.denom, symbol: asset.ticker, exponent: asset.decimals}), [asset]);
    const activity = useHolderActivity(address, token);

    return (
        <Flex as="section" aria-labelledby="holder-activity-title" direction="column" gap="16px" pt="48px">
            <chakra.h2 id="holder-activity-title" m="0" fontSize="24px" fontWeight={700}>{asset.ticker} activity of this holder</chakra.h2>
            {activity.isError ? (
                <ActivityError symbol={asset.ticker} onRetry={activity.retry}/>
            ) : activity.isLoading ? (
                <TsCard overflow="hidden" aria-busy="true" aria-label={`Loading ${asset.ticker} activity`}>
                    {Array.from({length: 5}, (_, i) => <ActivityRowSkeleton key={i} first={i === 0}/>)}
                </TsCard>
            ) : activity.rows.length === 0 && !activity.hasMore ? (
                <EmptyCard title="No activity indexed yet">This address hasn&apos;t moved {asset.ticker} in any indexed transaction.</EmptyCard>
            ) : (
                <>
                    {activity.rows.length > 0 && (
                        <TsCard overflow="hidden" role="list" aria-label={`${asset.ticker} activity of this holder`}>
                            {activity.rows.map((row, i) => <ActivityRow key={row.txHash} row={row} token={token} first={i === 0} signed hideActor/>)}
                        </TsCard>
                    )}
                    <LoadMore hasMore={activity.hasMore} isLoading={activity.isLoadingMore} hasError={activity.isLoadMoreError} onLoadMore={activity.isLoadMoreError ? activity.retry : activity.loadMore}/>
                </>
            )}
        </Flex>
    );
}

function HolderContent({asset, address}: { asset: Asset; address: string }) {
    const {data: token} = useScanToken(asset.denom);
    const holders = useScanTokenHolders(asset.denom);
    const ranked = holders.data?.pages.flatMap((page) => page.items).find((holder) => holder.address === address);
    const tag = holderTag({address, label: ranked?.label ?? null}, token?.creator);
    const of = typeof token?.holders_count === "number" ? token.holders_count.toLocaleString("en-US") : undefined;
    const eyebrow = ranked && of ? `${asset.ticker} holder · #${ranked.rank} of ${of}` : `${asset.ticker} holder`;
    const name = ranked?.label?.name;

    return (
        <>
            <InnerHero
                back={{href: tokenActivityPath(asset.denom), label: `All ${asset.ticker} activity`}}
                eyebrow={eyebrow}
                titleId="holder-title"
                title={
                    <Flex align="center" gap="12px" wrap="wrap">
                        <chakra.h1 id="holder-title" m="0" fontFamily={name ? undefined : "'JetBrains Mono', monospace"} fontSize={{base: "26px", md: "36px"}} lineHeight="1.1" fontWeight={name ? 800 : 500} letterSpacing="-0.02em">
                            {name ?? shortAddress(address)}
                        </chakra.h1>
                        {tag && <TagPill creator={tag.creator}>{tag.text}</TagPill>}
                    </Flex>
                }
            >
                <Flex align="center" gap="10px" wrap="wrap">
                    <chakra.code fontFamily="'JetBrains Mono', monospace" fontSize="13px" px="12px" py="8px" borderRadius="10px" bg={ts.inset} overflowWrap="anywhere" minW="0">
                        {address}
                    </chakra.code>
                    <CopyButton value={address} label="Copy address"/>
                </Flex>
            </InnerHero>

            <Flex gap="16px" wrap="wrap" align="stretch">
                <BalanceCard asset={asset} address={address} supply={token?.supply}/>
                <StakedCard asset={asset} address={address}/>
            </Flex>

            <HolderActivityList asset={asset} address={address}/>
        </>
    );
}

function HolderPageContent() {
    const denom = useDenomParam() ?? "";
    const address = useSearchParams().get("address") ?? "";

    return (
        <InnerSite denom={denom}>
            {(asset) => address
                ? <HolderContent asset={asset} address={address}/>
                : <EmptyCard title="No address">This link doesn&apos;t name a holder.</EmptyCard>}
        </InnerSite>
    );
}

/** `/token/holder?denom=&address=`: one address seen through this token only. */
export function HolderPage() {
    return (
        <Suspense fallback={<TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><div/></TokenSiteTheme>}>
            <HolderPageContent/>
        </Suspense>
    );
}
