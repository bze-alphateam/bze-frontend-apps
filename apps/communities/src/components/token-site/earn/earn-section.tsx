'use client';

import React, {useState} from "react";
import {chakra, Flex, Grid, Skeleton} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, getChainName, useAsset, useAssets, useTokenDenomReward} from "@bze/bze-ui-kit";

import {useFixedTermPrograms} from "@/hooks/token-site/useFixedTermPrograms";
import {type EarnOpportunity, joinTickers} from "@/lib/token-site/earn";
import {formatApr, formatDays} from "@/lib/token-site/holders-pool";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsCard, TsDialog, TsNotice, TsSection, TsTag, ts, tsLabel, tsMix} from "../kit";
import {StakeDialog} from "../stake/stake-dialog";

function Term({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex direction="column" gap="4px" minW="0">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontVariantNumeric="tabular-nums" fontWeight={600} overflowWrap="anywhere">{children}</chakra.span>
        </Flex>
    );
}

interface EarnCardProps {
    asset: Asset;
    item: EarnOpportunity;
    onStake: () => void;
}

/** One place paying T: the token staked there, its APR, T paid daily, its terms and the stake button. */
function EarnCard({asset, item, onStake}: EarnCardProps) {
    const {denomTicker} = useAssets();
    const ticker = denomTicker(item.stakingDenom);
    const pool = item.kind === "pool";

    return (
        <TsCard p={{base: "24px", md: "28px"}} display="flex" flexDirection="column" gap="22px" data-testid={`earn-${item.key}`}>
            <Flex justify="space-between" align="flex-start" gap="12px">
                <Flex direction="column" gap="6px" minW="0">
                    <chakra.span color={ts.muted} fontSize="14px">Stake</chakra.span>
                    <chakra.h3 m="0" fontSize="26px" fontWeight={700} overflowWrap="anywhere">{ticker}</chakra.h3>
                    <TsTag alignSelf="flex-start" data-testid="earn-kind">{pool ? "Holders pool" : "Fixed-term program"}</TsTag>
                </Flex>
                {item.apr && (
                    <Flex direction="column" align="flex-end" gap="4px" data-testid="earn-apr">
                        <chakra.span fontVariantNumeric="tabular-nums" fontSize="30px" fontWeight={800} color={tsMix(ts.sec, 80, ts.fg)}>
                            {formatApr(item.apr)}
                        </chakra.span>
                        <chakra.span {...tsLabel}>APR</chakra.span>
                    </Flex>
                )}
            </Flex>

            <Flex align="baseline" wrap="wrap" gap="8px" px="18px" py="14px" borderRadius="14px" bg={tsMix(ts.sec, 12)} data-testid="earn-daily">
                <chakra.span fontVariantNumeric="tabular-nums" fontSize="24px" fontWeight={700}>{walletAmount(item.daily)}</chakra.span>
                <chakra.span fontWeight={600}>{asset.ticker} paid out daily</chakra.span>
            </Flex>

            <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="14px 20px" fontSize="15px">
                <Term label="Unlock time">{item.lock > 0 ? formatDays(item.lock) : "Instant"}</Term>
                <Term label={pool ? "Funded for" : "Ends in"}>{formatDays(item.daysLeft)}</Term>
            </Grid>

            {item.otherPrizes.length > 0 && (
                <chakra.span color={ts.muted} fontSize="14px" data-testid="earn-also-pays">
                    Also pays {joinTickers(item.otherPrizes.map(denomTicker))}.
                </chakra.span>
            )}

            <TsButton variant="secondary" mt="auto" onClick={onStake}>Stake {ticker}</TsButton>
        </TsCard>
    );
}

/** Stands in for the stake dialog while what it needs is loading, or when it is gone. */
function Placeholder({title, gone, onClose}: { title: string; gone: boolean; onClose: () => void }) {
    return (
        <TsDialog open onClose={onClose} title={title}>
            {gone
                ? <TsNotice>This one has stopped paying. Close this and pick another way to earn.</TsNotice>
                : <Skeleton height="180px" borderRadius="14px" data-testid="earn-stake-loading"/>}
        </TsDialog>
    );
}

interface StakeProps {
    stakingDenom: string;
    address: string;
    onClose: () => void;
}

/** Stake into another token's holders pool, with the viewer's position there (for "stake more"). */
function PoolStake({stakingDenom, address, onClose}: StakeProps) {
    const {asset} = useAsset(stakingDenom);
    const {item, isLoading, reload} = useTokenDenomReward(stakingDenom, address);
    const title = `Stake ${asset?.ticker ?? ""}`.trim();

    if (!asset || isLoading || !item) return <Placeholder title={title} gone={Boolean(asset) && !isLoading} onClose={onClose}/>;

    return (
        <StakeDialog
            asset={asset}
            target={{kind: "dr", stakingDenom, item}}
            action="stake"
            onClose={onClose}
            onDone={() => void reload()}
        />
    );
}

/** Stake into a fixed-term program staking another token, with the viewer's stake in it. */
function ProgramStake({stakingDenom, rewardId, address, onClose}: StakeProps & { rewardId: string }) {
    const {asset} = useAsset(stakingDenom);
    const {programs, isLoading, reload} = useFixedTermPrograms(stakingDenom, address);
    const item = programs.find((program) => program.program.reward_id === rewardId);
    const title = `Stake ${asset?.ticker ?? ""}`.trim();

    if (!asset || isLoading || !item) return <Placeholder title={title} gone={Boolean(asset) && !isLoading} onClose={onClose}/>;

    return (
        <StakeDialog
            asset={asset}
            target={{kind: "sr", rewardId, item}}
            action="stake"
            onClose={onClose}
            onDone={() => void reload()}
        />
    );
}

interface EarnSectionProps {
    asset: Asset;
    /** From `useEarnOpportunities`, read by the page so the header knows whether the section exists. */
    opportunities: EarnOpportunity[];
}

/**
 * "Ways to earn T" (Business Logic R7): for people who don't hold T yet, every other token they
 * can stake to get paid in T — fixed-term programs whose prize is T and other tokens' holders
 * pools paying T. Staking opens the stake dialog on the **other** token. Hidden with none.
 */
export function EarnSection({asset, opportunities}: EarnSectionProps) {
    const {status, address, connect} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    const [selected, setSelected] = useState<EarnOpportunity>();

    if (opportunities.length === 0) return null;

    const stake = (item: EarnOpportunity) => {
        if (connected) {
            setSelected(item);
        } else {
            void connect();
        }
    };
    const close = () => setSelected(undefined);

    return (
        <TsSection
            id="earn"
            eyebrow="Earn"
            title={`Ways to earn ${asset.ticker}`}
            description={`Don't hold ${asset.ticker} yet? Stake one of these tokens and get paid in ${asset.ticker} every day.`}
        >
            <Grid templateColumns="repeat(auto-fit, minmax(min(360px, 100%), 1fr))" gap="20px" data-testid="earn-list">
                {opportunities.map((item) => (
                    <EarnCard key={item.key} asset={asset} item={item} onStake={() => stake(item)}/>
                ))}
            </Grid>
            {selected && address && (selected.kind === "program" && selected.rewardId
                ? <ProgramStake stakingDenom={selected.stakingDenom} rewardId={selected.rewardId} address={address} onClose={close}/>
                : <PoolStake stakingDenom={selected.stakingDenom} address={address} onClose={close}/>)}
        </TsSection>
    );
}
