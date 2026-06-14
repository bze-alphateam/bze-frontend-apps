import {
    StakingRewardParticipantSDKType,
    StakingRewardSDKType
} from "@bze/bzejs/bze/rewards/store";
import {
    Badge, Box,
    Card,
    Heading,
    HStack,
    Progress,
    Skeleton,
    Text,
    VStack,
    SimpleGrid
} from "@chakra-ui/react";
import {LuClock, LuCoins, LuLock, LuShield, LuTrendingUp} from "react-icons/lu";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useAsset, calculateRewardsStakingApr, calculateRewardsStakingPendingRewards, shortNumberFormat, isLpDenom, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, useAssetPrice, removeLeadingZeros, TokenLogo, LPTokenLogo} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {ExtendedPendingUnlockParticipantSDKType} from "@bze/bze-ui-kit";
import {
    RewardStakingAlert,
    TYPE_REWARDS,
    TYPE_STAKING,
    TYPE_UNLOCK
} from "@/components/ui/staking/rewards-staking-alerts";

interface RewardsStakingBoxProps {
    stakingReward?: StakingRewardSDKType;
    onClick?: (sr?: StakingRewardSDKType) => void;
    userStake?: StakingRewardParticipantSDKType;
    userUnlocking?: ExtendedPendingUnlockParticipantSDKType[];
}

export const RewardsStakingBox = ({stakingReward, onClick, userStake, userUnlocking} : RewardsStakingBoxProps) => {
    const [isLoading, setIsLoading] = useState(true)

    const {asset: stakingAsset, isLoading: stakingAssetIsLoading} = useAsset(stakingReward?.staking_denom ?? '')
    const {asset: prizeAsset, isLoading: prizeAssetIsLoading} = useAsset(stakingReward?.prize_denom ?? '')
    const {uAmountUsdValue: stakingAssetValue, hasPrice: stakingAssetHasPrice} = useAssetPrice(stakingReward?.staking_denom ?? "")
    const {uAmountUsdValue: prizeAssetValue, hasPrice: prizeAssetHasPrice} = useAssetPrice(stakingReward?.prize_denom ?? "")

    // Check if staking asset is LP token and fetch base/quote assets
    const isStakingLp = useMemo(() => isLpDenom(stakingReward?.staking_denom ?? ''), [stakingReward?.staking_denom])
    const isPrizeLp = useMemo(() => isLpDenom(stakingReward?.prize_denom ?? ''), [stakingReward?.prize_denom])

    const stakingLpDenoms = useMemo(() => {
        if (!isStakingLp || !stakingReward?.staking_denom) return { base: '', quote: '' }
        const split = stakingReward.staking_denom.split('_')
        return split.length === 3 ? { base: split[1], quote: split[2] } : { base: '', quote: '' }
    }, [isStakingLp, stakingReward?.staking_denom])

    const prizeLpDenoms = useMemo(() => {
        if (!isPrizeLp || !stakingReward?.prize_denom) return { base: '', quote: '' }
        const split = stakingReward.prize_denom.split('_')
        return split.length === 3 ? { base: split[1], quote: split[2] } : { base: '', quote: '' }
    }, [isPrizeLp, stakingReward?.prize_denom])

    const {asset: stakingBaseAsset} = useAsset(stakingLpDenoms.base)
    const {asset: stakingQuoteAsset} = useAsset(stakingLpDenoms.quote)
    const {asset: prizeBaseAsset} = useAsset(prizeLpDenoms.base)
    const {asset: prizeQuoteAsset} = useAsset(prizeLpDenoms.quote)

    const onBoxClick = useCallback(() => {
        if (onClick && stakingReward) {
            onClick(stakingReward)
        }
    }, [stakingReward, onClick])

    const calculatedApr = useMemo(() => {
        if (!stakingReward) {
            return ""
        }

        let prizeAmount = new BigNumber(stakingReward.prize_amount)
        let stakedAmount = new BigNumber(stakingReward.staked_amount)
        if (stakingReward.prize_denom !== stakingReward.staking_denom) {
            //if we have different denoms we need to transform the amounts in USD so we can calculate the APR
            if (!stakingAssetHasPrice || !prizeAssetHasPrice) {
                return ""
            }

            stakedAmount = stakingAssetValue(stakedAmount, stakingAsset?.decimals ?? 0)
            prizeAmount = prizeAssetValue(prizeAmount, prizeAsset?.decimals ?? 0)
            if (prizeAmount.isNaN() || !prizeAmount.gt(0)) {
                return ""
            }
        }

        if (stakedAmount.isNaN() || !stakedAmount.gt(0)) {
            return ""
        }

        const apr = calculateRewardsStakingApr(prizeAmount, stakedAmount)

        return `≈${apr.toString()}%`
    }, [prizeAsset?.decimals, prizeAssetHasPrice, prizeAssetValue, stakingAsset?.decimals, stakingAssetHasPrice, stakingAssetValue, stakingReward])
    const dailyDistribution = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingReward?.prize_amount, prizeAsset?.decimals || 0))} ${prizeAsset?.ticker}`
    }, [stakingReward, prizeAsset])
    const minStake = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingReward?.min_stake, stakingAsset?.decimals || 0))} ${stakingAsset?.ticker}`
    }, [stakingReward, stakingAsset])
    const totalStaked = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingReward?.staked_amount, stakingAsset?.decimals || 0))} ${stakingAsset?.ticker}`
    }, [stakingReward, stakingAsset])
    const hasUserStake = useMemo(() => !!userStake, [userStake])
    const hasUnbonding = useMemo(() => !!userUnlocking, [userUnlocking])
    const yourStake = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(userStake?.amount, stakingAsset?.decimals || 0))} ${stakingAsset?.ticker}`
    }, [userStake, stakingAsset])
    const pendingUnlock = useMemo(() => {
        let allAmounts = toBigNumber(0)
        if (userUnlocking) {
            for (const unlock of userUnlocking) {
                allAmounts = allAmounts.plus(unlock.amount)
            }
        }

        return `${prettyAmount(uAmountToAmount(allAmounts, stakingAsset?.decimals || 0))} ${stakingAsset?.ticker}`
    }, [userUnlocking, stakingAsset])
    const pendingRewards = useMemo(() => {
        const rewardsToClaim = calculateRewardsStakingPendingRewards(stakingReward, userStake)
        if (rewardsToClaim.isZero()) {
            return `0 ${prizeAsset?.ticker}`;
        }

        return `${prettyAmount(uAmountToAmount(rewardsToClaim, prizeAsset?.decimals || 0))} ${prizeAsset?.ticker}`
    }, [stakingReward, userStake, prizeAsset])
    const rewardNumber = useMemo(() => {
        return removeLeadingZeros(stakingReward?.reward_id ?? '000')
    }, [stakingReward])

    const remainingDays = useMemo(() => {
        if (!stakingReward) {
            return 0
        }

        return stakingReward.duration - stakingReward.payouts
    }, [stakingReward])

    const stakingStatus = useMemo(() => {
        if (!stakingReward) {
            return 'waiting'
        }

        const hasStakers = new BigNumber(stakingReward.staked_amount).gt(0)

        // Finished: all payouts done (remaining days = 0)
        if (remainingDays === 0) {
            return 'finished'
        }

        // Active: has stakers and still has days remaining
        if (hasStakers && remainingDays > 0) {
            return 'active'
        }

        // Waiting: has days remaining but no stakers yet
        return 'waiting'
    }, [stakingReward, remainingDays])

    const areAssetsVerified = useMemo(() => {
        return stakingAsset?.verified && prizeAsset?.verified
    }, [stakingAsset, prizeAsset])

    const progressPercentage = useMemo(() => {
        if (!stakingReward || stakingReward.duration === 0) {
            return 0
        }
        return (stakingReward.payouts / stakingReward.duration) * 100
    }, [stakingReward])

    const userStakePercentage = useMemo(() => {
        if (!userStake || !stakingReward) {
            return new BigNumber(0)
        }
        const userAmount = new BigNumber(userStake.amount)
        const totalStaked = new BigNumber(stakingReward.staked_amount)

        if (totalStaked.isZero()) {
            return new BigNumber(0)
        }

        return userAmount.dividedBy(totalStaked).multipliedBy(100)
    }, [userStake, stakingReward])

    const userDailyReward = useMemo(() => {
        if (!userStake || !stakingReward || userStakePercentage.isZero()) {
            return ""
        }

        const dailyAmount = uAmountToBigNumberAmount(stakingReward.prize_amount, prizeAsset?.decimals || 0)
        const userShare = dailyAmount.multipliedBy(userStakePercentage).dividedBy(100)

        return `${shortNumberFormat(userShare)} ${prizeAsset?.ticker}`
    }, [userStake, stakingReward, userStakePercentage, prizeAsset])

    useEffect(() => {
        if (stakingReward && !stakingAssetIsLoading && !prizeAssetIsLoading) {
            setIsLoading(false)
        }
    }, [stakingReward, stakingAssetIsLoading, prizeAssetIsLoading])

    return (
        <Skeleton asChild loading={isLoading}>
            <Card.Root
                borderWidth={hasUserStake ? "2px" : "1px"}
                borderColor={hasUserStake ? "blue.500" : (hasUnbonding ? "orange.500" : "border")}
                cursor="pointer"
                transition="all 0.2s"
                bgGradient="to-br"
                gradientFrom={hasUserStake ? "blue.500/5" : (hasUnbonding ? "orange.500/5" : "blue.400/5")}
                gradientTo={hasUserStake ? "blue.600/5" : (hasUnbonding ? "yellow.500/5" : "cyan.500/5")}
                _hover={{
                    gradientFrom: hasUserStake ? "blue.500/10" : (hasUnbonding ? "orange.500/10" : "blue.400/10"),
                    gradientTo: hasUserStake ? "blue.600/10" : (hasUnbonding ? "yellow.500/10" : "cyan.500/10"),
                    transform: "translateY(-2px)",
                    shadow: "lg"
                }}
                onClick={onBoxClick}
                shadow="sm"
            >
                <Card.Header pb="0">
                    <HStack gap="3" justify="space-between" align="center" flexWrap="wrap">
                        <HStack gap="3" flex="1" minW="0">
                            <Box
                                p="2"
                                bg="bg.subtle"
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor="border"
                                flexShrink="0"
                            >
                                {isStakingLp && stakingBaseAsset && stakingQuoteAsset ? (
                                    <LPTokenLogo
                                        baseAssetLogo={stakingBaseAsset.logo}
                                        quoteAssetLogo={stakingQuoteAsset.logo}
                                        baseAssetSymbol={stakingBaseAsset.ticker}
                                        quoteAssetSymbol={stakingQuoteAsset.ticker}
                                        size="8"
                                    />
                                ) : (
                                    <TokenLogo src={stakingAsset?.logo} symbol={stakingAsset?.ticker ?? ''} size="8"/>
                                )}
                            </Box>
                            <VStack align="start" gap="0.5" minW="0">
                                <Heading size="md" lineHeight="1.2">{stakingAsset?.ticker} #{rewardNumber}</Heading>
                                <HStack flexWrap="wrap" gap="1.5" fontSize="xs">
                                    <Badge
                                        colorPalette={stakingStatus === 'active' ? 'green' : stakingStatus === 'finished' ? 'blue' : 'orange'}
                                        variant="subtle"
                                        size="sm"
                                    >
                                        {stakingStatus === 'active' ? 'Running' : stakingStatus === 'finished' ? 'Finished' : 'Waiting for stakers'}
                                    </Badge>
                                    {areAssetsVerified && (
                                        <Badge colorPalette="green" variant="outline" size="sm">
                                            <HStack gap="1">
                                                <LuShield size={10} />
                                                <Text>Verified</Text>
                                            </HStack>
                                        </Badge>
                                    )}
                                </HStack>
                            </VStack>
                        </HStack>

                        {/* APR Box - Far Right */}
                        {calculatedApr !== '' && (
                            <Box flexShrink="0" display={{base: 'none', md: 'flex'}}>
                                <Box
                                    bgGradient="to-br"
                                    gradientFrom="green.500/15"
                                    gradientTo="green.600/15"
                                    borderWidth="1px"
                                    borderColor="green.500/30"
                                    borderRadius="lg"
                                    px={{base: '3', md: '4'}}
                                    py="2.5"
                                    minW={{base: '90px', md: '110px'}}
                                    flex="1"
                                >
                                    <VStack gap="0.5" align="center">
                                        <HStack gap="1" color="green.600">
                                            <LuTrendingUp size={12} />
                                            <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">APR</Text>
                                        </HStack>
                                        <Text fontWeight="bold" fontSize={{base: 'lg', md: 'xl'}} color="green.600" lineHeight="1">{calculatedApr}</Text>
                                    </VStack>
                                </Box>
                            </Box>
                        )}
                    </HStack>
                    <Box display={{base: 'flex', md: 'none'}}>
                        {calculatedApr !== '' && (
                            <Box
                                bgGradient="to-br"
                                gradientFrom="green.500/15"
                                gradientTo="green.600/15"
                                borderWidth="1px"
                                borderColor="green.500/30"
                                borderRadius="lg"
                                px={{base: '3', md: '4'}}
                                py="2.5"
                                w="full"
                            >
                                <VStack gap="0.5" align="center">
                                    <HStack gap="1" color="green.600">
                                        <LuTrendingUp size={12} />
                                        <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">APR</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize={{base: 'lg', md: 'xl'}} color="green.600" lineHeight="1">{calculatedApr}</Text>
                                </VStack>
                            </Box>
                        )}
                    </Box>
                </Card.Header>

                {/* Remaining Days as separator */}
                <Box px="6" py="1.5">
                    <VStack align="stretch" gap="1">
                        <HStack justify="space-between">
                            <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" fontWeight="semibold">
                                {remainingDays} of {stakingReward?.duration} days remaining
                            </Text>
                            <Text fontSize="2xs" color="fg.muted" fontWeight="semibold">
                                {progressPercentage.toFixed(0)}%
                            </Text>
                        </HStack>
                        <Progress.Root value={progressPercentage} size="xs" colorPalette="blue">
                            <Progress.Track>
                                <Progress.Range />
                            </Progress.Track>
                        </Progress.Root>
                    </VStack>
                </Box>

                <Card.Body pt="0">
                    <VStack align="stretch" gap="2">
                        {/* Stake → Earn - Large and prominent */}
                        <Box
                            p="4"
                            bg="bg.emphasized"
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="border.emphasized"
                        >
                            <VStack gap="2">
                                <Text fontSize="xs" color="fg.muted" textTransform="uppercase" fontWeight="semibold">Stake to Earn</Text>
                                <HStack gap={{base: '3', md: '4'}} justify="center" flexWrap="wrap">
                                    <VStack gap="1" align="center">
                                        <Box p="1.5" bg="bg.panel" borderRadius="md" borderWidth="1px">
                                            {isStakingLp && stakingBaseAsset && stakingQuoteAsset ? (
                                                <LPTokenLogo
                                                    baseAssetLogo={stakingBaseAsset.logo}
                                                    quoteAssetLogo={stakingQuoteAsset.logo}
                                                    baseAssetSymbol={stakingBaseAsset.ticker}
                                                    quoteAssetSymbol={stakingQuoteAsset.ticker}
                                                    size="8"
                                                />
                                            ) : (
                                                <TokenLogo src={stakingAsset?.logo} symbol={stakingAsset?.ticker ?? ''} size="8"/>
                                            )}
                                        </Box>
                                        <VStack align="center" gap="0">
                                            <Text fontSize="xs" color="fg.muted">Stake</Text>
                                            <Text fontWeight="bold" fontSize="md">{stakingAsset?.ticker}</Text>
                                        </VStack>
                                    </VStack>
                                    <Box color="fg.muted" fontSize="xl" display="flex" alignItems="center">→</Box>
                                    <VStack gap="1" align="center">
                                        <Box p="1.5" bg="bg.panel" borderRadius="md" borderWidth="1px">
                                            {isPrizeLp && prizeBaseAsset && prizeQuoteAsset ? (
                                                <LPTokenLogo
                                                    baseAssetLogo={prizeBaseAsset.logo}
                                                    quoteAssetLogo={prizeQuoteAsset.logo}
                                                    baseAssetSymbol={prizeBaseAsset.ticker}
                                                    quoteAssetSymbol={prizeQuoteAsset.ticker}
                                                    size="8"
                                                />
                                            ) : (
                                                <TokenLogo src={prizeAsset?.logo} symbol={prizeAsset?.ticker ?? ''} size="8"/>
                                            )}
                                        </Box>
                                        <VStack align="center" gap="0">
                                            <Text fontSize="xs" color="fg.muted">Earn</Text>
                                            <Text fontWeight="bold" fontSize="md">{prizeAsset?.ticker}</Text>
                                        </VStack>
                                    </VStack>
                                </HStack>
                            </VStack>
                        </Box>

                        {/* User Metrics - Colored Boxes on Same Row */}
                        {(hasUserStake || hasUnbonding) && (
                            <SimpleGrid
                                columns={{
                                    base: 1,
                                    sm: hasUserStake && hasUnbonding ? 2 : (hasUserStake ? 2 : 1),
                                    md: hasUserStake && hasUnbonding ? 3 : (hasUserStake ? 2 : 1)
                                }}
                                gap="2"
                            >
                                {/* Your Stake */}
                                {hasUserStake && (
                                    <RewardStakingAlert type={TYPE_STAKING} text={yourStake} />
                                )}

                                {/* Pending Rewards */}
                                {hasUserStake && (
                                    <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards} />
                                )}

                                {/* Pending Unlock */}
                                {hasUnbonding && (
                                    <RewardStakingAlert type={TYPE_UNLOCK} text={pendingUnlock} />
                                )}
                            </SimpleGrid>
                        )}

                        {/* Stats Grid */}
                        <SimpleGrid columns={{ base: 2, md: 4 }} gap="2">
                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuClock size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Unlock</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">{stakingReward?.lock} days</Text>
                                </VStack>
                            </Box>

                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuCoins size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Daily</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">{dailyDistribution}</Text>
                                    {hasUserStake && userDailyReward && (
                                        <Text fontSize="2xs" color="green.600" fontWeight="medium">
                                            You: {userDailyReward}
                                        </Text>
                                    )}
                                </VStack>
                            </Box>

                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuTrendingUp size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Minimum</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">{minStake}</Text>
                                </VStack>
                            </Box>

                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuLock size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Total</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">{totalStaked}</Text>
                                </VStack>
                            </Box>
                        </SimpleGrid>
                    </VStack>
                </Card.Body>
            </Card.Root>
        </Skeleton>
    );
}
