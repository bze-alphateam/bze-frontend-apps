'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex, Grid, Skeleton} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {
    type Asset,
    formatUnlockCountdown,
    getChainName,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetPrice,
    useEpochs,
} from "@bze/bze-ui-kit";

import {useFixedTermPrograms} from "@/hooks/token-site/useFixedTermPrograms";
import {
    type FixedTermProgram,
    isProgramFinished,
    programApr,
    programDaysLeft,
    unlockingTotal,
} from "@/lib/token-site/fixed-term";
import {formatDays} from "@/lib/token-site/holders-pool";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsCard, ts, tsLabel} from "../kit";
import {type StakeAction, StakeDialog} from "./stake-dialog";

function Term({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex direction="column" gap="4px" minW="0">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontVariantNumeric="tabular-nums" fontWeight={600} overflowWrap="anywhere">{children}</chakra.span>
        </Flex>
    );
}

function Mine({label, testId, children}: { label: string; testId: string; children: React.ReactNode }) {
    return (
        <Flex direction="column" gap="2px" minW="0" data-testid={testId}>
            <chakra.span color={ts.muted} fontSize="13px">{label}</chakra.span>
            <chakra.span fontVariantNumeric="tabular-nums" fontWeight={700} overflowWrap="anywhere">{children}</chakra.span>
        </Flex>
    );
}

interface ProgramCardProps {
    asset: Asset;
    item: FixedTermProgram;
    connected: boolean;
    onAction: (action: StakeAction) => void;
}

/** One program: what it pays in and its APR, its terms, the viewer's part in it and the actions. */
function ProgramCard({asset, item, connected, onAction}: ProgramCardProps) {
    const {program, stake, unlocking, pending} = item;
    const {asset: prize} = useAsset(program.prize_denom);
    const {price: stakingPrice} = useAssetPrice(program.staking_denom);
    const {price: prizePrice} = useAssetPrice(program.prize_denom);
    const {hourEpochInfo} = useEpochs();

    const prizeTicker = prize?.ticker ?? program.prize_denom;
    const prizeDecimals = prize?.decimals ?? 0;
    const finished = isProgramFinished(program);
    const apr = programApr({program, stakingDecimals: asset.decimals, prizeDecimals, stakingPrice, prizePrice});
    const daysLeft = programDaysLeft(program);
    const tAmount = (uAmount: string | BigNumber) => `${walletAmount(uAmountToBigNumberAmount(uAmount, asset.decimals))} ${asset.ticker}`;
    const unlockingAmount = unlockingTotal(unlocking);
    const firstUnlock = unlocking.reduce<number | undefined>((first, unlock) => {
        const epoch = unlock.unlockEpoch.toNumber();
        return first === undefined || epoch < first ? epoch : first;
    }, undefined);
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;

    return (
        <TsCard p={{base: "20px", md: "28px"}} display="flex" flexDirection="column" gap="22px" data-testid={`program-${program.reward_id}`}>
            <Flex justify="space-between" align="flex-start" gap="12px">
                <Flex direction="column" gap="6px" minW="0">
                    <chakra.span color={ts.muted} fontSize="14px">Pays in</chakra.span>
                    <chakra.h4 m="0" fontSize="24px" fontWeight={700} overflowWrap="anywhere">{prizeTicker}</chakra.h4>
                </Flex>
                {apr && (
                    <Flex direction="column" align="flex-end" gap="4px" data-testid="program-apr">
                        <chakra.span fontVariantNumeric="tabular-nums" fontSize="30px" fontWeight={800}>
                            {apr.toFormat()}%
                        </chakra.span>
                        <chakra.span {...tsLabel}>APR</chakra.span>
                    </Flex>
                )}
            </Flex>

            <Grid templateColumns="repeat(auto-fill, minmax(min(110px, 100%), 1fr))" gap="14px 16px" fontSize="15px" data-testid="program-terms">
                <Term label="Paid daily">{walletAmount(uAmountToBigNumberAmount(program.prize_amount, prizeDecimals))} {prizeTicker}</Term>
                <Term label="Ends in">{finished ? "Finished" : formatDays(daysLeft)}</Term>
                <Term label="Unlock time">{program.lock > 0 ? formatDays(program.lock) : "Instant"}</Term>
                <Term label="Total staked">{tAmount(program.staked_amount)}</Term>
                <Term label="Minimum">{tAmount(program.min_stake.toString())}</Term>
            </Grid>

            {(stake || unlocking.length > 0) && (
                <Flex
                    wrap="wrap"
                    justify="space-between"
                    gap="12px"
                    borderRadius="14px"
                    px="18px"
                    py="16px"
                    bg={ts.inset}
                    data-testid="program-position"
                >
                    {stake && <Mine label="You stake" testId="program-stake">{tAmount(stake.amount)}</Mine>}
                    {stake && (
                        <Mine label="Ready to claim" testId="program-pending">
                            {walletAmount(uAmountToBigNumberAmount(pending, prizeDecimals))} {prizeTicker}
                        </Mine>
                    )}
                    {unlocking.length > 0 && (
                        <Mine label="Unlocking" testId="program-unlocking">
                            {tAmount(unlockingAmount)}
                            {firstUnlock !== undefined && currentHour !== undefined ? ` · ${formatUnlockCountdown(firstUnlock, currentHour)}` : ""}
                        </Mine>
                    )}
                </Flex>
            )}

            {connected && (!finished || stake) && (
                <Flex wrap="wrap" gap="10px" mt="auto">
                    {!finished && (
                        <TsButton flex="1 1 auto" variant="primary" onClick={() => onAction("stake")}>
                            {stake ? "Stake more" : "Stake"}
                        </TsButton>
                    )}
                    {stake && pending.gt(0) && (
                        <TsButton flex="1 1 auto" variant="primary" onClick={() => onAction("claim")}>Claim</TsButton>
                    )}
                    {stake && (
                        <TsButton flex="1 1 auto" variant="ghost" onClick={() => onAction("unstake")}>Unstake</TsButton>
                    )}
                </Flex>
            )}
        </TsCard>
    );
}

interface Selected {
    rewardId: string;
    action: StakeAction;
}

/**
 * "Fixed-term programs" under the holders pool (Business Logic R6): every x/rewards program
 * staking T, each paying one reward until it ends, with the viewer's position and actions.
 * Hidden when T has none.
 */
export function FixedTermPrograms({asset}: { asset: Asset }) {
    const {status, address} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    const {programs, isLoading, reload} = useFixedTermPrograms(asset.denom, connected ? address : undefined);
    const [selected, setSelected] = useState<Selected>();

    if (isLoading) return <Skeleton height="280px" borderRadius="20px" data-testid="programs-loading"/>;
    if (programs.length === 0) return null;

    // Read from the latest data, so a reload while the dialog is open keeps it current.
    const selectedItem = selected && programs.find((item) => item.program.reward_id === selected.rewardId);

    return (
        <Flex direction="column" gap="16px" pt="24px" data-testid="fixed-term-programs">
            <Flex direction="column" gap="6px" maxW="720px">
                <chakra.h3 m="0" fontSize="26px" fontWeight={700}>Fixed-term programs</chakra.h3>
                <chakra.span color={ts.muted} fontSize="16px" lineHeight="1.5">
                    Each program pays one reward until it ends. {asset.ticker} you stake here is locked on its own, separate
                    from the holders pool, with the program&apos;s own unlock time.
                </chakra.span>
            </Flex>
            <Grid templateColumns="repeat(auto-fit, minmax(min(380px, 100%), 1fr))" gap="20px">
                {programs.map((item) => (
                    <ProgramCard
                        key={item.program.reward_id}
                        asset={asset}
                        item={item}
                        connected={connected}
                        onAction={(action) => setSelected({rewardId: item.program.reward_id, action})}
                    />
                ))}
            </Grid>
            {selected && selectedItem && (
                <StakeDialog
                    asset={asset}
                    target={{kind: "sr", rewardId: selected.rewardId, item: selectedItem}}
                    action={selected.action}
                    onClose={() => setSelected(undefined)}
                    onDone={() => void reload()}
                />
            )}
        </Flex>
    );
}
