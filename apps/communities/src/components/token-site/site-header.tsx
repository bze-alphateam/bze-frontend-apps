'use client';

import React, {useState} from "react";
import {Box, chakra, Flex} from "@chakra-ui/react";
import {LuMenu, LuMoon, LuSun, LuWallet, LuX} from "react-icons/lu";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, getChainName, shortNumberFormat, uAmountToBigNumberAmount, useBalance} from "@bze/bze-ui-kit";

import {useColorMode} from "@/components/ui/color-mode";
import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";

import {TsButton, TsChip, ts, tsContainer} from "./kit";
import {TokenMark} from "./token-mark";

export interface SiteSection {
    id: string;
    label: string;
}

/** The header's wallet button: the connected wallet's T balance, or "Connect". Opens the drawer. */
function WalletButton({asset}: { asset: Asset }) {
    const {open} = useTokenWallet();
    const {status} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {balance} = useBalance(asset.denom);
    const amount = shortNumberFormat(uAmountToBigNumberAmount(balance.amount, asset.decimals));

    if (!isConnected) {
        return (
            <TsButton variant="primary" onClick={() => open("get")} aria-label="Connect wallet" borderRadius="12px" px={{base: "14px", md: "20px"}} fontWeight={600}>
                <LuWallet aria-hidden="true"/>
                Connect
            </TsButton>
        );
    }

    return (
        <TsButton variant="ghost" onClick={() => open("get")} aria-label="Open wallet" borderRadius="12px" px={{base: "14px", md: "20px"}}>
            <chakra.span aria-hidden="true" w="8px" h="8px" borderRadius="50%" bg={ts.pri}/>
            <chakra.span fontVariantNumeric="tabular-nums">{`${amount} ${asset.ticker}`}</chakra.span>
        </TsButton>
    );
}

function ModeButton() {
    const {colorMode, toggleColorMode} = useColorMode();
    const toDark = colorMode !== "dark";

    return (
        <TsChip
            aria-label={toDark ? "Switch to dark mode" : "Switch to light mode"}
            onClick={toggleColorMode}
            borderRadius="12px"
            bg={ts.card}
            borderColor={ts.border}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            w="44px"
            h="44px"
            px="0"
        >
            {toDark ? <LuMoon aria-hidden="true"/> : <LuSun aria-hidden="true"/>}
        </TsChip>
    );
}

const linkStyle = {
    textDecoration: "none",
    fontWeight: 500,
    fontSize: "15px",
    py: "10px",
    px: "4px",
    color: ts.fg,
    _hover: {opacity: 0.8},
} as const;

/**
 * Standalone header of the token site (Business Logic R2, R3): the token's mark and name, links to
 * the sections on the page, the light/dark switch and the wallet. Nothing from BeeZee.
 */
export function SiteHeader({asset, sections}: { asset: Asset; sections: SiteSection[] }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const {openSettings} = useTokenWallet();

    return (
        <Box as="header" position="relative" {...tsContainer} py={{base: "12px", md: "18px"}}>
            <Flex align="center" gap={{base: "12px", md: "32px"}} wrap="wrap">
                <chakra.a href="#top" display="flex" alignItems="center" gap="12px" textDecoration="none" color={ts.fg} minW="0">
                    <TokenMark asset={asset} size={40}/>
                    <chakra.span fontWeight={700} fontSize={{base: "18px", md: "20px"}} letterSpacing="-0.01em" truncate>
                        {asset.name}
                    </chakra.span>
                </chakra.a>

                <Flex as="nav" aria-label="Sections" display={{base: "none", md: "flex"}} wrap="wrap" gap="4px 24px" flex="1 1 auto">
                    {sections.map((section) => (
                        <chakra.a key={section.id} href={`#${section.id}`} {...linkStyle}>{section.label}</chakra.a>
                    ))}
                </Flex>

                <Flex align="center" gap="10px" ml={{base: "auto", md: "0"}}>
                    <Box display={{base: "none", md: "block"}}><ModeButton/></Box>
                    <WalletButton asset={asset}/>
                    <TsChip
                        display={{base: "inline-flex", md: "none"}}
                        borderRadius="12px"
                        bg={ts.card}
                        borderColor={ts.border}
                        alignItems="center"
                        justifyContent="center"
                        w="44px"
                        h="44px"
                        px="0"
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        aria-controls="token-site-menu"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        {menuOpen ? <LuX aria-hidden="true"/> : <LuMenu aria-hidden="true"/>}
                    </TsChip>
                </Flex>
            </Flex>

            {menuOpen && (
                <Flex
                    id="token-site-menu"
                    as="nav"
                    aria-label="Sections"
                    display={{base: "flex", md: "none"}}
                    direction="column"
                    gap="4px"
                    pt="12px"
                >
                    {sections.map((section) => (
                        <chakra.a key={section.id} href={`#${section.id}`} {...linkStyle} onClick={() => setMenuOpen(false)}>
                            {section.label}
                        </chakra.a>
                    ))}
                    <Flex pt="8px" gap="10px" align="center">
                        <ModeButton/>
                        <TsButton
                            variant="ghost"
                            onClick={() => {
                                setMenuOpen(false);
                                openSettings();
                            }}
                        >
                            Settings
                        </TsButton>
                    </Flex>
                </Flex>
            )}
        </Box>
    );
}
