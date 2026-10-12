'use client';

import React, {useState} from "react";
import {Box, chakra, Flex, Grid, Skeleton} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {
    type Asset,
    claimableCoins,
    type DenomRewardHolderItem,
    denomRewardActionBlockers,
    formatUnlockCountdown,
    getChainName,
    getEcosystemApps,
    uAmountToBigNumberAmount,
    useAssets,
    useBalance,
    useEpochs,
} from "@bze/bze-ui-kit";

import {useHoldersPool} from "@/hooks/token-site/useHoldersPool";
import {factoryDenomRewardLink, factoryDenomRewardScheduleLink} from "@/lib/denom-reward";
import {formatApr, formatDays, formatShare, type HoldersPoolPrize, poolShare} from "@/lib/token-site/holders-pool";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsCard, TsLinkButton, TsNotice, ts, tsLabel, tsMix} from "../kit";
import {type StakeAction, StakeDialog} from "./stake-dialog";

// The prize dots cycle through the kit's colours.
const DOTS = [ts.pri, ts.sec, ts.fg];

const PRIZE_COLUMNS = "minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)";

function Stat({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex direction="column" gap="6px" minW="0">
            <chakra.span {...tsLabel}>{label}</chakra.span>
            <chakra.span fontVariantNumeric="tabular-nums" fontSize="20px" fontWeight={600} overflowWrap="anywhere">{children}</chakra.span>
        </Flex>
    );
}

function PrizeTable({prizes}: { prizes?: HoldersPoolPrize[] }) {
    const {denomTicker} = useAssets();

    if (!prizes) {
        return <chakra.p m="0" color={ts.muted}>Couldn&apos;t load what the pool pays right now.</chakra.p>;
    }
    if (prizes.length === 0) {
        return <chakra.p m="0" color={ts.muted} data-testid="holders-pool-no-prizes">The pool pays nothing right now. Anyone can add rewards to it.</chakra.p>;
    }

    return (
        <Flex direction="column" gap="4px" role="table" aria-label="Pool rewards" data-testid="holders-pool-prizes">
            <Grid role="row" templateColumns={PRIZE_COLUMNS} gap="12px" pb="10px">
                <chakra.span role="columnheader" {...tsLabel}>Reward</chakra.span>
                <chakra.span role="columnheader" {...tsLabel}>Paid daily</chakra.span>
                <chakra.span role="columnheader" {...tsLabel}>Funded for</chakra.span>
            </Grid>
            {prizes.map((prize, index) => (
                <Grid
                    key={prize.denom}
                    role="row"
                    templateColumns={PRIZE_COLUMNS}
                    gap="12px"
                    py="14px"
                    alignItems="center"
                    borderTopWidth="1px"
                    borderStyle="solid"
                    borderColor={ts.border}
                >
                    <Flex role="cell" align="center" gap="10px" fontWeight={700} fontSize="17px" minW="0">
                        <Box aria-hidden="true" flexShrink={0} w="10px" h="10px" borderRadius="50%" bg={DOTS[index % DOTS.length]}/>
                        <chakra.span overflowWrap="anywhere">{denomTicker(prize.denom)}</chakra.span>
                    </Flex>
                    <chakra.span role="cell" fontVariantNumeric="tabular-nums" fontWeight={600} fontSize="17px" overflowWrap="anywhere">
                        {walletAmount(prize.daily)}
                    </chakra.span>
                    <chakra.span role="cell" fontVariantNumeric="tabular-nums" color={ts.muted}>{formatDays(prize.fundedForDays)}</chakra.span>
                </Grid>
            ))}
        </Flex>
    );
}

interface PositionProps {
    asset: Asset;
    item: DenomRewardHolderItem;
    onAction: (action: StakeAction) => void;
}

/** The viewer's stake, pending rewards and unlocks, with the holder actions. */
function YourPosition({asset, item, onAction}: PositionProps) {
    const {denomTicker, denomDecimals} = useAssets();
    const {balance} = useBalance(asset.denom);
    const {hourEpochInfo} = useEpochs();
    const {position, unlocks, denomReward} = item;

    const blockers = denomRewardActionBlockers({item, hasWallet: true, balance: balance.amount});
    const pending = claimableCoins(position);
    const share = position ? poolShare(position.participant.amount, denomReward.staked_amount) : undefined;
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;
    const reasons = Array.from(new Set([blockers.stake, position ? blockers.claim : ""].filter(Boolean)));
    const amount = (uAmount: string) => walletAmount(uAmountToBigNumberAmount(uAmount, asset.decimals));

    return (
        <Flex direction="column" gap="20px" data-testid="holders-pool-position">
            <chakra.span {...tsLabel}>Your position</chakra.span>
            <Flex direction="column" gap="4px">
                <chakra.span fontVariantNumeric="tabular-nums" fontSize="36px" fontWeight={700} letterSpacing="-0.02em" overflowWrap="anywhere">
                    {amount(position?.participant.amount ?? "0")} {asset.ticker}
                </chakra.span>
                <chakra.span color={ts.muted} fontVariantNumeric="tabular-nums">
                    staked{share ? ` · ${formatShare(share)} of the pool` : ""}
                </chakra.span>
            </Flex>
            {position && (
                <Flex direction="column" gap="10px" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border} pt="16px">
                    <chakra.span {...tsLabel}>Ready to claim</chakra.span>
                    {pending.length > 0 ? pending.map((coin) => (
                        <Flex key={coin.denom} justify="space-between" gap="12px" fontWeight={600}>
                            <chakra.span>{denomTicker(coin.denom)}</chakra.span>
                            <chakra.span fontVariantNumeric="tabular-nums">
                                {walletAmount(uAmountToBigNumberAmount(coin.amount, denomDecimals(coin.denom)))}
                            </chakra.span>
                        </Flex>
                    )) : <chakra.span color={ts.muted}>Nothing yet.</chakra.span>}
                </Flex>
            )}
            {unlocks.map((unlock) => (
                <Flex
                    key={unlock.unlockEpoch}
                    justify="space-between"
                    gap="12px"
                    fontSize="15px"
                    borderTopWidth="1px"
                    borderStyle="solid"
                    borderColor={ts.border}
                    pt="16px"
                    data-testid="holders-pool-unlocking"
                >
                    <chakra.span color={ts.muted}>Unlocking</chakra.span>
                    <chakra.span fontVariantNumeric="tabular-nums" fontWeight={600}>
                        {amount(unlock.amount)} {asset.ticker} · {currentHour !== undefined ? formatUnlockCountdown(unlock.unlockEpoch, currentHour) : "soon"}
                    </chakra.span>
                </Flex>
            ))}
            <Flex wrap="wrap" gap="10px" mt="auto">
                <TsButton flex="1 1 auto" variant="primary" disabled={blockers.stake !== ""} onClick={() => onAction("stake")}>
                    {position ? "Stake more" : `Stake ${asset.ticker}`}
                </TsButton>
                {position && (
                    <>
                        <TsButton flex="1 1 auto" variant="primary" disabled={blockers.claim !== ""} onClick={() => onAction("claim")}>
                            Claim all
                        </TsButton>
                        <TsButton flex="1 1 auto" variant="ghost" disabled={blockers.exit !== ""} onClick={() => onAction("unstake")}>
                            Unstake
                        </TsButton>
                    </>
                )}
            </Flex>
            {reasons.length > 0 && <chakra.span color={ts.muted} fontSize="13px" data-testid="holders-pool-blockers">{reasons.join(" ")}</chakra.span>}
        </Flex>
    );
}

/** The side panel when there is no position to show: connect, or stake for the first time. */
function JoinPanel({asset, item, connected, onAction}: PositionProps & { connected: boolean }) {
    const {connect} = useChain(getChainName());
    const {balance} = useBalance(asset.denom);

    if (!connected) {
        return (
            <Flex direction="column" gap="16px">
                <chakra.span {...tsLabel}>Your position</chakra.span>
                <chakra.p m="0" color={ts.muted}>Connect a wallet to stake {asset.ticker} and earn from the pool.</chakra.p>
                <TsButton variant="primary" onClick={() => connect()}>Connect to stake</TsButton>
            </Flex>
        );
    }

    const blocker = denomRewardActionBlockers({item, hasWallet: true, balance: balance.amount}).stake;

    return (
        <Flex direction="column" gap="16px">
            <chakra.span {...tsLabel}>Your position</chakra.span>
            <chakra.p m="0" color={ts.muted}>You aren&apos;t staking in the pool yet.</chakra.p>
            <TsButton variant="primary" disabled={blocker !== ""} onClick={() => onAction("stake")}>Stake {asset.ticker}</TsButton>
            {blocker && <chakra.span color={ts.muted} fontSize="13px" data-testid="holders-pool-blockers">{blocker}</chakra.span>}
        </Flex>
    );
}

function EmptyState({asset}: { asset: Asset }) {
    const link = factoryDenomRewardLink(asset.denom, getEcosystemApps());

    return (
        <TsCard p={{base: "24px", md: "36px"}} data-testid="holders-pool-empty">
            <Flex direction="column" gap="12px" align="flex-start">
                <chakra.h3 m="0" fontSize="22px" fontWeight={700}>No holders pool yet</chakra.h3>
                <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                    A holders pool shares daily rewards among everyone staking {asset.ticker}. The token&apos;s team can start one.
                </chakra.p>
                {link && (
                    <TsLinkButton variant="ghost" href={link} target="_blank" rel="noopener noreferrer">Start a holders pool</TsLinkButton>
                )}
            </Flex>
        </TsCard>
    );
}

/**
 * T's holders pool (Business Logic R5): what it pays daily and for how long, the estimated APR
 * when every reward has a price, the pool's terms, and the viewer's position with the holder
 * actions; "No holders pool yet" when T has none.
 */
export function HoldersPool({asset}: { asset: Asset }) {
    const {status, address} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    const {item, prizes, apr, isLoading, hasError, reload} = useHoldersPool(asset.denom, connected ? address : undefined);
    const [action, setAction] = useState<StakeAction>();

    if (isLoading) return <Skeleton height="360px" borderRadius="20px" data-testid="holders-pool-loading"/>;

    if (hasError) {
        return (
            <TsNotice>
                <Flex align="center" justify="space-between" gap="12px" wrap="wrap">
                    <chakra.span>Couldn&apos;t load the holders pool of {asset.ticker}. The node may be down.</chakra.span>
                    <TsButton variant="ghost" onClick={() => void reload()}>Retry</TsButton>
                </Flex>
            </TsNotice>
        );
    }

    if (!item) return <EmptyState asset={asset}/>;

    const {denomReward, position, unlocks} = item;
    const addRewards = factoryDenomRewardScheduleLink(asset.denom, getEcosystemApps());
    const amount = (uAmount: string) => `${walletAmount(uAmountToBigNumberAmount(uAmount, asset.decimals))} ${asset.ticker}`;
    const showPosition = connected && (Boolean(position) || unlocks.length > 0);

    return (
        <TsCard p="0" overflow="hidden" display="flex" flexWrap="wrap" data-testid="holders-pool">
            <Flex flex="999 1 560px" minW="0" p={{base: "24px", md: "36px"}} direction="column" gap="28px">
                <Flex wrap="wrap" align="flex-start" justify="space-between" gap="16px">
                    <Flex direction="column" gap="8px">
                        <chakra.h3 m="0" fontSize="26px" fontWeight={700}>Holders pool</chakra.h3>
                        <chakra.span color={ts.muted} fontSize="15px">Pays several rewards at once. Anyone can add more.</chakra.span>
                    </Flex>
                    {apr && (
                        <Flex direction="column" align="flex-end" gap="4px" data-testid="holders-pool-apr">
                            <chakra.span
                                fontVariantNumeric="tabular-nums"
                                fontSize="36px"
                                fontWeight={800}
                                letterSpacing="-0.02em"
                                color={tsMix(ts.pri, 80, ts.fg)}
                            >
                                {formatApr(apr)}
                            </chakra.span>
                            <chakra.span {...tsLabel}>Est. APR</chakra.span>
                        </Flex>
                    )}
                </Flex>

                <PrizeTable prizes={prizes}/>

                <Grid templateColumns="repeat(auto-fit, minmax(min(150px, 100%), 1fr))" gap="20px">
                    <Stat label="Total staked">{amount(denomReward.staked_amount)}</Stat>
                    <Stat label="Unlock time">{denomReward.lock > 0 ? formatDays(denomReward.lock) : "Instant"}</Stat>
                    <Stat label="Minimum stake">{amount(denomReward.min_stake)}</Stat>
                </Grid>
                {addRewards && (
                    <Box>
                        <TsLinkButton variant="ghost" href={addRewards} target="_blank" rel="noopener noreferrer">Add rewards to the pool</TsLinkButton>
                    </Box>
                )}
            </Flex>

            <Flex flex="1 1 340px" minW="0" p={{base: "24px", md: "36px"}} direction="column" bg={tsMix(ts.fg, 6)}>
                {showPosition
                    ? <YourPosition asset={asset} item={item} onAction={setAction}/>
                    : <JoinPanel asset={asset} item={item} connected={connected} onAction={setAction}/>}
            </Flex>

            {action && (
                <StakeDialog
                    asset={asset}
                    target={{kind: "dr", stakingDenom: asset.denom}}
                    action={action}
                    item={item}
                    onClose={() => setAction(undefined)}
                    onDone={() => void reload()}
                />
            )}
        </TsCard>
    );
}
