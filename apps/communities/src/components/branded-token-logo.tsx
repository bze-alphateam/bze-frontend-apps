'use client';

import React, {useState} from "react";
import {chakra} from "@chakra-ui/react";
import {TOKEN_LOGO_PLACEHOLDER} from "@bze/bze-ui-kit";

/** The first two letters of the ticker, shown when the token has no logo of its own. */
const initials = (ticker: string) => ticker.slice(0, 2).toUpperCase();

export interface BrandedTokenLogoProps {
    /** `Asset.logo`; empty or ui-kit's `TOKEN_LOGO_PLACEHOLDER` means the token has none. */
    src: string;
    ticker: string;
    size: number;
    /** Coin colour of the placeholder (the brand's primary). */
    fill: string;
    /** Rings and initials of the placeholder; must read on `fill`. */
    ink: string;
}

/**
 * The token's logo, or the DEX's coin placeholder (two rings) redrawn in brand colours with the
 * ticker's initials in the middle. A logo that fails to load falls back to the placeholder too.
 */
export function BrandedTokenLogo({src, ticker, size, fill, ink}: BrandedTokenLogoProps) {
    const [failedSrc, setFailedSrc] = useState<string>();
    const hasLogo = !!src && src !== TOKEN_LOGO_PLACEHOLDER && src !== failedSrc;

    if (hasLogo) {
        return (
            <chakra.img
                src={src}
                alt=""
                aria-hidden="true"
                w={`${size}px`}
                h={`${size}px`}
                borderRadius="50%"
                objectFit="cover"
                flexShrink={0}
                onError={() => setFailedSrc(src)}
            />
        );
    }

    return (
        <chakra.svg
            data-testid="token-initials"
            aria-hidden="true"
            viewBox="0 0 200 200"
            w={`${size}px`}
            h={`${size}px`}
            flexShrink={0}
            display="block"
        >
            <circle cx="100" cy="100" r="100" style={{fill}}/>
            <circle cx="100" cy="100" r="78" fill="none" strokeWidth="5" strokeOpacity="0.55" style={{stroke: ink}}/>
            <circle cx="100" cy="100" r="64" fill="none" strokeWidth="3" strokeOpacity="0.35" style={{stroke: ink}}/>
            <text
                x="100"
                y="100"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="62"
                fontWeight="800"
                fontFamily="inherit"
                style={{fill: ink}}
            >
                {initials(ticker)}
            </text>
        </chakra.svg>
    );
}
