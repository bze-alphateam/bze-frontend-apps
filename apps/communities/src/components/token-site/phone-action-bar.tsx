'use client';

import React from "react";
import {Flex} from "@chakra-ui/react";
import type {Asset} from "@bze/bze-ui-kit";

import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";

import {TsButton, TsLinkButton, ts, tsMix} from "./kit";

/** Height the page leaves free at the bottom on phones so the bar never covers the footer. */
export const PHONE_ACTION_BAR_SPACE = "96px";

/** Fixed bottom bar on phones (below `md`): "Get T" and, when the section exists, "Stake". */
export function PhoneActionBar({asset, hasStake}: { asset: Asset; hasStake: boolean }) {
    const {open} = useTokenWallet();

    return (
        <Flex
            data-testid="phone-action-bar"
            display={{base: "flex", md: "none"}}
            position="fixed"
            left="0"
            right="0"
            bottom="0"
            zIndex="sticky"
            gap="10px"
            px="20px"
            pt="12px"
            pb="20px"
            bg={`color-mix(in oklab, ${ts.bg} 92%, transparent)`}
            borderTopWidth="1px"
            borderStyle="solid"
            borderColor={tsMix(ts.fg, 11)}
        >
            <TsButton variant="primary" flex="1" minH="48px" onClick={() => open("get")}>Get {asset.ticker}</TsButton>
            {hasStake && <TsLinkButton variant="ghost" flex="1" minH="48px" href="#stake">Stake {asset.ticker}</TsLinkButton>}
        </Flex>
    );
}
