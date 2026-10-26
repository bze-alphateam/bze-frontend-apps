'use client';

import React, {useState} from "react";
import {Box, chakra, Flex, Skeleton} from "@chakra-ui/react";
import {type Asset, useAssets} from "@bze/bze-ui-kit";

import {usePoolChart} from "@/hooks/token-site/usePoolChart";
import {CHART_RANGES, type ChartRange, chartPolylines, DEFAULT_CHART_RANGE, formatChartPrice} from "@/lib/token-site/chart";

import {TsCard, TsChip, ts} from "../kit";

const WIDTH = 1000;
const HEIGHT = 260;
const GRID = [65, 130, 195];

interface ChartPool {
    id: string;
    base: string;
    quote: string;
}

/**
 * The price of T in one of its pools (Business Logic R8): pool chips ("T / X", the most liquid
 * pool first and preselected), range chips (7D / 30D / 90D) and a dependency-free SVG line in the
 * kit's primary colour, with the latest price in the header.
 */
export function PoolChart({asset, pools}: { asset: Asset; pools: ChartPool[] }) {
    const {denomTicker} = useAssets();
    const [poolId, setPoolId] = useState<string>();
    const [range, setRange] = useState<ChartRange>(DEFAULT_CHART_RANGE);

    const pool = pools.find((candidate) => candidate.id === poolId) ?? pools[0];
    const otherOf = (candidate: ChartPool) => (candidate.base === asset.denom ? candidate.quote : candidate.base);
    const pairOf = (candidate: ChartPool) => `${asset.ticker} / ${denomTicker(otherOf(candidate))}`;
    const otherTicker = denomTicker(otherOf(pool));

    const {points, isLoading} = usePoolChart(pool.id, pool.quote === asset.denom, range);
    const {line, area} = chartPolylines(points, WIDTH, HEIGHT, 16);
    const latest = points.at(-1);

    return (
        <TsCard flex="999 1 560px" minW="0" p={{base: "20px", md: "28px"}} display="flex" flexDirection="column" gap="20px" data-testid="pool-chart">
            <Flex wrap="wrap" justify="space-between" align="center" gap="12px">
                <Flex direction="column" gap="4px" minW="0">
                    <chakra.span color={ts.muted} fontSize="14px">{pairOf(pool)}</chakra.span>
                    <chakra.span fontSize="28px" fontWeight={700} fontVariantNumeric="tabular-nums" overflowWrap="anywhere" data-testid="pool-chart-price">
                        {latest ? `${formatChartPrice(latest.price)} ${otherTicker}` : "—"}
                    </chakra.span>
                </Flex>
                <Flex role="group" aria-label="Chart range" gap="8px">
                    {CHART_RANGES.map(({label}) => (
                        <TsChip key={label} selected={range === label} onClick={() => setRange(label)}>{label}</TsChip>
                    ))}
                </Flex>
            </Flex>

            <Box position="relative" h={{base: "220px", md: "300px"}}>
                {isLoading && <Skeleton position="absolute" inset="0" borderRadius="14px" data-testid="pool-chart-loading"/>}
                {!isLoading && points.length === 0 && (
                    <Flex position="absolute" inset="0" align="center" justify="center" color={ts.muted} data-testid="pool-chart-empty">
                        No trades in this range yet
                    </Flex>
                )}
                {!isLoading && points.length > 0 && (
                    <chakra.svg
                        role="img"
                        aria-label={`${asset.ticker} price in ${otherTicker}, last ${range}`}
                        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                        preserveAspectRatio="none"
                        w="100%"
                        h="100%"
                        display="block"
                    >
                        {GRID.map((y) => (
                            <line key={y} x1="0" y1={y} x2={WIDTH} y2={y} stroke="var(--ts-fg)" strokeOpacity="0.08"/>
                        ))}
                        <polygon points={area} fill="var(--ts-pri)" fillOpacity="0.12"/>
                        <polyline
                            points={line}
                            fill="none"
                            stroke="var(--ts-pri)"
                            strokeWidth="3"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            data-testid="pool-chart-line"
                        />
                    </chakra.svg>
                )}
            </Box>

            {pools.length > 1 && (
                <Flex role="group" aria-label="Pool" wrap="wrap" gap="8px">
                    {pools.map((candidate) => (
                        <TsChip key={candidate.id} selected={candidate.id === pool.id} onClick={() => setPoolId(candidate.id)}>
                            {pairOf(candidate)}
                        </TsChip>
                    ))}
                </Flex>
            )}
        </TsCard>
    );
}
