'use client';

import React from "react";
import {Box, chakra, Flex} from "@chakra-ui/react";
import type {Asset} from "@bze/bze-ui-kit";

import {useFeeMode} from "@/hooks/token-site/useTokenFeeMode";

import {ts, tsContainer} from "./kit";
import {TokenMark} from "./token-mark";

/**
 * Footer: the token's mark and name. "Runs on BeeZee" shows only in low-liquidity mode, when the
 * token can't pay network fees itself (Business Logic R12) — otherwise BeeZee is never mentioned.
 */
export function SiteFooter({asset}: { asset: Asset }) {
    const {needsBze} = useFeeMode();

    return (
        <Box as="footer" {...tsContainer} pt={{base: "56px", md: "120px"}} pb={{base: "24px", md: "48px"}}>
            <Flex
                wrap="wrap"
                justify="space-between"
                align="center"
                gap="16px"
                pt={{base: "24px", md: "32px"}}
                borderTopWidth="1px"
                borderStyle="solid"
                borderColor={ts.border}
            >
                <Flex align="center" gap="12px">
                    <TokenMark asset={asset} size={32}/>
                    <chakra.span fontWeight={700}>{asset.name}</chakra.span>
                </Flex>
                {needsBze && (
                    <chakra.a href="https://getbze.com" target="_blank" rel="noopener noreferrer" color={ts.muted} fontSize="14px" textDecoration="none">
                        Runs on BeeZee
                    </chakra.a>
                )}
            </Flex>
        </Box>
    );
}
