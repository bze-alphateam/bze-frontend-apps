'use client';

import React from "react";
import type {Asset} from "@bze/bze-ui-kit";

import {TsSection} from "../kit";
import {FixedTermPrograms} from "./fixed-term-programs";
import {HoldersPool} from "./holders-pool";

/**
 * "Stake your T" (Business Logic R5, R6), always on the page: the holders pool first, then the
 * fixed-term programs staking T when there are any.
 */
export function StakeSection({asset, onPoolKnown}: { asset: Asset; onPoolKnown?: (hasPool: boolean) => void }) {
    return (
        <TsSection
            id="stake"
            eyebrow="Stake"
            title={`Stake your ${asset.ticker}`}
            description="Stake in the holders pool to share every reward it pays out each day."
        >
            <HoldersPool asset={asset} onPoolKnown={onPoolKnown}/>
            <FixedTermPrograms asset={asset}/>
        </TsSection>
    );
}
