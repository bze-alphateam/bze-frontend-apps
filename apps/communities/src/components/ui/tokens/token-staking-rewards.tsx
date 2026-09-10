'use client';

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Box, HStack, Skeleton, Text, VStack} from "@chakra-ui/react";
import {LuArrowDownToLine, LuArrowUpFromLine, LuSprout} from "react-icons/lu";
import {Asset} from "@bze/bze-ui-kit";
import {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";

import {useRewardsStakingData} from "@/hooks/useRewardsStakingData";
import {RewardsStakingBox} from "@/components/ui/staking/rewards-staking";
import {RewardsStakingActionModal} from "@/components/ui/staking/rewards-staking-modals";

// Same cadence as the DEX staking page: refresh programs and positions periodically.
const STAKING_DATA_RELOAD_INTERVAL = 150_000;

const isCompleted = (sr: StakingRewardSDKType) => sr.payouts >= sr.duration;

const SectionHeading = ({icon, title, subtitle}: { icon: React.ReactNode; title: string; subtitle: string }) => (
    <HStack gap={3} align="center">
        <Box
            p={2}
            bg="green.500/10"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="green.500/20"
            color="green.500"
            flexShrink={0}
        >
            {icon}
        </Box>
        <VStack align="start" gap={0} minW={0}>
            <Text fontWeight="bold" fontSize={{base: "md", md: "lg"}}>{title}</Text>
            <Text fontSize="xs" color="fg.muted">{subtitle}</Text>
        </VStack>
    </HStack>
);

export const TokenStakingRewards = ({asset}: { asset: Asset }) => {
    const {rewards, isLoading, addressData, reload} = useRewardsStakingData();
    const [selectedStaking, setSelectedStaking] = useState<StakingRewardSDKType | undefined>();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Completed programs (payouts >= duration) sort after active ones; within the same
    // completion state, programs the user is staking in come first (Business Logic §5).
    const sortPrograms = useCallback((list: StakingRewardSDKType[]) => {
        return [...list].sort((a, b) => {
            const aDone = isCompleted(a);
            const bDone = isCompleted(b);
            if (aDone !== bDone) return aDone ? 1 : -1;

            const aStaked = !!addressData?.active.get(a.reward_id);
            const bStaked = !!addressData?.active.get(b.reward_id);
            if (aStaked !== bStaked) return aStaked ? -1 : 1;

            return 0;
        });
    }, [addressData]);

    // Group by direction relative to the page token (Business Logic §5). A self-staking
    // program (staking_denom === prize_denom === token) belongs to the "stake" group.
    const {stakeThisToken, earnThisToken} = useMemo(() => {
        const denom = asset.denom;
        const stake: StakingRewardSDKType[] = [];
        const earn: StakingRewardSDKType[] = [];
        rewards.forEach(sr => {
            if (sr.staking_denom === denom) {
                stake.push(sr);
            } else if (sr.prize_denom === denom) {
                earn.push(sr);
            }
        });

        return {stakeThisToken: sortPrograms(stake), earnThisToken: sortPrograms(earn)};
    }, [rewards, asset.denom, sortPrograms]);

    const hasPrograms = stakeThisToken.length > 0 || earnThisToken.length > 0;

    const openModal = useCallback((sr?: StakingRewardSDKType) => {
        if (!sr) return;
        setSelectedStaking(sr);
        setIsModalOpen(true);
    }, []);
    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedStaking(undefined);
    }, []);
    const onModalAction = useCallback(() => {
        reload();
        closeModal();
    }, [reload, closeModal]);

    useEffect(() => {
        const interval = setInterval(() => reload(), STAKING_DATA_RELOAD_INTERVAL);

        return () => clearInterval(interval);
    }, [reload]);

    return (
        <Box
            bgGradient="to-br"
            gradientFrom="green.500/8"
            gradientTo="green.600/8"
            borderWidth="1px"
            borderColor="green.500/20"
            borderRadius="xl"
            shadow="sm"
            p={{base: 4, md: 6}}
        >
            <VStack align="stretch" gap={5}>
                <HStack gap={2} align="center">
                    <LuSprout size={18} color="var(--chakra-colors-green-500)"/>
                    <Text fontWeight="bold" fontSize={{base: "lg", md: "xl"}}>Staking rewards</Text>
                </HStack>

                {isLoading && (
                    <VStack align="stretch" gap={3}>
                        <Skeleton height="120px" borderRadius="xl"/>
                        <Skeleton height="120px" borderRadius="xl"/>
                    </VStack>
                )}

                {!isLoading && !hasPrograms && (
                    <Box
                        borderWidth="1px"
                        borderColor="border.subtle"
                        borderRadius="lg"
                        bg="bg.surface"
                        p={6}
                    >
                        <VStack gap={1}>
                            <Text fontWeight="semibold">No staking programs yet</Text>
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                There are no reward programs involving {asset.ticker} at the moment.
                            </Text>
                        </VStack>
                    </Box>
                )}

                {!isLoading && stakeThisToken.length > 0 && (
                    <VStack align="stretch" gap={3}>
                        <SectionHeading
                            icon={<LuArrowUpFromLine size={18}/>}
                            title={`Stake ${asset.ticker} to earn`}
                            subtitle={`Programs where you stake ${asset.ticker} to earn other coins`}
                        />
                        {stakeThisToken.map(sr => (
                            <RewardsStakingBox
                                key={sr.reward_id}
                                stakingReward={sr}
                                userStake={addressData?.active.get(sr.reward_id)}
                                userUnlocking={addressData?.unlocking.get(sr.reward_id)}
                                onClick={openModal}
                            />
                        ))}
                    </VStack>
                )}

                {!isLoading && earnThisToken.length > 0 && (
                    <VStack align="stretch" gap={3}>
                        <SectionHeading
                            icon={<LuArrowDownToLine size={18}/>}
                            title={`Earn ${asset.ticker} by staking`}
                            subtitle={`Programs where you stake other coins to earn ${asset.ticker}`}
                        />
                        {earnThisToken.map(sr => (
                            <RewardsStakingBox
                                key={sr.reward_id}
                                stakingReward={sr}
                                userStake={addressData?.active.get(sr.reward_id)}
                                userUnlocking={addressData?.unlocking.get(sr.reward_id)}
                                onClick={openModal}
                            />
                        ))}
                    </VStack>
                )}
            </VStack>

            {isModalOpen && (
                <RewardsStakingActionModal
                    stakingReward={selectedStaking}
                    userStake={addressData?.active.get(selectedStaking?.reward_id ?? '')}
                    userUnlocking={addressData?.unlocking.get(selectedStaking?.reward_id ?? '')}
                    onClose={closeModal}
                    onActionPerformed={onModalAction}
                />
            )}
        </Box>
    );
};
