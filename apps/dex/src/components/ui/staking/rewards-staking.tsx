import {
    StakingRewardParticipantSDKType,
    StakingRewardSDKType
} from "@bze/bzejs/bze/rewards/store";
import {Badge, SimpleGrid, Skeleton} from "@chakra-ui/react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useAsset, useLiquidityPools, calculateRewardsStakingApr, calculateRewardsStakingPendingRewards, shortNumberFormat, isLpDenom, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, useAssetPrice, removeLeadingZeros, TokenLogo, LPTokenLogo, hgVariant} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {ExtendedPendingUnlockParticipantSDKType} from "@bze/bze-ui-kit";
import {
    RewardStakingAlert,
    TYPE_REWARDS,
    TYPE_STAKING,
    TYPE_UNLOCK
} from "@/components/ui/staking/rewards-staking-alerts";
import {
    KindTag, MiniStat, MiniStats, ProgramProgress, StakeToEarn, StakingCard, StakingCardHeader, VerifiedPill,
} from "@/components/ui/staking/staking-card-parts";

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
    const {getPoolByLpDenom} = useLiquidityPools()

    const stakingLpDenoms = useMemo(() => {
        if (!isStakingLp || !stakingReward?.staking_denom) return { base: '', quote: '' }
        const pool = getPoolByLpDenom(stakingReward.staking_denom)
        return pool ? { base: pool.base, quote: pool.quote } : { base: '', quote: '' }
    }, [isStakingLp, stakingReward?.staking_denom, getPoolByLpDenom])

    const prizeLpDenoms = useMemo(() => {
        if (!isPrizeLp || !stakingReward?.prize_denom) return { base: '', quote: '' }
        const pool = getPoolByLpDenom(stakingReward.prize_denom)
        return pool ? { base: pool.base, quote: pool.quote } : { base: '', quote: '' }
    }, [isPrizeLp, stakingReward?.prize_denom, getPoolByLpDenom])

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

    const stakingTile = isStakingLp && stakingBaseAsset && stakingQuoteAsset ? (
        <LPTokenLogo
            baseAssetLogo={stakingBaseAsset.logo}
            quoteAssetLogo={stakingQuoteAsset.logo}
            baseAssetSymbol={stakingBaseAsset.ticker}
            quoteAssetSymbol={stakingQuoteAsset.ticker}
            size="8"
        />
    ) : (
        <TokenLogo src={stakingAsset?.logo} symbol={stakingAsset?.ticker ?? ''} size="8"/>
    )
    const prizeTile = isPrizeLp && prizeBaseAsset && prizeQuoteAsset ? (
        <LPTokenLogo
            baseAssetLogo={prizeBaseAsset.logo}
            quoteAssetLogo={prizeQuoteAsset.logo}
            baseAssetSymbol={prizeBaseAsset.ticker}
            quoteAssetSymbol={prizeQuoteAsset.ticker}
            size="8"
        />
    ) : (
        <TokenLogo src={prizeAsset?.logo} symbol={prizeAsset?.ticker ?? ''} size="8"/>
    )
    const title = `${stakingAsset?.ticker} #${rewardNumber}`

    return (
        <Skeleton asChild loading={isLoading}>
            <StakingCard
                state={hasUserStake ? 'staked' : hasUnbonding ? 'unlocking' : 'default'}
                label={title}
                onClick={onBoxClick}
            >
                <StakingCardHeader
                    tile={stakingTile}
                    title={title}
                    tags={(
                        <>
                            <KindTag>Simple reward</KindTag>
                            <Badge
                                variant={hgVariant(stakingStatus === 'active' ? 'success' : stakingStatus === 'finished' ? 'neutral' : 'warning')}
                                borderRadius="full"
                                px="8px"
                            >
                                {stakingStatus === 'active' ? 'Running' : stakingStatus === 'finished' ? 'Finished' : 'Waiting for stakers'}
                            </Badge>
                            {areAssetsVerified && <VerifiedPill/>}
                        </>
                    )}
                    apr={calculatedApr !== '' ? calculatedApr : undefined}
                />

                <ProgramProgress remaining={remainingDays} duration={stakingReward?.duration} percent={progressPercentage}/>

                <StakeToEarn
                    stakeTile={stakingTile}
                    stakeTicker={stakingAsset?.ticker}
                    earnTile={prizeTile}
                    earnTicker={prizeAsset?.ticker}
                />

                {/* The user's figures */}
                {(hasUserStake || hasUnbonding) && (
                    <SimpleGrid
                        columns={{
                            base: 1,
                            sm: hasUserStake && hasUnbonding ? 2 : (hasUserStake ? 2 : 1),
                            md: hasUserStake && hasUnbonding ? 3 : (hasUserStake ? 2 : 1)
                        }}
                        gap="10px"
                    >
                        {hasUserStake && <RewardStakingAlert type={TYPE_STAKING} text={yourStake} />}
                        {hasUserStake && <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards} />}
                        {hasUnbonding && <RewardStakingAlert type={TYPE_UNLOCK} text={pendingUnlock} />}
                    </SimpleGrid>
                )}

                <MiniStats>
                    <MiniStat label="Unlock">{stakingReward?.lock} days</MiniStat>
                    <MiniStat label="Daily" sub={hasUserStake && userDailyReward ? `You: ${userDailyReward}` : undefined}>
                        {dailyDistribution}
                    </MiniStat>
                    <MiniStat label="Minimum">{minStake}</MiniStat>
                    <MiniStat label="Total">{totalStaked}</MiniStat>
                </MiniStats>
            </StakingCard>
        </Skeleton>
    );
}
