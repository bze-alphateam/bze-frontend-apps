'use client';

import React, {useEffect, useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex, Grid} from "@chakra-ui/react";
import {type Asset, uAmountToBigNumberAmount, useAssetPrice, useBalance} from "@bze/bze-ui-kit";

import {type TokenWalletPositions, walletAmount, walletUsd} from "@/lib/token-site/wallet";

import {TsInvertedCard, ts, tsMix} from "../kit";

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
            fontSize="13px"
            fontVariantNumeric="tabular-nums"
            bg="transparent"
            border="0"
            color="inherit"
            opacity={0.8}
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
            <chakra.span fontSize="13px" opacity={0.72}>{label}</chakra.span>
            <chakra.span data-testid={testId} fontWeight={600} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">{value}</chakra.span>
        </Flex>
    );
}

/** The inverted balance card (Business Logic R4): T balance, its USD value, the address and T positions. */
export function BalanceCard({asset, address, positions}: { asset: Asset; address: string; positions: TokenWalletPositions }) {
    const {balance} = useBalance(asset.denom);
    const {price, hasPrice} = useAssetPrice(asset.denom);
    const display = (amount: BigNumber) => walletAmount(uAmountToBigNumberAmount(amount, asset.decimals));
    const amount = uAmountToBigNumberAmount(balance.amount, asset.decimals);

    return (
        <TsInvertedCard p="24px" display="flex" flexDirection="column" gap="16px">
            <Flex justify="space-between" align="center" gap="8px" wrap="wrap">
                <chakra.span fontSize="12px" letterSpacing="0.08em" textTransform="uppercase" fontWeight={600} opacity={0.72}>
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
                    <chakra.span data-testid="wallet-balance-usd" opacity={0.78} fontVariantNumeric="tabular-nums">
                        ≈ {walletUsd(amount.multipliedBy(price))}
                    </chakra.span>
                )}
            </Flex>
            <Grid
                templateColumns="repeat(3, minmax(0, 1fr))"
                gap="12px"
                pt="14px"
                borderTopWidth="1px"
                borderStyle="solid"
                borderColor={tsMix(ts.bg, 22, ts.fg)}
            >
                <Position label="Holders pool" value={display(positions.holdersPool)} testId="wallet-holders-pool"/>
                <Position label="Programs" value={display(positions.programs)} testId="wallet-programs"/>
                <Position label="Unlocking" value={display(positions.unlocking)} testId="wallet-unlocking"/>
            </Grid>
        </TsInvertedCard>
    );
}
