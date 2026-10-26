'use client';

import React from "react";
import {Box, chakra, Flex} from "@chakra-ui/react";
import {LuArrowDown, LuArrowUp} from "react-icons/lu";
import {type Asset, formatUsdAmount, useAssetPrice} from "@bze/bze-ui-kit";

import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";

import {TsButton, TsLinkButton, TsTag, ts, tsChangeColor, tsContainer, tsEyebrow} from "./kit";
import {TokenMark} from "./token-mark";

/** The 24h change with an arrow and a sign, in the shared up/down colours; grey when flat. */
function PriceChange({change}: { change: number }) {
    const up = change >= 0;
    const text = `${up ? "+" : "−"}${Math.abs(change).toFixed(2)}% today`;

    return (
        <chakra.span
            data-testid="token-site-change"
            data-direction={change > 0 ? "up" : change < 0 ? "down" : "flat"}
            display="inline-flex"
            alignItems="center"
            gap="4px"
            fontWeight={600}
            fontSize="16px"
            fontVariantNumeric="tabular-nums"
            color={tsChangeColor(change)}
        >
            {up ? <LuArrowUp aria-hidden="true"/> : <LuArrowDown aria-hidden="true"/>}
            {text}
        </chakra.span>
    );
}

/**
 * Hero (Business Logic R3): the token mark and ticker as the eyebrow, the name as the gradient
 * word, the description, USD price and change, Get / Stake. The kit's glow sits behind it.
 */
export function Hero({asset, hasStake}: { asset: Asset; hasStake: boolean }) {
    const {price, change, hasPrice} = useAssetPrice(asset.denom);
    const {open} = useTokenWallet();

    return (
        <Box as="section" id="top" aria-label={asset.name} position="relative">
            <Flex position="relative" direction="column" gap={{base: "18px", md: "22px"}} {...tsContainer} pt={{base: "36px", md: "72px"}} pb={{base: "28px", md: "48px"}}>
                <Flex wrap="wrap" align="center" gap="10px">
                    <TokenMark asset={asset} size={32}/>
                    <chakra.span {...tsEyebrow} color={ts.pri} data-testid="token-site-ticker">{asset.ticker}</chakra.span>
                    {asset.verified && <TsTag>Verified</TsTag>}
                </Flex>
                <chakra.h1
                    m="0"
                    fontSize={{base: "40px", md: "52px"}}
                    lineHeight="1.05"
                    letterSpacing="-0.03em"
                    fontWeight={800}
                    maxW="900px"
                    overflowWrap="anywhere"
                >
                    <chakra.span data-testid="token-site-name" bgImage={ts.heroGradient} bgClip="text" color="transparent">
                        {asset.name}
                    </chakra.span>
                </chakra.h1>
                {asset.description && (
                    <chakra.p m="0" fontSize={{base: "17px", md: "18px"}} lineHeight="1.55" maxW="620px" color={ts.muted} whiteSpace="pre-line">
                        {asset.description}
                    </chakra.p>
                )}
                {hasPrice && (
                    <Flex wrap="wrap" align="baseline" gap="12px 20px">
                        <chakra.span data-testid="token-site-price" fontSize={{base: "36px", md: "44px"}} fontWeight={700} letterSpacing="-0.02em" fontVariantNumeric="tabular-nums">
                            ${formatUsdAmount(price)}
                        </chakra.span>
                        <PriceChange change={change}/>
                    </Flex>
                )}
                <Flex wrap="wrap" gap="12px">
                    <TsButton variant="primary" minH="52px" px="28px" fontSize="16px" onClick={() => open("get")}>
                        Get {asset.ticker}
                    </TsButton>
                    {hasStake && (
                        <TsLinkButton variant="ghost" href="#stake" minH="52px" px="28px" fontSize="16px">
                            Stake {asset.ticker}
                        </TsLinkButton>
                    )}
                </Flex>
            </Flex>
        </Box>
    );
}
