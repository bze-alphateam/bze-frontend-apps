'use client';

import React, {useState} from "react";
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
 * Token picker pill (the "You pay" / "You receive" coin): a visible row of the picked token's logo,
 * its ticker and a chevron, with a transparent native select stretched over it, so the list,
 * keyboard and screen readers behave as the platform's. The row sizes itself from its content in
 * any kit font (a long ticker ends in an ellipsis at the cap), so nothing is laid over the text.
 * Subtle border at rest, the kit's primary on hover, a primary ring on keyboard focus only:
 * Chromium counts a mouse click on a select as `:focus-visible`, so a pointer press hides the ring
 * until the next key press or blur.
 */
export function TsTokenSelect({label, value, options, onChange}: TsTokenSelectProps) {
    const picked = options.find((token) => token.denom === value) ?? options[0];
    const [pointer, setPointer] = useState(false);

    return (
        <chakra.span
            data-pointer={pointer ? "" : undefined}
            onPointerDown={() => setPointer(true)}
            position="relative"
            display="inline-flex"
            alignItems="center"
            gap="8px"
            flexShrink={0}
            maxW="11rem"
            h="36px"
            ps={picked ? "6px" : "14px"}
            pe="12px"
            fontSize="15px"
            fontWeight={700}
            lineHeight="1"
            color={ts.fg}
            bg={ts.inset}
            border="1px solid"
            borderColor={tsMix(ts.fg, 10, ts.inset)}
            borderRadius="999px"
            transition="background-color 120ms ease, border-color 120ms ease"
            _hover={{bg: tsMix(ts.fg, 8, ts.inset), borderColor: tsMix(ts.pri, 70, ts.inset)}}
            _active={{bg: tsMix(ts.fg, 14, ts.inset)}}
            css={{"&:has(select:focus-visible):not([data-pointer])": {outline: `2px solid ${ts.pri}`, outlineOffset: "2px"}}}
        >
            {/* What the select shows, drawn under it: the select itself names the picked option. */}
            {picked && (
                <chakra.span display="flex" flexShrink={0} aria-hidden="true" data-testid="token-select-logo">
                    <BrandedTokenLogo src={picked.logo ?? ""} ticker={picked.ticker} size={LOGO} fill={ts.pri} ink={ts.onPri}/>
                </chakra.span>
            )}
            <chakra.span minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" aria-hidden="true" data-testid="token-select-ticker">
                {picked?.ticker}
            </chakra.span>
            <chakra.span display="flex" flexShrink={0} color={ts.muted} aria-hidden="true">
                <LuChevronDown size={14} strokeWidth={2.5}/>
            </chakra.span>
            <chakra.select
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={() => setPointer(false)}
                onBlur={() => setPointer(false)}
                position="absolute"
                inset="0"
                w="100%"
                h="100%"
                m="0"
                p="0"
                opacity={0}
                appearance="none"
                font="inherit"
                border="0"
                borderRadius="inherit"
                cursor="pointer"
                outline="none"
                // The platform's option list would keep the inherited text colour on its own
                // (often white) popup: paint it in the theme so dark kits stay readable.
                css={{"& option": {backgroundColor: ts.bg, color: ts.fg}}}
            >
                {options.map((token) => <option key={token.denom} value={token.denom}>{token.ticker}</option>)}
            </chakra.select>
        </chakra.span>
    );
}
