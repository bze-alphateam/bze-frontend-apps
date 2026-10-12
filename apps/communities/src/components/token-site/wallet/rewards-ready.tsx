'use client';

import React, {useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {type Asset, uAmountToBigNumberAmount, useAssets, useAssetsContext, useBZETx} from "@bze/bze-ui-kit";

import {claimAllMessages, type TokenWalletPositions, walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsCard, ts} from "../kit";

const sourcesLabel = (positions: TokenWalletPositions) => {
    const programs = positions.claimProgramIds.length;
    const parts = [
        ...(positions.claimHoldersPool ? ["pool"] : []),
        ...(programs > 0 ? [`${programs} program${programs === 1 ? "" : "s"}`] : []),
    ];

    return parts.join(" + ");
};

interface RewardsReadyProps {
    asset: Asset;
    address: string;
    positions: TokenWalletPositions;
    /** Reloads the holders pool and the programs once a claim lands. */
    onClaimed: () => Promise<void>;
}

/**
 * Rewards ready to claim from T's holders pool and the programs staking T, and "Claim all": one
 * transaction with only the claims that pay something. Hidden when nothing is pending.
 */
export function RewardsReady({asset, address, positions, onClaimed}: RewardsReadyProps) {
    const {denomTicker, denomDecimals} = useAssets();
    const {updateBalances} = useAssetsContext();
    const {tx, progressTrack} = useBZETx();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const msgs = claimAllMessages(address, asset.denom, positions);
    if (msgs.length === 0) return null;

    const claim = async () => {
        setIsSubmitting(true);
        try {
            if (await tx(msgs)) {
                updateBalances();
                await onClaimed();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const coins = positions.pending
        .map((coin) => `${walletAmount(uAmountToBigNumberAmount(coin.amount, denomDecimals(coin.denom)))} ${denomTicker(coin.denom)}`)
        .join(" · ");

    return (
        <TsCard as="section" aria-label="Rewards ready" px="18px" py="16px" borderRadius="16px">
            <Flex align="center" justify="space-between" gap="12px" wrap="wrap">
                <Flex direction="column" gap="2px" minW="0" flex="1 1 160px">
                    <chakra.span color={ts.muted} fontSize="13px">Rewards ready · {sourcesLabel(positions)}</chakra.span>
                    <chakra.span data-testid="wallet-rewards" fontWeight={600} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">
                        {coins}
                    </chakra.span>
                </Flex>
                <TsButton variant="secondary" onClick={claim} disabled={isSubmitting}>
                    {isSubmitting ? (progressTrack || "Waiting for signature…") : "Claim all"}
                </TsButton>
            </Flex>
        </TsCard>
    );
}
