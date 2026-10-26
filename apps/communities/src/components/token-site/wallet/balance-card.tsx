'use client';

import React, {useEffect, useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex, Grid} from "@chakra-ui/react";
import {type Asset, uAmountToBigNumberAmount, useAssetPrice, useBalance} from "@bze/bze-ui-kit";

import {type TokenWalletPositions, walletAmount, walletUsd} from "@/lib/token-site/wallet";

import {TsFeaturedCard, ts, tsLabel} from "../kit";

const shortAddress = (address: string) => `${address.slice(0, 7)}…${address.slice(-4)}`;

function CopyAddress({address}: { address: string }) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timeout = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timeout);
    }, [copied]);

    const copy = () => {
        navigator.clipboard?.writeText(address).then(() => setCopied(true)).catch(() => {});
    };

    return (
        <chakra.button
            type="button"
            onClick={copy}
            aria-label="Copy address"
            title={address}
            font="inherit"
            fontFamily="mono"
            fontSize="12px"
            fontVariantNumeric="tabular-nums"
            bg="transparent"
            border="0"
            color={ts.muted}
            cursor="pointer"
            minH="32px"
        >
            {shortAddress(address)} · {copied ? "Copied" : "Copy"}
        </chakra.button>
    );
}

function Position({label, value, testId}: { label: string; value: string; testId: string }) {
    return (
        <Flex direction="column" gap="2px" minW="0">
            <chakra.span fontSize="13px" color={ts.muted}>{label}</chakra.span>
            <chakra.span data-testid={testId} fontWeight={600} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">{value}</chakra.span>
        </Flex>
    );
}

/** The balance card, the drawer's featured card (Business Logic R4): T balance, its USD value, the address and T positions. */
export function BalanceCard({asset, address, positions}: { asset: Asset; address: string; positions: TokenWalletPositions }) {
    const {balance} = useBalance(asset.denom);
    const {price, hasPrice} = useAssetPrice(asset.denom);
    const display = (amount: BigNumber) => `${walletAmount(uAmountToBigNumberAmount(amount, asset.decimals))} ${asset.ticker}`;
    const amount = uAmountToBigNumberAmount(balance.amount, asset.decimals);

    return (
        <TsFeaturedCard p="20px" display="flex" flexDirection="column" gap="14px" flexShrink={0}>
            <Flex justify="space-between" align="center" gap="8px" wrap="wrap">
                <chakra.span {...tsLabel}>
                    {asset.ticker} balance
                </chakra.span>
                <CopyAddress address={address}/>
            </Flex>
            <Flex direction="column" gap="4px">
                <chakra.span
                    data-testid="wallet-balance"
                    fontSize={{base: "34px", md: "40px"}}
                    fontWeight={800}
                    letterSpacing="-0.03em"
                    lineHeight="1"
                    fontVariantNumeric="tabular-nums"
                    overflowWrap="anywhere"
                >
                    {walletAmount(amount)}
                </chakra.span>
                {hasPrice && (
                    <chakra.span data-testid="wallet-balance-usd" color={ts.muted} fontVariantNumeric="tabular-nums">
                        ≈ {walletUsd(amount.multipliedBy(price))}
                    </chakra.span>
                )}
            </Flex>
            <Grid
                templateColumns="repeat(2, minmax(0, 1fr))"
                gap="12px"
                pt="14px"
                borderTopWidth="1px"
                borderStyle="solid"
                borderColor={ts.border}
            >
                <Position label="Staked" value={display(positions.staked)} testId="wallet-staked"/>
                <Position label="Unlocking" value={display(positions.unlocking)} testId="wallet-unlocking"/>
            </Grid>
        </TsFeaturedCard>
    );
}
