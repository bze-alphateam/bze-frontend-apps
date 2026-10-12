'use client';

import React from "react";
import type {Asset} from "@bze/bze-ui-kit";

import {TsSection} from "../kit";
import {HoldersPool} from "./holders-pool";

/**
 * "Stake your T" (Business Logic R5), always on the page: the holders pool first, then whatever
 * else stakes T (`children`, the pre-redesign programs until BFE-132 replaces them).
 */
export function StakeSection({asset, children}: { asset: Asset; children?: React.ReactNode }) {
    return (
        <TsSection
            id="stake"
            eyebrow="Stake"
            title={`Stake your ${asset.ticker}`}
            description="Stake in the holders pool to share every reward it pays out each day."
        >
            <HoldersPool asset={asset}/>
            {children}
        </TsSection>
    );
}
