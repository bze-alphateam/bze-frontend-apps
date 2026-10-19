'use client';

import React from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {
    type Asset,
    getChainNativeAssetDenom,
    isSkipEnabled,
    uAmountToBigNumberAmount,
    useAssets,
    useBalance,
} from "@bze/bze-ui-kit";

import {useFeeMode} from "@/hooks/token-site/useTokenFeeMode";
import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsNotice, ts} from "../kit";

/** BZE's ticker and decimals (TBZE on testnet). */
function useBze() {
    const {denomTicker, denomDecimals} = useAssets();
    const denom = getChainNativeAssetDenom();

    return {denom, ticker: denomTicker(denom), decimals: denomDecimals(denom)};
}

/** "Get BZE": opens the Get BZE panel; absent while Skip is off, since the panel can't work then. */
function GetBzeButton({ticker}: { ticker: string }) {
    const {openGetBze} = useTokenWallet();
    if (!isSkipEnabled()) return null;

    return <TsButton variant="ghost" minH="40px" flexShrink={0} onClick={openGetBze}>Get {ticker}</TsButton>;
}

function FeeNotice({asset}: { asset: Asset }) {
    const bze = useBze();

    return (
        <TsNotice data-testid="bze-fee-notice">
            <Flex direction="column" gap="10px" align="flex-start">
                <chakra.span>
                    {asset.ticker} runs on the BeeZee network. Each transaction needs a small amount of {bze.ticker} for the network fee.
                </chakra.span>
                <GetBzeButton ticker={bze.ticker}/>
            </Flex>
        </TsNotice>
    );
}

/**
 * Low-liquidity mode (Business Logic R12): T can't pay network fees, so every transaction needs
 * a little BZE. Nothing renders while T pays its own fees, so BeeZee stays invisible then.
 */
export function BzeFeeNotice({asset}: { asset: Asset }) {
    const {needsBze} = useFeeMode();

    return needsBze ? <FeeNotice asset={asset}/> : null;
}

function FeeRow() {
    const bze = useBze();
    const {balance} = useBalance(bze.denom);

    return (
        <Flex
            align="center"
            justify="space-between"
            gap="12px"
            wrap="wrap"
            borderRadius="14px"
            px="14px"
            py="10px"
            bg={ts.inset}
            fontSize="14px"
            data-testid="bze-fee-row"
        >
            <chakra.span color={ts.muted}>
                Network fees are paid in {bze.ticker} ·{" "}
                <chakra.strong color={ts.fg} fontVariantNumeric="tabular-nums">
                    {walletAmount(uAmountToBigNumberAmount(balance.amount, bze.decimals))} {bze.ticker}
                </chakra.strong>{" "}
                available
            </chakra.span>
            <GetBzeButton ticker={bze.ticker}/>
        </Flex>
    );
}

/** The wallet's BZE row in low-liquidity mode: what fees are paid in and how much is there. */
export function BzeFeeRow() {
    const {needsBze} = useFeeMode();

    return needsBze ? <FeeRow/> : null;
}
