'use client';

import React from "react";
import {chakra} from "@chakra-ui/react";
import {type Asset, TOKEN_LOGO_PLACEHOLDER} from "@bze/bze-ui-kit";

import {ts} from "./kit";

/** The first two letters of the ticker, shown when the token has no logo of its own. */
const initials = (ticker: string) => ticker.slice(0, 2).toUpperCase();

/**
 * The token's logo (`Asset.logo`), or a circle in primary with the ticker's first two letters
 * when the chain registry has none (Business Logic R3).
 */
export function TokenMark({asset, size}: { asset: Asset; size: number }) {
    if (asset.logo && asset.logo !== TOKEN_LOGO_PLACEHOLDER) {
        return (
            <chakra.img
                src={asset.logo}
                alt=""
                aria-hidden="true"
                w={`${size}px`}
                h={`${size}px`}
                borderRadius="50%"
                objectFit="cover"
                flexShrink={0}
            />
        );
    }

    return (
        <chakra.span
            data-testid="token-initials"
            aria-hidden="true"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
            w={`${size}px`}
            h={`${size}px`}
            borderRadius="50%"
            bg={ts.pri}
            color={ts.onPri}
            fontWeight={800}
            fontSize={`${Math.round(size * 0.38)}px`}
        >
            {initials(asset.ticker)}
        </chakra.span>
    );
}
