'use client';

import React from "react";
import {chakra} from "@chakra-ui/react";
import {LuChevronDown} from "react-icons/lu";

import {BrandedTokenLogo} from "@/components/branded-token-logo";
import {ts, tsMix} from "./tokens";

export interface TsTokenOption {
    denom: string;
    ticker: string;
    /** `Asset.logo`; empty or the ui-kit placeholder shows the ticker's initials instead. */
    logo?: string;
}

interface TsTokenSelectProps {
    /** The accessible name (the visible field label sits elsewhere). */
    label: string;
    value: string;
    options: TsTokenOption[];
    onChange: (denom: string) => void;
}

const LOGO = 20;

/**
 * Token picker pill (the "You pay" / "You receive" coin): the picked token's logo, its ticker and a
 * chevron over a native select, so the list, keyboard and screen readers behave as the platform's.
 * Inset fill that darkens on hover and press, and a primary ring on keyboard focus only.
 */
export function TsTokenSelect({label, value, options, onChange}: TsTokenSelectProps) {
    const picked = options.find((token) => token.denom === value) ?? options[0];

    return (
        <chakra.span position="relative" display="inline-flex" alignItems="center" flexShrink={0} maxW="11rem" color={ts.fg}>
            {picked && (
                <chakra.span position="absolute" left="6px" display="flex" pointerEvents="none" data-testid="token-select-logo">
                    <BrandedTokenLogo src={picked.logo ?? ""} ticker={picked.ticker} size={LOGO} fill={ts.pri} ink={ts.onPri}/>
                </chakra.span>
            )}
            <chakra.select
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                appearance="none"
                font="inherit"
                fontSize="15px"
                fontWeight={700}
                lineHeight="1"
                color="inherit"
                bg={ts.inset}
                border="1px solid"
                borderColor={tsMix(ts.fg, 10, ts.inset)}
                borderRadius="999px"
                h="36px"
                w="100%"
                minW="0"
                ps={picked ? `${6 + LOGO + 8}px` : "14px"}
                pe="34px"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                cursor="pointer"
                outline="none"
                transition="background-color 120ms ease, border-color 120ms ease"
                _hover={{bg: tsMix(ts.fg, 8, ts.inset), borderColor: tsMix(ts.fg, 18, ts.inset)}}
                _active={{bg: tsMix(ts.fg, 14, ts.inset)}}
                _focusVisible={{outline: `2px solid ${ts.pri}`, outlineOffset: "2px"}}
                // The platform's option list would keep the inherited text colour on its own
                // (often white) popup: paint it in the theme so dark kits stay readable.
                css={{"& option": {backgroundColor: ts.bg, color: ts.fg}}}
            >
                {options.map((token) => <option key={token.denom} value={token.denom}>{token.ticker}</option>)}
            </chakra.select>
            <chakra.span position="absolute" right="12px" display="flex" pointerEvents="none" color={ts.muted} aria-hidden="true">
                <LuChevronDown size={14} strokeWidth={2.5}/>
            </chakra.span>
        </chakra.span>
    );
}
