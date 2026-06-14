'use client';

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Box,
    Container,
    Text,
    Input,
    Card,
    VStack,
    Grid, Skeleton, Badge, HStack, Spacer,
} from '@chakra-ui/react';
import {
    LuSearch,
} from 'react-icons/lu';
import {useNativeStakingData} from "@/hooks/useNativeStakingData";
import {NativeStakingCard} from "@/components/ui/staking/native-staking";
import {RewardsStakingBox} from "@/components/ui/staking/rewards-staking";
import {useRewardsStakingData} from "@/hooks/useRewardsStakingData";
import {useAssets, prettyAmount, uAmountToBigNumberAmount, shortNumberFormat, calculateRewardsStakingPendingRewards, useAssetsValue} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {RewardsStakingActionModal} from "@/components/ui/staking/rewards-staking-modals";
import {PrettyBalance} from "@bze/bze-ui-kit";

//150 seconds
const STAKING_DATA_RELOAD_INTERVAL = 150_000;

const StakingPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaking, setSelectedStaking] = useState<StakingRewardSDKType | undefined>();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // summary
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [stakedUsdValue, setStakedUsdValue] = useState<BigNumber>(new BigNumber(0));
    //the total amount of BZE pending rewards (from any kind of staking - native or staking reward)
    const [pendingBzeRedwards, setPendingBzeRewards] = useState<BigNumber>(new BigNumber(0));
    // the total value of the pending rewards in USDC (BZE + other rewards)
    const [pendingUsdRewards, setPendingUsdRewards] = useState<BigNumber>(new BigNumber(0));
    // the number of other unique assets in pending rewards
    const [pendingOtherRewards, setPendingOtherRewards] = useState<number>(0);

    const {stakingData, isLoading, reload} = useNativeStakingData()
    const {rewards: stakingRewards, isLoading: isLoadingStakingRewards, addressData, reload: reloadRewardsStaking} = useRewardsStakingData()
    const {isVerifiedAsset, denomTicker, nativeAsset, denomDecimals} = useAssets()
    const {totalUsdValue} = useAssetsValue()

    const allActiveStakingRewardsCount = useMemo(() => stakingRewards.filter(sr => sr.payouts < sr.duration).length + 1, [stakingRewards])

    const stakingCount = useMemo(() => {
        let totalCount = 0
        if (stakingData?.currentStaking?.staked.amount.gt(0)) {
            totalCount += 1
        }

        if (!addressData) return totalCount;

        return totalCount + addressData.active.size
    }, [stakingData, addressData])
    const filteredOpportunities = useMemo(() => {
        return stakingRewards.filter(
            sr =>
                denomTicker(sr.staking_denom).toLowerCase().includes(searchTerm.toLowerCase()) ||
                denomTicker(sr.prize_denom).toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => {
            const aData = addressData?.active.get(a.reward_id)
            const bData = addressData?.active.get(b.reward_id)
            if (aData && !bData) return -1;
            if (!aData && bData) return 1;

            const aPending = addressData?.unlocking.get(a.reward_id)
            const bPending = addressData?.unlocking.get(b.reward_id)
            if (aPending && !bPending) return -1;
            if (!aPending && bPending) return 1;

            const aVerified = isVerifiedAsset(a.staking_denom) && isVerifiedAsset(a.prize_denom)
            const bVerified = isVerifiedAsset(b.staking_denom) && isVerifiedAsset(b.prize_denom)
            if (aVerified && !bVerified) return -1;
            if (!aVerified && bVerified) return 1;

            const stakedA = new BigNumber(a.staked_amount || 0)
            const stakedB = new BigNumber(b.staked_amount || 0)
            if (stakedA.gt(stakedB)) return -1;
            if (stakedA.lt(stakedB)) return 1;

            return 0
        })
    }, [stakingRewards, searchTerm, addressData, isVerifiedAsset, denomTicker]);

    const loadSummary = useCallback(() => {
        if (!stakingData || !stakingRewards || !nativeAsset) return;

        const totalStaked: PrettyBalance[] = []
        const bzeAmount = uAmountToBigNumberAmount(stakingData.totalStaked.amount, nativeAsset.decimals ?? 6)
        if (bzeAmount) {
            totalStaked.push({
                amount: bzeAmount,
                denom: nativeAsset.denom
            })
        }

        // initialize pending rewards in BZE to the native staking pending rewards
        let pendingBzeAmount = uAmountToBigNumberAmount(stakingData.currentStaking?.pendingRewards.total.amount || new BigNumber(0), nativeAsset.decimals)
        let pendingRewardsAssetsCount = 0;
        const totalPending: Map<string, PrettyBalance> = new Map<string, PrettyBalance>();
        stakingRewards.forEach(sr => {
            const balance = {
                amount: uAmountToBigNumberAmount(sr.staked_amount || 0, denomDecimals(sr.staking_denom)),
                denom: sr.staking_denom
            }

            totalStaked.push(balance)
            const userStake = addressData?.active.get(sr.reward_id)
            if (!userStake) return;

            const pendingRewards = calculateRewardsStakingPendingRewards(sr, userStake)
            if (pendingRewards.isNaN() || pendingRewards.isZero()) return;

            let pendingRewardsAmount = uAmountToBigNumberAmount(pendingRewards, denomDecimals(sr.prize_denom))
            if (sr.prize_denom === nativeAsset.denom) {
                pendingBzeAmount = pendingBzeAmount.plus(pendingRewardsAmount)
                return
            }

            pendingRewardsAssetsCount += 1;
            if (totalPending.has(sr.prize_denom)) {
                const existingPending = totalPending.get(sr.prize_denom)
                if (existingPending) {
                    pendingRewardsAmount = pendingRewardsAmount.plus(existingPending.amount)
                }
            }

            totalPending.set(
                sr.prize_denom,
                {
                    amount: pendingRewardsAmount,
                    denom: sr.prize_denom
                }
            )
        })

        if (pendingBzeAmount.gt(0)) {
            totalPending.set(
                nativeAsset.denom,
                {
                    amount: pendingBzeAmount,
                    denom: nativeAsset.denom
                }
            )
        }

        setPendingOtherRewards(pendingRewardsAssetsCount)
        setPendingBzeRewards(pendingBzeAmount)
        setStakedUsdValue(totalUsdValue(totalStaked))
        setPendingUsdRewards(totalUsdValue(Array.from(totalPending.values())))

        setSummaryLoading(false)
    }, [stakingData, stakingRewards, nativeAsset, denomDecimals, totalUsdValue, addressData])
    const openModal = useCallback((staking: StakingRewardSDKType) => {
        setSelectedStaking(staking);
        setIsModalOpen(true);
    }, []);
    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedStaking(undefined);
    }, []);
    const onModalAction = useCallback(() => {
        reloadRewardsStaking()
        closeModal()
        loadSummary()
    }, [reloadRewardsStaking, closeModal, loadSummary]);

    useEffect(() => {
        loadSummary()
    }, [loadSummary])
    useEffect(() => {
        const reloadInterval = setInterval(() => {
            reload()
            reloadRewardsStaking()
        }, STAKING_DATA_RELOAD_INTERVAL)

        return () => {
            clearInterval(reloadInterval)
        }
    }, [reload, reloadRewardsStaking])

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="7xl" py={12}>
                <VStack align="stretch" gap="8">
                    {/* Page Header */}
                    <VStack gap={3} align="center" mb={4}>
                        <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight">
                            Staking & Rewards
                        </Text>
                        <Text fontSize="md" color="fg.muted">
                            Earn passive income by staking and locking your tokens
                        </Text>
                    </VStack>

                    {/* Search */}
                    <Box
                        p={6}
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="blue.600/8"
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                        shadow="sm"
                    >
                        <HStack gap={4} wrap="wrap">
                            <Box position="relative" flex="1" minW="300px" maxW="500px">
                                <Input
                                    placeholder="Search staking opportunities..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    pl="12"
                                    size="lg"
                                    borderRadius="lg"
                                />
                                <Box
                                    position="absolute"
                                    left="4"
                                    top="50%"
                                    transform="translateY(-50%)"
                                    color="fg.muted"
                                >
                                    <LuSearch size={20} />
                                </Box>
                            </Box>
                            <Spacer />
                            <Badge
                                variant="outline"
                                colorPalette="gray"
                                fontSize="md"
                                px={4}
                                py={2}
                                borderRadius="lg"
                            >
                                {allActiveStakingRewardsCount} staking rewards
                            </Badge>
                        </HStack>
                    </Box>

                {/* Stats Overview */}
                <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap="3">
                    <Card.Root
                        borderRadius="lg"
                        borderWidth="1px"
                        shadow="sm"
                        bgGradient="to-br"
                        gradientFrom="green.500/8"
                        gradientTo="blue.500/8"
                        borderColor="green.500/20"
                    >
                        <Card.Body p={4}>
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    Total Value Staked
                                </Text>
                                <Skeleton asChild loading={summaryLoading}>
                                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                        ≈ ${shortNumberFormat(stakedUsdValue)}
                                    </Text>
                                </Skeleton>
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                    <Card.Root
                        borderRadius="lg"
                        borderWidth="1px"
                        shadow="sm"
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="blue.600/8"
                        borderColor="blue.500/20"
                    >
                        <Card.Body p={4}>
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    Active Stakes
                                </Text>
                                <Skeleton asChild loading={summaryLoading}>
                                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                        {stakingCount}
                                    </Text>
                                </Skeleton>
                                <Text fontSize="xs" color="blue.500" fontWeight="medium">
                                    Earning rewards
                                </Text>
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                    <Card.Root
                        borderRadius="lg"
                        borderWidth="1px"
                        shadow="sm"
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="cyan.500/8"
                        borderColor="blue.500/20"
                    >
                        <Card.Body p={4}>
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    Unclaimed Rewards
                                </Text>
                                <Skeleton asChild loading={summaryLoading}>
                                    <Box display="flex" alignItems="baseline" gap="1">
                                        <Text fontSize="xl" fontWeight="bold" letterSpacing="tight">
                                            {prettyAmount(pendingBzeRedwards)} {nativeAsset?.ticker}
                                        </Text>
                                        {pendingOtherRewards > 0 && (
                                            <Text fontSize="sm" color="fg.muted">
                                                {` + ${pendingOtherRewards}`}
                                            </Text>
                                        )}
                                    </Box>
                                </Skeleton>
                                <Skeleton asChild loading={summaryLoading}>
                                    <Text fontSize="xs" color="blue.500" fontWeight="medium">
                                        ≈ ${prettyAmount(pendingUsdRewards)}
                                    </Text>
                                </Skeleton>
                            </VStack>
                        </Card.Body>
                    </Card.Root>
                </Grid>

                {/* Staking Opportunities */}
                <VStack gap={3} align="stretch">
                    <NativeStakingCard
                        stakingData={stakingData}
                        isLoading={isLoading}
                        onClaimSuccess={reload}
                    />
                    {!isLoadingStakingRewards && filteredOpportunities.map((sr) => (
                        <RewardsStakingBox
                            key={sr.reward_id}
                            stakingReward={sr}
                            userStake={addressData?.active.get(sr.reward_id)}
                            userUnlocking={addressData?.unlocking.get(sr.reward_id)}
                            onClick={() => openModal(sr)}
                        />
                    ))}
                </VStack>

                {/* Action Modal */}
                {isModalOpen && (
                    <RewardsStakingActionModal
                        stakingReward={selectedStaking}
                        userStake={addressData?.active.get(selectedStaking?.reward_id ?? '')}
                        userUnlocking={addressData?.unlocking.get(selectedStaking?.reward_id ?? '')}
                        onClose={closeModal}
                        onActionPerformed={onModalAction}
                    />)}
            </VStack>
        </Container>
        </Box>
    );
};

export default StakingPage;