'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {bze} from "@bze/bzejs";
import {
    amountToBigNumberUAmount,
    type Asset,
    claimableCoins,
    type DenomRewardHolderItem,
    denomRewardUnlockDate,
    getChainName,
    sanitizeNumberInput,
    type TxSpec,
    uAmountToBigNumberAmount,
    useAssets,
    useAssetsContext,
    useBZETx,
    useCanAffordTx,
    useMaxSpendable,
    validateDenomRewardStake,
} from "@bze/bze-ui-kit";

import {formatDays} from "@/lib/token-site/holders-pool";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsDialog, TsField, TsNotice, ts, tsMix} from "../kit";

const {joinDenomReward, claimDenomRewards, exitDenomReward} = bze.rewards.MessageComposer.withTypeUrl;

/** What the dialog acts on. The fixed-term programs add their own kind (BFE-132). */
export type StakeTarget = { kind: "dr"; stakingDenom: string };

export type StakeAction = "stake" | "claim" | "unstake";

const SPECS: Record<StakeAction, TxSpec> = {
    stake: "join-denom-reward",
    claim: "claim-denom-rewards",
    // The exit gas profile already carries the chain's extra gas for a holders pool exit.
    unstake: "exit-denom-reward",
};

interface StakeDialogProps {
    asset: Asset;
    target: StakeTarget;
    action: StakeAction;
    /** The holders pool with the viewer's position. */
    item: DenomRewardHolderItem;
    onClose: () => void;
    /** Called once the chain accepted the transaction, before the dialog closes. */
    onDone: () => void;
}

const TITLES: Record<StakeAction, (ticker: string, topUp: boolean) => string> = {
    stake: (ticker, topUp) => (topUp ? `Stake more ${ticker}` : `Stake ${ticker}`),
    claim: () => "Claim your rewards",
    unstake: (ticker) => `Unstake your ${ticker}`,
};

function Row({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex justify="space-between" gap="12px" fontSize="14px">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums" textAlign="right" overflowWrap="anywhere">{children}</chakra.span>
        </Flex>
    );
}

function Coins({coins}: { coins: { denom: string; amount: string }[] }) {
    const {denomTicker, denomDecimals} = useAssets();

    return (
        <Flex direction="column" gap="6px">
            {coins.map((coin) => (
                <Row key={coin.denom} label={denomTicker(coin.denom)}>
                    {walletAmount(uAmountToBigNumberAmount(coin.amount, denomDecimals(coin.denom)))}
                </Row>
            ))}
        </Flex>
    );
}

/** Why `uAmount` can't be staked, in words, or '' when it can. */
function stakeProblemText(item: DenomRewardHolderItem, asset: Asset, uAmount: BigNumber | undefined, balance: BigNumber): string {
    const {denomReward, position} = item;
    const problem = validateDenomRewardStake({
        uAmount,
        currentStake: position?.participant.amount,
        minStake: denomReward.min_stake,
        balance,
    });
    const minStake = `${walletAmount(uAmountToBigNumberAmount(denomReward.min_stake, asset.decimals))} ${asset.ticker}`;
    switch (problem) {
        case "invalid":
            return `Enter an amount above 0, with at most ${asset.decimals} decimals`;
        case "balance":
            return `You only have ${walletAmount(uAmountToBigNumberAmount(balance, asset.decimals))} ${asset.ticker}`;
        case "min-stake":
            return position ? `Your whole stake must reach the minimum of ${minStake}` : `The minimum stake is ${minStake}`;
        default:
            return "";
    }
}

/**
 * Stake into, claim from or unstake from T's holders pool (Business Logic R5), in a branded
 * dialog. Unstaking is all or nothing on chain: it pays the pending rewards and releases the
 * whole stake after the pool's unlock time.
 */
export function StakeDialog({asset, target, action, item, onClose, onDone}: StakeDialogProps) {
    const denom = target.stakingDenom;
    const {position, denomReward} = item;
    const {address} = useChain(getChainName());
    const {updateBalances} = useAssetsContext();
    const {tx, progressTrack} = useBZETx();
    const [input, setInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const maxSpendable = useMaxSpendable(denom, SPECS.stake);
    const uAmount = action === "stake" && input !== "" ? amountToBigNumberUAmount(input, asset.decimals) : undefined;
    const stakeProblem = action === "stake" && input !== "" ? stakeProblemText(item, asset, uAmount, maxSpendable.balance) : "";
    const pending = claimableCoins(position);

    const ready = action === "stake"
        ? input !== "" && stakeProblem === ""
        : action === "claim" ? pending.length > 0 : Boolean(position);
    const afford = useCanAffordTx({
        spec: address && ready ? SPECS[action] : undefined,
        spend: action === "stake" && ready && uAmount ? {denom, amount: uAmount} : undefined,
    });
    const error = stakeProblem || (ready && !afford.isLoading && !afford.canAfford ? afford.message : "");
    const canSubmit = Boolean(address) && ready && error === "" && !afford.isLoading && !isSubmitting;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!address || !canSubmit) return;

        const msg = action === "stake"
            ? joinDenomReward({creator: address, denom, amount: uAmount!.toFixed(0)})
            : action === "claim"
                ? claimDenomRewards({creator: address, denom})
                : exitDenomReward({creator: address, denom});
        setIsSubmitting(true);
        try {
            if (await tx([msg])) {
                updateBalances();
                onDone();
                onClose();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const stake = `${walletAmount(uAmountToBigNumberAmount(position?.participant.amount ?? 0, asset.decimals))} ${asset.ticker}`;
    const unlockDate = denomRewardUnlockDate(denomReward.lock);

    return (
        <TsDialog open onClose={onClose} title={TITLES[action](asset.ticker, Boolean(position))}>
            <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="14px" noValidate data-testid={`stake-dialog-${action}`}>
                {action === "stake" && (
                    <>
                        <TsField
                            label="Amount"
                            inputMode="decimal"
                            placeholder="0"
                            value={input}
                            onChange={(event) => setInput(sanitizeNumberInput(event.target.value))}
                            aria-invalid={stakeProblem !== ""}
                            aria-describedby={error ? "stake-dialog-error" : undefined}
                            suffix={asset.ticker}
                        />
                        <Flex justify="space-between" align="center" gap="8px" px="4px" fontSize="13px">
                            <chakra.span color={ts.muted}>
                                Balance {walletAmount(uAmountToBigNumberAmount(maxSpendable.balance, asset.decimals))} {asset.ticker}
                            </chakra.span>
                            <chakra.button
                                type="button"
                                onClick={() => setInput(maxSpendable.inputValue)}
                                disabled={maxSpendable.isLoading || !maxSpendable.amount.gt(0)}
                                font="inherit"
                                fontWeight={600}
                                bg="transparent"
                                border="0"
                                color={ts.fg}
                                cursor="pointer"
                                minH="32px"
                                textDecoration="underline"
                                _disabled={{opacity: 0.5, cursor: "not-allowed"}}
                            >
                                Max
                            </chakra.button>
                        </Flex>
                        {position && pending.length > 0 && (
                            <TsNotice>
                                Staking more pays out your pending rewards first, in the same transaction.
                            </TsNotice>
                        )}
                        <TsNotice>
                            {denomReward.lock > 0
                                ? `Unstaking later returns your whole stake after ${formatDays(denomReward.lock)}.`
                                : "Unstaking later returns your whole stake right away."}
                        </TsNotice>
                    </>
                )}

                {action === "claim" && (
                    <>
                        <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)}>
                            <chakra.span color={ts.muted} fontSize="13px">You receive</chakra.span>
                            <Coins coins={pending}/>
                        </Flex>
                        <chakra.p m="0" color={ts.muted} fontSize="14px">Your stake stays in and keeps earning.</chakra.p>
                    </>
                )}

                {action === "unstake" && (
                    <>
                        <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)}>
                            <Row label="Your stake">{stake}</Row>
                            {pending.length > 0 && (
                                <>
                                    <chakra.span color={ts.muted} fontSize="13px" pt="4px">Paid out first</chakra.span>
                                    <Coins coins={pending}/>
                                </>
                            )}
                        </Flex>
                        <TsNotice tone="danger" data-testid="stake-dialog-unlock">
                            {unlockDate
                                ? `Your whole stake leaves the pool and comes back to your wallet in ${formatDays(denomReward.lock)}. It earns nothing meanwhile.`
                                : "Your whole stake leaves the pool and comes back to your wallet in this transaction."}
                        </TsNotice>
                    </>
                )}

                {error && <chakra.span id="stake-dialog-error" role="alert" fontSize="13px" color={ts.danger}>{error}</chakra.span>}
                {ready && afford.gasFee.displayAmount.gt(0) && (
                    <Row label="Network fee">≈ {walletAmount(afford.gasFee.displayAmount)} {afford.gasFee.ticker}</Row>
                )}

                <TsButton type="submit" variant={action === "unstake" ? "danger" : "primary"} w="100%" minH="52px" fontSize="16px" disabled={!canSubmit}>
                    {isSubmitting
                        ? (progressTrack || "Waiting for signature…")
                        : action === "stake" ? (position ? "Stake more" : "Stake") : action === "claim" ? "Claim all" : "Unstake"}
                </TsButton>
            </chakra.form>
        </TsDialog>
    );
}
