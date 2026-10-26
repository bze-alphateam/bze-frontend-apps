'use client';

import React from "react";
import type {Asset} from "@bze/bze-ui-kit";

import {BrandedTokenLogo} from "@/components/branded-token-logo";
import {ts} from "./kit";

/**
 * The token's logo (`Asset.logo`), or the coin placeholder in the kit's primary with the ticker's
 * first two letters when the chain registry has none (Business Logic R3).
 */
export function TokenMark({asset, size}: { asset: Asset; size: number }) {
    return <BrandedTokenLogo src={asset.logo} ticker={asset.ticker} size={size} fill={ts.pri} ink={ts.onPri}/>;
}
