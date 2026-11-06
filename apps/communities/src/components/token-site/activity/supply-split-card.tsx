'use client';

import React from "react";
import {Box, chakra, Flex, Grid} from "@chakra-ui/react";
import {formatUnits} from "@/lib/token-activity";
import {formatShare, type SupplyPart, type SupplyPartKey} from "@/lib/token-activity/supply-split";

import {TsCard, ts, tsMix} from "../kit";

// The canvas's five tones, in the order of the parts.
const TONES: Record<SupplyPartKey, string> = {
    staked: ts.sec,
    budgets: tsMix(ts.sec, 55),
    dex: tsMix(ts.fg, 40),
    top10: ts.pri,
    rest: tsMix(ts.fg, 18),
};

interface SupplySplitCardProps {
    parts: SupplyPart[];
    ticker: string;
    decimals: number;
    /** The supply as the header writes it ("1,000,880 NOAD"). */
    supplyText: string;
}

/** "Where the T is": the supply bar and its legend (Holders tab). */
export function SupplySplitCard({parts, ticker, decimals, supplyText}: SupplySplitCardProps) {
    const aria = parts.map((part) => `${part.label} ${formatShare(part.share)}`).join(", ");

    return (
        <TsCard p={{base: "18px", md: "24px 28px"}} display="flex" flexDirection="column" gap="18px" data-testid="supply-split">
            <Flex justify="space-between" align="baseline" gap="8px 16px" wrap="wrap">
                <chakra.h2 m="0" fontSize="22px" fontWeight={700}>Where the {ticker} is</chakra.h2>
                <chakra.span fontSize="13px" color={ts.muted}>Of {supplyText} · holders snapshot, refreshed hourly</chakra.span>
            </Flex>
            <Flex role="img" aria-label={aria} h="14px" borderRadius="999px" overflow="hidden" gap="2px" bg={ts.inset}>
                {parts.map((part) => (
                    <Box key={part.key} flex={`${Math.max(part.share, 0.0001)} 0 6px`} minW="6px" bg={TONES[part.key]}/>
                ))}
            </Flex>
            <Grid templateColumns={{base: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))"}} gap="16px">
                {parts.map((part) => (
                    <Flex key={part.key} direction="column" gap="4px" minW="0" data-testid={`supply-part-${part.key}`}>
                        <Flex align="center" gap="8px" fontSize="14px" fontWeight={600}>
                            <Box aria-hidden="true" w="10px" h="10px" borderRadius="3px" flex="none" bg={TONES[part.key]}/>
                            {part.label}
                        </Flex>
                        <chakra.span fontSize="18px" fontWeight={700} fontVariantNumeric="tabular-nums">{formatShare(part.share)}</chakra.span>
                        <chakra.span fontSize="13px" color={ts.muted} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">
                            {`${formatUnits(part.amount, decimals)} ${ticker}`}
                        </chakra.span>
                        <chakra.span fontSize="12px" color={ts.muted} lineHeight="1.4">{part.how}</chakra.span>
                    </Flex>
                ))}
            </Grid>
        </TsCard>
    );
}
