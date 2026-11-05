'use client';

import React, {useState} from "react";
import {Box, type BoxProps, chakra, Flex, Skeleton} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, getChainName, uAmountToBigNumberAmount, useAsset, useAssets, useTokenDenomReward} from "@bze/bze-ui-kit";

import {useEarnPositions} from "@/hooks/token-site/useEarnPositions";
import {useFixedTermPrograms} from "@/hooks/token-site/useFixedTermPrograms";
import {type EarnOpportunity, type EarnRow, earnRows, joinTickers} from "@/lib/token-site/earn";
import {formatApr, formatDays} from "@/lib/token-site/holders-pool";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsCard, TsDialog, TsFeaturedCard, TsNotice, TsSection, TsTag, ts} from "../kit";
import {StakeDialog} from "../stake/stake-dialog";

// Desktop columns: token, APR, T daily, unlock, time left, action.
const COLUMNS = "minmax(0, 2.4fr) repeat(4, minmax(0, 1fr)) minmax(112px, auto)";
// Rows shown before "Show all".
const VISIBLE_ROWS = 5;

const rowLayout = {
    display: "grid",
    gridTemplateColumns: {base: "minmax(0, 1fr) auto", md: COLUMNS},
    columnGap: "16px",
    rowGap: "8px",
    alignItems: "center",
    px: {base: "16px", md: "20px"},
    py: "14px",
} as const;

/**
 * One term of a row. On a phone the terms share a second line, each with its own words
 * (`label` before, `suffix` after); from md the column header says what it is, unless `keepLabel`
 * (the header can't tell a pool's "Funded for" from a program's "Ends in").
 */
function Term({label, suffix, keepLabel, children, ...props}: BoxProps & { label?: string; suffix?: string; keepLabel?: boolean }) {
    return (
        <Box role="cell" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" {...props}>
            {label && <chakra.span hideFrom={keepLabel ? undefined : "md"} fontSize={{md: "13px"}}>{label} </chakra.span>}
            <chakra.span fontWeight={600} color={ts.fg}>{children}</chakra.span>
            {suffix && <chakra.span hideFrom="md">{suffix}</chakra.span>}
        </Box>
    );
}

function PlainRow(props: BoxProps) {
    return <Box {...props}/>;
}

interface EarnRowProps {
    asset: Asset;
    row: EarnRow;
    onOpen: () => void;
    /** The page's featured row (T has no holders pool, so the first way to earn stands out). */
    featured?: boolean;
}

/** One place paying T: the token staked there, its terms, the viewer's stake and Stake / Manage. */
function EarnRowView({asset, row: {item, position}, onOpen, featured}: EarnRowProps) {
    const {denomTicker, denomDecimals} = useAssets();
    const ticker = denomTicker(item.stakingDenom);
    const pool = item.kind === "pool";
    const action = position ? "Manage" : "Stake";
    const pending = position?.pending?.gt(0) ? position.pending : undefined;
    const Row = featured ? TsFeaturedCard : PlainRow;

    return (
        <Row
            role="row"
            {...rowLayout}
            {...(featured ? {mx: "8px", my: "8px"} : {borderTop: `1px solid ${ts.border}`})}
            data-testid={`earn-${item.key}`}
        >
            <Flex role="cell" direction="column" gap="4px" minW="0">
                <Flex align="center" gap="8px" wrap="wrap">
                    <chakra.span fontSize="17px" fontWeight={700} overflowWrap="anywhere" data-testid="earn-ticker">{ticker}</chakra.span>
                    <TsTag data-testid="earn-kind">{pool ? "Holders pool" : "Fixed-term"}</TsTag>
                </Flex>
                {position && (
                    <chakra.span fontSize="13px" fontWeight={600} fontVariantNumeric="tabular-nums" data-testid="earn-position">
                        Your stake: {walletAmount(uAmountToBigNumberAmount(position.staked, denomDecimals(item.stakingDenom)))} {ticker}
                        {pending && ` · ${walletAmount(uAmountToBigNumberAmount(pending, asset.decimals))} ${asset.ticker} to claim`}
                    </chakra.span>
                )}
                {item.otherPrizes.length > 0 && (
                    <chakra.span color={ts.muted} fontSize="13px" data-testid="earn-also-pays">
                        Also pays {joinTickers(item.otherPrizes.map(denomTicker))}.
                    </chakra.span>
                )}
            </Flex>

            {/* A phone's second line; from md its terms are the row's own columns. */}
            <Flex
                display={{base: "flex", md: "contents"}}
                gridColumn="1 / -1"
                order={{base: 3, md: 0}}
                wrap="wrap"
                gap="4px 14px"
                color={ts.muted}
                fontSize={{base: "13px", md: "15px"}}
            >
                <Term label="APR" hideBelow={item.apr ? undefined : "md"} data-testid="earn-apr">
                    {item.apr ? formatApr(item.apr) : "—"}
                </Term>
                <Term suffix={` ${asset.ticker}/day`} data-testid="earn-daily">{walletAmount(item.daily)}</Term>
                <Term label="Unlock" data-testid="earn-unlock">{item.lock > 0 ? formatDays(item.lock) : "Instant"}</Term>
                <Term label={pool ? "Funded for" : "Ends in"} keepLabel data-testid="earn-left">{formatDays(item.daysLeft)}</Term>
            </Flex>

            <Flex role="cell" justify="flex-end" order={{base: 2, md: 0}}>
                <TsButton variant={position ? "ghost" : "secondary"} minH="40px" px="18px" aria-label={`${action} ${ticker}`} onClick={onOpen}>
                    {action}
                </TsButton>
            </Flex>
        </Row>
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
    /** After a stake or an unstake, on top of the dialog's own reload. */
    onDone: () => void;
}

/** Stake into another token's holders pool, with the viewer's position there (for "stake more"). */
function PoolStake({stakingDenom, address, onClose, onDone}: StakeProps) {
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
            onDone={() => {
                void reload();
                onDone();
            }}
        />
    );
}

/** Stake into a fixed-term program staking another token, with the viewer's stake in it. */
function ProgramStake({stakingDenom, rewardId, address, onClose, onDone}: StakeProps & { rewardId: string }) {
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
            onDone={() => {
                void reload();
                onDone();
            }}
        />
    );
}

interface EarnSectionProps {
    asset: Asset;
    /** From `useEarnOpportunities`, read by the page so the header knows whether the section exists. */
    opportunities: EarnOpportunity[];
    /** Feature the first row: T has no holders pool to feature. */
    featureFirst?: boolean;
}

/**
 * "Ways to earn T" (Business Logic R7): for people who don't hold T yet, every other token they
 * can stake to get paid in T — fixed-term programs whose prize is T and other tokens' holders
 * pools paying T — as a compact list. The ones the viewer stakes in come first, with their stake
 * and a Manage button; past five rows the rest wait behind "Show all". Staking opens the stake
 * dialog on the **other** token. Hidden with none.
 */
export function EarnSection({asset, opportunities, featureFirst}: EarnSectionProps) {
    const {status, address, connect} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    // Two address-wide reads, only while the section shows.
    const {positions, reload: reloadPositions} = useEarnPositions(connected && opportunities.length > 0 ? address : undefined);
    const [selected, setSelected] = useState<EarnOpportunity>();
    const [expanded, setExpanded] = useState(false);

    if (opportunities.length === 0) return null;

    const rows = earnRows(opportunities, connected ? positions : undefined);
    const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
    const open = (item: EarnOpportunity) => {
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
            <TsCard overflow="hidden">
                <Box role="table" aria-label={`Ways to earn ${asset.ticker}`} data-testid="earn-list">
                    <Box
                        role="row"
                        {...rowLayout}
                        hideBelow="md"
                        py="12px"
                        fontSize="12px"
                        letterSpacing="0.08em"
                        textTransform="uppercase"
                        fontWeight={600}
                        color={ts.muted}
                    >
                        <span role="columnheader">Stake</span>
                        <span role="columnheader">APR</span>
                        <span role="columnheader">{asset.ticker} daily</span>
                        <span role="columnheader">Unlock</span>
                        <span role="columnheader">Time left</span>
                        <span role="columnheader"><chakra.span srOnly>Actions</chakra.span></span>
                    </Box>
                    {shown.map((row, index) => (
                        <EarnRowView
                            key={row.item.key}
                            asset={asset}
                            row={row}
                            featured={featureFirst && index === 0}
                            onOpen={() => open(row.item)}
                        />
                    ))}
                </Box>
                {rows.length > VISIBLE_ROWS && (
                    <Flex justify="center" px="16px" py="14px" borderTop={`1px solid ${ts.border}`}>
                        <TsButton variant="ghost" minH="40px" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                            {expanded ? "Show fewer" : `Show all ${rows.length}`}
                        </TsButton>
                    </Flex>
                )}
            </TsCard>
            {selected && address && (selected.kind === "program" && selected.rewardId
                ? <ProgramStake stakingDenom={selected.stakingDenom} rewardId={selected.rewardId} address={address} onClose={close} onDone={reloadPositions}/>
                : <PoolStake stakingDenom={selected.stakingDenom} address={address} onClose={close} onDone={reloadPositions}/>)}
        </TsSection>
    );
}
