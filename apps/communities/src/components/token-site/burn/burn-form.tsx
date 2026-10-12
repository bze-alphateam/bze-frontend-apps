'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {bze} from "@bze/bzejs";
import {
    amountToBigNumberUAmount,
    type Asset,
    getChainName,
    sanitizeNumberInput,
    uAmountToBigNumberAmount,
    useAssetsContext,
    useBZETx,
    useCanAffordTx,
    useMaxSpendable,
} from "@bze/bze-ui-kit";

import {useNextBurning} from "@/hooks/useNextBurning";
import {burnCoin, burnCountdown} from "@/lib/token-site/burn";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsField, TsNotice, ts, tsMix} from "../kit";
import {useNow} from "./use-now";

const {fundBurner} = bze.burner.MessageComposer.withTypeUrl;

/** Why `input` (display units) can't be burned, or '' when it can as far as the balance goes. */
function amountProblem(input: string, balance: BigNumber, asset: Asset): string {
    const value = new BigNumber(input);
    if (value.isNaN() || !value.gt(0)) return "Enter an amount above 0";
    if ((value.decimalPlaces() ?? 0) > asset.decimals) return `Use at most ${asset.decimals} decimals`;
    if (value.gt(uAmountToBigNumberAmount(balance, asset.decimals))) {
        return `You only have ${walletAmount(uAmountToBigNumberAmount(balance, asset.decimals))} ${asset.ticker}`;
    }

    return "";
}

interface BurnFormProps {
    asset: Asset;
    /** Called once the chain accepted the burn. */
    onDone?: () => void;
    /** Replaces the default connect action (the dialog closes itself first). */
    onConnect?: () => void;
}

/**
 * Burns T (Business Logic R10): sends it to the burner, which destroys what it holds at the
 * next burn. Two steps, the amount then a confirmation, since a burn can't be undone. Max keeps
 * the network fee back when the fee is paid in T. Used by the Burn dialog and the wallet's Burn tab.
 */
export function BurnForm({asset, onDone, onConnect}: BurnFormProps) {
    const {status, address, connect} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    const {updateBalances} = useAssetsContext();
    const {nextBurn, reload: reloadNextBurn} = useNextBurning();
    const {tx, progressTrack} = useBZETx();
    const now = useNow();
    const [input, setInput] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const maxSpendable = useMaxSpendable(asset.denom, "fund-burner");
    const uAmount = input !== "" ? amountToBigNumberUAmount(input, asset.decimals) : undefined;
    const problem = input !== "" ? amountProblem(input, maxSpendable.balance, asset) : "";
    const ready = input !== "" && problem === "";
    const afford = useCanAffordTx({
        spec: connected && ready ? "fund-burner" : undefined,
        spend: ready && uAmount ? {denom: asset.denom, amount: uAmount} : undefined,
    });
    const error = problem || (ready && !afford.isLoading && !afford.canAfford ? afford.message : "");
    const canContinue = connected && ready && error === "" && !afford.isLoading;

    if (!connected) {
        return (
            <Flex direction="column" gap="16px" data-testid="burn-connect-prompt">
                <chakra.p m="0" color={ts.muted} lineHeight="1.55">Connect a wallet to burn {asset.ticker}.</chakra.p>
                <TsButton variant="primary" minH="52px" fontSize="16px" onClick={() => (onConnect ? onConnect() : connect())}>
                    Connect wallet
                </TsButton>
            </Flex>
        );
    }

    const queued = `Queued for the next burn${nextBurn ? `, in ${burnCountdown(nextBurn.date, now)}` : ""}. This cannot be undone.`;
    const amount = `${uAmount ? walletAmount(uAmountToBigNumberAmount(uAmount, asset.decimals)) : "0"} ${asset.ticker}`;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canContinue || !address || !uAmount) return;
        if (!confirming) {
            setConfirming(true);
            return;
        }

        setIsSubmitting(true);
        try {
            if (await tx([fundBurner({creator: address, amount: burnCoin(uAmount, asset.denom)})])) {
                updateBalances();
                void reloadNextBurn();
                setInput("");
                setConfirming(false);
                onDone?.();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="12px" noValidate data-testid="burn-form">
            {confirming ? (
                <>
                    <Flex direction="column" gap="6px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)} data-testid="burn-confirm">
                        <chakra.span color={ts.muted} fontSize="13px">You burn</chakra.span>
                        <chakra.span fontVariantNumeric="tabular-nums" fontSize="24px" fontWeight={700} overflowWrap="anywhere">{amount}</chakra.span>
                    </Flex>
                    <TsNotice tone="danger">{queued}</TsNotice>
                </>
            ) : (
                <>
                    <TsField
                        label="Amount to burn"
                        inputMode="decimal"
                        placeholder="0"
                        value={input}
                        onChange={(event) => setInput(sanitizeNumberInput(event.target.value))}
                        aria-invalid={problem !== ""}
                        aria-describedby={error ? "burn-error" : undefined}
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
                    <chakra.span color={ts.muted} fontSize="13px" px="4px" data-testid="burn-queued">{queued}</chakra.span>
                </>
            )}

            {error && <chakra.span id="burn-error" role="alert" fontSize="13px" color={ts.danger} px="4px">{error}</chakra.span>}
            {ready && afford.gasFee.displayAmount.gt(0) && (
                <Flex justify="space-between" gap="12px" fontSize="14px" px="4px">
                    <chakra.span color={ts.muted}>Network fee</chakra.span>
                    <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums">≈ {walletAmount(afford.gasFee.displayAmount)} {afford.gasFee.ticker}</chakra.span>
                </Flex>
            )}

            <Flex gap="10px">
                {confirming && (
                    <TsButton type="button" variant="ghost" minH="52px" flex="1" disabled={isSubmitting} onClick={() => setConfirming(false)}>
                        Back
                    </TsButton>
                )}
                <TsButton type="submit" variant={confirming ? "danger" : "primary"} minH="52px" fontSize="16px" flex="2" disabled={!canContinue || isSubmitting}>
                    {isSubmitting
                        ? (progressTrack || "Waiting for signature…")
                        : confirming ? "Confirm burn" : `Burn ${asset.ticker}`}
                </TsButton>
            </Flex>
        </chakra.form>
    );
}
