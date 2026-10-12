'use client';

import React from "react";
import {Box} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import {shortNumberFormat} from "@bze/bze-ui-kit";

import {useKeyNumbers} from "@/hooks/token-site/useKeyNumbers";

import {TsCard, TsStat, tsContainer} from "./kit";

const usd = (amount: BigNumber) => `$${shortNumberFormat(amount)}`;

/** Market cap, supply, staked, burned and 24h volume; each hidden when it can't be computed (R3). */
export function KeyNumbers({denom}: { denom: string }) {
    const numbers = useKeyNumbers(denom);

    const stats = [
        {key: "cap", label: "Market cap", value: numbers.marketCap && usd(numbers.marketCap)},
        {key: "supply", label: "Supply", value: numbers.supply && shortNumberFormat(numbers.supply)},
        {key: "staked", label: "Staked", value: numbers.staked && shortNumberFormat(numbers.staked)},
        {key: "burned", label: "Burned", value: numbers.burned && shortNumberFormat(numbers.burned)},
        {key: "volume", label: "24h volume", value: numbers.volume24h && usd(numbers.volume24h)},
    ].filter((stat) => stat.value !== undefined);

    if (stats.length === 0) return null;

    return (
        <Box as="section" aria-label="Key numbers" {...tsContainer}>
            <TsCard
                display="grid"
                gridTemplateColumns={{base: "repeat(2, minmax(0, 1fr))", md: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))"}}
            >
                {stats.map((stat) => (
                    <TsStat key={stat.key} data-testid={`key-number-${stat.key}`} label={stat.label} value={stat.value} px={{base: "18px", md: "28px"}} py={{base: "18px", md: "24px"}}/>
                ))}
            </TsCard>
        </Box>
    );
}
