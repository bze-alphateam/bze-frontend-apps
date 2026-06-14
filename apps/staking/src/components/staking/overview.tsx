'use client';

import {Box, Container, Grid, HStack, Text, VStack, Badge} from '@chakra-ui/react';
import {LuTrendingUp, LuClock, LuCoins, LuGift} from 'react-icons/lu';
import {
    useAssets,
    useAssetPrice,
    prettyAmount,
    uAmountToBigNumberAmount,
    formatUsdAmount,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import type {NativeStakingData} from '@bze/bze-ui-kit';

interface OverviewProps {
    stakingData?: NativeStakingData;
    isLoading: boolean;
}

export function StakingOverview({stakingData, isLoading}: OverviewProps) {
    const {nativeAsset} = useAssets();
    const {price: bzePrice} = useAssetPrice(nativeAsset?.denom ?? '');
    const decimals = nativeAsset?.decimals ?? 6;

    if (isLoading || !stakingData) {
        return (
            <Container maxW="7xl" py="6">
                <Grid templateColumns={{base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)'}} gap="4">
                    {[1, 2, 3, 4].map(i => (
                        <Box key={i} bg="bg.panel" borderWidth="1px" borderRadius="lg" p="5" h="120px" />
                    ))}
                </Grid>
            </Container>
        );
    }

    const apr = stakingData.averageApr;
    const totalStakedHuman = uAmountToBigNumberAmount(stakingData.totalStaked.amount, decimals);
    const totalStakedUsd = bzePrice ? totalStakedHuman.multipliedBy(bzePrice) : new BigNumber(0);
    const dailyDistHuman = uAmountToBigNumberAmount(stakingData.averageDailyDistribution.amount, decimals);

    const userStaked = stakingData.currentStaking
        ? uAmountToBigNumberAmount(stakingData.currentStaking.staked.amount, decimals)
        : null;
    const userStakedUsd = userStaked && bzePrice ? userStaked.multipliedBy(bzePrice) : null;
    const userRewards = stakingData.currentStaking
        ? uAmountToBigNumberAmount(stakingData.currentStaking.pendingRewards.total.amount, decimals)
        : null;
    const userRewardsUsd = userRewards && bzePrice ? userRewards.multipliedBy(bzePrice) : null;
    const userUnbonding = stakingData.currentStaking
        ? uAmountToBigNumberAmount(stakingData.currentStaking.unbonding.total.amount, decimals)
        : null;

    const cards = [
        {
            icon: <LuTrendingUp size={20} />,
            label: 'Staking APR',
            value: `${apr}%`,
            subValue: `${prettyAmount(dailyDistHuman)} ${nativeAsset?.ticker}/day distributed`,
            color: 'purple',
        },
        {
            icon: <LuCoins size={20} />,
            label: 'Network Staked',
            value: prettyAmount(totalStakedHuman),
            subValue: totalStakedUsd.gt(0) ? `~${formatUsdAmount(totalStakedUsd)}` : '',
            color: 'blue',
        },
        {
            icon: <LuGift size={20} />,
            label: userStaked ? 'Your Stake' : 'Unbonding Period',
            value: userStaked ? `${prettyAmount(userStaked)} ${nativeAsset?.ticker}` : `${stakingData.unlockDuration} days`,
            subValue: userStaked
                ? (userStakedUsd && userStakedUsd.gt(0) ? `~${formatUsdAmount(userStakedUsd)}` : '')
                : 'Time to unstake tokens',
            color: 'green',
        },
        {
            icon: <LuClock size={20} />,
            label: userRewards ? 'Pending Rewards' : 'Unbonding Period',
            value: userRewards
                ? `${prettyAmount(userRewards)} ${nativeAsset?.ticker}`
                : (userStaked ? `${prettyAmount(userUnbonding ?? new BigNumber(0))} unbonding` : `${stakingData.unlockDuration} days`),
            subValue: userRewards
                ? (userRewardsUsd && userRewardsUsd.gt(0) ? `~${formatUsdAmount(userRewardsUsd)}` : '')
                : (userStaked ? '' : 'Time to unstake tokens'),
            color: 'orange',
            hide: !userRewards && userStaked !== null,
        },
    ];

    // If user is connected and has rewards, replace the 4th card
    // If no user staking, show unbonding period as 3rd and 4th cards are different
    const visibleCards = userStaked !== null
        ? [
            cards[0],
            cards[1],
            cards[2],
            {
                icon: <LuGift size={20} />,
                label: 'Pending Rewards',
                value: `${prettyAmount(userRewards ?? new BigNumber(0))} ${nativeAsset?.ticker}`,
                subValue: userRewardsUsd && userRewardsUsd.gt(0) ? `~${formatUsdAmount(userRewardsUsd)}` : '',
                color: 'orange' as const,
            },
        ]
        : [
            cards[0],
            cards[1],
            {
                icon: <LuClock size={20} />,
                label: 'Unbonding Period',
                value: `${stakingData.unlockDuration} days`,
                subValue: 'Time to unstake tokens',
                color: 'orange' as const,
            },
            {
                icon: <LuGift size={20} />,
                label: 'Daily Distribution',
                value: `${prettyAmount(dailyDistHuman)} ${nativeAsset?.ticker}`,
                subValue: 'Distributed to stakers',
                color: 'green' as const,
            },
        ];

    return (
        <Container maxW="7xl" py="6">
            <VStack align="stretch" gap="6">
                <HStack justify="space-between" align="center">
                    <VStack align="start" gap="1">
                        <HStack gap="3">
                            <Text fontSize={{base: "xl", md: "2xl"}} fontWeight="bold">
                                BZE Staking
                            </Text>
                            <Badge colorPalette="purple" size="lg" variant="subtle">
                                {apr}% APR
                            </Badge>
                        </HStack>
                        <Text fontSize="sm" color="fg.muted">
                            Delegate your BZE tokens to validators and earn staking rewards
                        </Text>
                    </VStack>
                </HStack>

                <Grid templateColumns={{base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)'}} gap="4">
                    {visibleCards.map((card, idx) => (
                        <Box
                            key={idx}
                            bg="bg.panel"
                            borderWidth="1px"
                            borderColor={`${card.color}.500/20`}
                            borderRadius="lg"
                            p="5"
                            transition="all 0.2s"
                            _hover={{borderColor: `${card.color}.500/40`, shadow: 'md'}}
                        >
                            <VStack align="start" gap="3">
                                <HStack gap="2">
                                    <Box color={`${card.color}.500`}>
                                        {card.icon}
                                    </Box>
                                    <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                        {card.label}
                                    </Text>
                                </HStack>
                                <Text fontSize="xl" fontWeight="bold">
                                    {card.value}
                                </Text>
                                {card.subValue && (
                                    <Text fontSize="xs" color="fg.muted">
                                        {card.subValue}
                                    </Text>
                                )}
                            </VStack>
                        </Box>
                    ))}
                </Grid>
            </VStack>
        </Container>
    );
}
