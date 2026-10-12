'use client';

import React from "react";
import {Box, chakra, Flex} from "@chakra-ui/react";
import {LuArrowDown, LuArrowUp} from "react-icons/lu";
import {type Asset, formatUsdAmount, useAssetPrice} from "@bze/bze-ui-kit";

import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";

import {TsButton, TsLinkButton, TsTag, ts, tsContainer, tsMix} from "./kit";

/** The 24h change with an arrow and a sign; the kit has no up/down colours (Business Logic R1). */
function PriceChange({change}: { change: number }) {
    const up = change >= 0;
    const text = `${up ? "+" : "−"}${Math.abs(change).toFixed(2)}% today`;

    return (
        <chakra.span
            data-testid="token-site-change"
            display="inline-flex"
            alignItems="center"
            gap="4px"
            fontWeight={600}
            fontSize="17px"
            fontVariantNumeric="tabular-nums"
            color={tsMix(ts.pri, 80, ts.fg)}
        >
            {up ? <LuArrowUp aria-hidden="true"/> : <LuArrowDown aria-hidden="true"/>}
            {text}
        </chakra.span>
    );
}

/** Hero (Business Logic R3): name, ticker, verified tag, description, USD price, Get / Stake. */
export function Hero({asset, hasStake}: { asset: Asset; hasStake: boolean }) {
    const {price, change, hasPrice} = useAssetPrice(asset.denom);
    const {open} = useTokenWallet();

    return (
        <Box as="section" id="top" aria-label={asset.name} position="relative" overflow="hidden">
            <chakra.svg
                aria-hidden="true"
                viewBox="0 0 600 600"
                position="absolute"
                right={{base: "-170px", md: "-120px"}}
                top={{base: "-40px", md: "-60px"}}
                w={{base: "380px", md: "640px"}}
                h={{base: "380px", md: "640px"}}
                pointerEvents="none"
            >
                <circle cx="300" cy="300" r="280" fill="none" stroke="var(--ts-pri)" strokeOpacity=".18" strokeWidth="2"/>
                <circle cx="300" cy="300" r="220" fill="none" stroke="var(--ts-sec)" strokeOpacity=".22" strokeWidth="2"/>
                <circle cx="300" cy="300" r="160" fill="var(--ts-pri)" fillOpacity=".10"/>
                <circle cx="300" cy="300" r="96" fill="var(--ts-sec)" fillOpacity=".16"/>
            </chakra.svg>

            <Flex position="relative" direction="column" gap={{base: "18px", md: "28px"}} {...tsContainer} pt={{base: "40px", md: "72px"}} pb={{base: "32px", md: "56px"}}>
                <Flex wrap="wrap" align="center" gap="10px">
                    <TsTag>{asset.ticker}</TsTag>
                    {asset.verified && <TsTag>Verified</TsTag>}
                </Flex>
                <chakra.h1
                    m="0"
                    fontSize={{base: "56px", md: "clamp(56px, 9vw, 128px)"}}
                    lineHeight="0.92"
                    letterSpacing="-0.04em"
                    fontWeight={800}
                    maxW="900px"
                    overflowWrap="anywhere"
                >
                    {asset.name}
                </chakra.h1>
                {asset.description && (
                    <chakra.p m="0" fontSize={{base: "17px", md: "20px"}} lineHeight="1.55" maxW="620px" color={ts.muted} whiteSpace="pre-line">
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
                    <TsButton variant="primary" minH="52px" px="28px" fontSize="16px" onClick={open}>
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
