'use client';

import React, {useMemo, useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {type Asset, isLpDenom, uAmountToBigNumberAmount, useBalances} from "@bze/bze-ui-kit";

import {walletAmount} from "@/lib/token-site/wallet";

import {ts} from "../kit";

/** Every other non-zero balance of the wallet (no LP shares), biggest USD value first; collapsed by default. */
export function OtherAssets({asset}: { asset: Asset }) {
    const {assetsBalances} = useBalances();
    const [open, setOpen] = useState(false);

    const others = useMemo(() => assetsBalances
        .filter((balance) => balance.denom !== asset.denom && !isLpDenom(balance.denom) && balance.amount.gt(0))
        .sort((a, b) => b.USDValue.comparedTo(a.USDValue) ?? 0), [assetsBalances, asset.denom]);

    return (
        <Flex direction="column" gap="10px">
            <chakra.button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="wallet-other-assets"
                font="inherit"
                bg="transparent"
                border="0"
                color={ts.fg}
                cursor="pointer"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                minH="44px"
                p="0"
            >
                <chakra.span fontWeight={600}>Other assets in this wallet ({others.length})</chakra.span>
                <chakra.span color={ts.muted} fontSize="14px">{open ? "Hide" : "Show"}</chakra.span>
            </chakra.button>
            {open && (
                <chakra.ul id="wallet-other-assets" listStyleType="none" m="0" p="0" display="flex" flexDirection="column" gap="10px">
                    {others.map((balance) => (
                        <Flex as="li" key={balance.denom} justify="space-between" gap="12px" fontSize="15px">
                            <chakra.span fontWeight={600}>{balance.ticker}</chakra.span>
                            <chakra.span color={ts.muted} fontVariantNumeric="tabular-nums">
                                {walletAmount(uAmountToBigNumberAmount(balance.amount, balance.decimals))}
                            </chakra.span>
                        </Flex>
                    ))}
                </chakra.ul>
            )}
        </Flex>
    );
}
