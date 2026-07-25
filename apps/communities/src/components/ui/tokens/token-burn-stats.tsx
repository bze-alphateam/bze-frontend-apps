'use client';

import React, {useMemo} from "react";
import {Badge, Box, HStack, SimpleGrid, Skeleton, Table, Text, VStack} from "@chakra-ui/react";
import {LuFlame} from "react-icons/lu";
import {Asset, prettyAmount, uAmountToBigNumberAmount, useAssetsValue} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";

import {useBurningHistory} from "@/hooks/useBurningHistory";
import {useNextBurning} from "@/hooks/useNextBurning";

const cardStyle = {
    bgGradient: "to-br",
    gradientFrom: "green.500/8",
    gradientTo: "green.600/8",
    borderWidth: "1px",
    borderColor: "green.500/20",
    borderRadius: "xl",
    shadow: "sm",
} as const;

const StatCard = ({label, amount, ticker, usdValue, badge}: {
    label: string;
    amount: string;
    ticker: string;
    usdValue?: BigNumber;
    badge?: string;
}) => (
    <Box {...cardStyle} p={{base: 4, md: 5}}>
        <VStack align="stretch" gap={1}>
            <Text fontSize="xs" color="fg.muted" textTransform="uppercase">
                {label}
            </Text>
            <HStack align="baseline" gap={2} flexWrap="wrap">
                <Text fontWeight="bold" fontSize={{base: "2xl", md: "3xl"}} color="green.500">
                    {amount}
                </Text>
                <Text fontSize="md" color="fg.muted">{ticker}</Text>
            </HStack>
            {usdValue && usdValue.gt(0) && (
                <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                    ≈ ${prettyAmount(usdValue)}
                </Text>
            )}
            {badge && (
                <Box mt={1}>
                    <Badge colorPalette="green" variant="subtle" size="sm" borderRadius="full">
                        {badge}
                    </Badge>
                </Box>
            )}
        </VStack>
    </Box>
);

export const TokenBurnStats = ({asset}: { asset: Asset }) => {
    const {burnHistory, isLoading: isLoadingHistory} = useBurningHistory(asset.denom);
    const {nextBurn, isLoading: isLoadingNextBurn} = useNextBurning();
    const {totalUsdValue} = useAssetsValue();

    // Total burned = sum of this token's burn-history amounts (Business Logic §6).
    const totalBurned = useMemo(
        () => burnHistory.reduce((total, burn) => total.plus(burn.amount), BigNumber(0)),
        [burnHistory],
    );

    const totalBurnedUsdValue = useMemo(() => {
        if (totalBurned.isZero()) return BigNumber(0);
        return totalUsdValue([{denom: asset.denom, amount: totalBurned}]);
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalBurned, asset.denom]);

    // Next scheduled burning for this token, if the burner module currently holds it.
    const nextCoinBurn = useMemo(() => {
        if (!nextBurn?.coins) return null;

        const coin = nextBurn.coins.find((c) => c.denom === asset.denom);
        if (!coin) return null;

        const amount = uAmountToBigNumberAmount(coin.amount, asset.decimals);
        const usdValue = totalUsdValue([{denom: asset.denom, amount}]);

        return {amount, usdValue, date: nextBurn.date};
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nextBurn, asset.denom, asset.decimals]);

    if (isLoadingHistory) {
        return <Skeleton height="140px" borderRadius="xl"/>;
    }

    return (
        <VStack align="stretch" gap={4}>
            <HStack gap={2} align="center">
                <LuFlame color="var(--chakra-colors-green-500)"/>
                <Text fontWeight="bold" fontSize={{base: "lg", md: "xl"}}>
                    Burns
                </Text>
            </HStack>

            <SimpleGrid columns={{base: 1, md: nextCoinBurn ? 2 : 1}} gap={4}>
                <StatCard
                    label="Total burned"
                    amount={prettyAmount(totalBurned)}
                    ticker={asset.ticker}
                    usdValue={totalBurnedUsdValue}
                    badge="All time"
                />
                {!isLoadingNextBurn && nextCoinBurn && (
                    <StatCard
                        label="Next burning"
                        amount={prettyAmount(nextCoinBurn.amount)}
                        ticker={asset.ticker}
                        usdValue={nextCoinBurn.usdValue}
                        badge={nextCoinBurn.date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    />
                )}
            </SimpleGrid>

            {burnHistory.length > 0 ? (
                <Box {...cardStyle} overflow="hidden">
                    {/* Desktop table */}
                    <Box display={{base: "none", md: "block"}} overflowX="auto">
                        <Table.Root size="md" variant="outline">
                            <Table.Header>
                                <Table.Row bg="green.500/10">
                                    <Table.ColumnHeader fontWeight="bold">Amount</Table.ColumnHeader>
                                    <Table.ColumnHeader fontWeight="bold">USD value</Table.ColumnHeader>
                                    <Table.ColumnHeader fontWeight="bold">Block height</Table.ColumnHeader>
                                    <Table.ColumnHeader fontWeight="bold">Date</Table.ColumnHeader>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {burnHistory.map((burn, idx) => (
                                    <Table.Row key={idx} bg="transparent">
                                        <Table.Cell>
                                            <Text fontWeight="semibold" color="green.500">
                                                {prettyAmount(burn.amount)} {asset.ticker}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text fontSize="sm" color="fg.muted">
                                                {burn.usdValue.gt(0) ? `$${prettyAmount(burn.usdValue)}` : '-'}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge colorPalette="gray" variant="subtle" size="sm" borderRadius="full">
                                                #{burn.blockHeight}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text fontSize="sm" color="fg.muted">{burn.timestamp}</Text>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </Box>

                    {/* Mobile cards */}
                    <Box display={{base: "block", md: "none"}}>
                        <VStack gap={0} align="stretch">
                            {burnHistory.map((burn, idx) => (
                                <Box
                                    key={idx}
                                    p={4}
                                    borderBottomWidth={idx < burnHistory.length - 1 ? "1px" : "0"}
                                    borderColor="green.500/20"
                                >
                                    <VStack gap={2} align="stretch">
                                        <HStack justify="space-between">
                                            <Text fontWeight="semibold" color="green.500">
                                                {prettyAmount(burn.amount)} {asset.ticker}
                                            </Text>
                                            <Text fontSize="sm" color="fg.muted">
                                                {burn.usdValue.gt(0) ? `$${prettyAmount(burn.usdValue)}` : '-'}
                                            </Text>
                                        </HStack>
                                        <HStack justify="space-between">
                                            <Badge colorPalette="gray" variant="subtle" size="xs" borderRadius="full">
                                                #{burn.blockHeight}
                                            </Badge>
                                            <Text fontSize="xs" color="fg.muted">{burn.timestamp}</Text>
                                        </HStack>
                                    </VStack>
                                </Box>
                            ))}
                        </VStack>
                    </Box>
                </Box>
            ) : (
                <Box {...cardStyle} p={{base: 6, md: 8}}>
                    <VStack gap={2}>
                        <LuFlame size={28} color="var(--chakra-colors-fg-muted)"/>
                        <Text fontWeight="semibold">No burns yet</Text>
                        <Text fontSize="sm" color="fg.muted" textAlign="center" maxW="md">
                            None of {asset.ticker}&apos;s supply has been burned so far.
                        </Text>
                    </VStack>
                </Box>
            )}
        </VStack>
    );
};
