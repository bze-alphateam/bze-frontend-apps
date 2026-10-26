'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {Box, chakra, Flex, Skeleton} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {type Asset, getChainName} from "@bze/bze-ui-kit";

import {type TokenBurnData, useTokenBurn} from "@/hooks/token-site/useTokenBurn";
import {burnCountdown, formatBurnShare} from "@/lib/token-site/burn";
import {walletAmount, walletUsd} from "@/lib/token-site/wallet";

import {TsButton, TsCard, TsDialog, TsSection, TsTable, ts, tsLabel} from "../kit";
import {BurnForm} from "./burn-form";
import {useNow} from "./use-now";

/** The "Burned forever" card: a big total, USD, share of the original supply and Burn T. */
function BurnTotal({asset, burn, onBurn}: { asset: Asset; burn: TokenBurnData; onBurn: () => void }) {
    const percent = burn.share.multipliedBy(100);
    const details = [
        asset.ticker,
        burn.burnedUsd && burn.burned.gt(0) ? walletUsd(burn.burnedUsd) : undefined,
        `${formatBurnShare(burn.share)} of the original supply`,
    ].filter(Boolean).join(" · ");

    return (
        <TsCard flex="999 1 520px" minW="0" p={{base: "24px", md: "36px"}} display="flex" flexDirection="column" gap="26px" data-testid="burn-total">
            <chakra.span {...tsLabel}>Burned forever</chakra.span>
            <Flex direction="column" gap="6px">
                <chakra.span
                    fontVariantNumeric="tabular-nums"
                    fontSize={{base: "48px", md: "clamp(48px, 7vw, 88px)"}}
                    fontWeight={800}
                    lineHeight="1"
                    letterSpacing="-0.04em"
                    overflowWrap="anywhere"
                    data-testid="burn-total-amount"
                >
                    {walletAmount(burn.burned)}
                </chakra.span>
                <chakra.span fontVariantNumeric="tabular-nums" fontSize={{base: "16px", md: "18px"}} color={ts.muted} data-testid="burn-total-details">{details}</chakra.span>
            </Flex>
            <Box
                role="progressbar"
                aria-label="Share of the original supply burned"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Number(percent.toFixed(2))}
                h="10px"
                borderRadius="999px"
                overflow="hidden"
                bg={ts.inset}
            >
                {/* A burn too small to see still shows a sliver. */}
                <Box h="100%" bgImage={`linear-gradient(90deg, ${ts.pri}, ${ts.pri2})`} w={`${BigNumber.min(percent, 100).toFixed(2)}%`} minW={burn.burned.gt(0) ? "14px" : "0"}/>
            </Box>
            <Flex wrap="wrap" gap="12px">
                <TsButton variant="primary" onClick={onBurn}>Burn {asset.ticker}</TsButton>
            </Flex>
        </TsCard>
    );
}

/** When the next burn happens and how much T it destroys; `children` is the raffle slot, which draws its own divider. */
function NextBurn({asset, burn, children}: { asset: Asset; burn: TokenBurnData; children?: React.ReactNode }) {
    const now = useNow();

    return (
        <TsCard flex="1 1 320px" minW="0" p={{base: "24px", md: "28px"}} display="flex" flexDirection="column" gap="18px" data-testid="next-burn">
            <chakra.span {...tsLabel}>Next burn</chakra.span>
            {burn.next ? (
                <>
                    <chakra.span fontVariantNumeric="tabular-nums" fontSize="40px" fontWeight={800} letterSpacing="-0.02em" data-testid="next-burn-countdown">
                        {burnCountdown(burn.next.date, now)}
                    </chakra.span>
                    <chakra.span color={ts.muted} fontVariantNumeric="tabular-nums" fontSize="16px" data-testid="next-burn-amount">
                        {walletAmount(burn.next.amount)} {asset.ticker} queued
                    </chakra.span>
                </>
            ) : (
                <chakra.span fontSize="22px" fontWeight={700} data-testid="next-burn-none">No burn scheduled</chakra.span>
            )}
            {children}
        </TsCard>
    );
}

function BurnHistory({asset, burn}: { asset: Asset; burn: TokenBurnData }) {
    return (
        <TsCard overflow="hidden" data-testid="burn-history">
            <chakra.h3 m="0" px="20px" pt="22px" pb="8px" fontSize="20px" fontWeight={700}>Burn history</chakra.h3>
            {burn.history.length === 0 ? (
                <chakra.p m="0" px="20px" pb="24px" color={ts.muted} data-testid="burn-history-empty">
                    No {asset.ticker} has been burned yet. The first burn starts the count.
                </chakra.p>
            ) : (
                <TsTable>
                    <thead>
                        <tr><th>Amount</th><th>Value</th><th>Block</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        {burn.history.map((item, index) => (
                            <tr key={`${item.blockHeight}-${index}`}>
                                <chakra.td fontWeight={600}>{walletAmount(item.amount)} {asset.ticker}</chakra.td>
                                <td>{item.usd ? walletUsd(item.usd) : "—"}</td>
                                <chakra.td fontFamily="mono" fontSize="13px">{new BigNumber(item.blockHeight).toFormat()}</chakra.td>
                                <td>{item.timestamp}</td>
                            </tr>
                        ))}
                    </tbody>
                </TsTable>
            )}
        </TsCard>
    );
}

/** The Burn dialog opened by "Burn T": the burn form, or a connect prompt without a wallet. */
function BurnDialog({asset, onClose}: { asset: Asset; onClose: () => void }) {
    const {connect} = useChain(getChainName());

    return (
        <TsDialog open onClose={onClose} title={`Burn ${asset.ticker}`}>
            <BurnForm
                asset={asset}
                onDone={onClose}
                onConnect={() => {
                    // The connect modal would open under the dialog.
                    onClose();
                    connect();
                }}
            />
        </TsDialog>
    );
}

/**
 * "Every burn makes T scarcer" (Business Logic R10), always on the page: what has been burned
 * and its share of the original supply, the next burn, the history and the Burn action.
 * `raffle` fills the slot under the next burn (the raffle story).
 */
export function BurnSection({asset, raffle}: { asset: Asset; raffle?: React.ReactNode }) {
    const burn = useTokenBurn(asset.denom);
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <TsSection id="burn" eyebrow="Burn" title={`Every burn makes ${asset.ticker} scarcer`}>
            {burn.isLoading ? (
                <Skeleton height="360px" borderRadius="16px" data-testid="burn-loading"/>
            ) : (
                <>
                    <Flex wrap="wrap" gap="16px">
                        <BurnTotal asset={asset} burn={burn} onBurn={() => setDialogOpen(true)}/>
                        <NextBurn asset={asset} burn={burn}>{raffle}</NextBurn>
                    </Flex>
                    <BurnHistory asset={asset} burn={burn}/>
                </>
            )}
            {dialogOpen && <BurnDialog asset={asset} onClose={() => setDialogOpen(false)}/>}
        </TsSection>
    );
}
