import {
    Alert,
    Badge,
    Box,
    Button,
    Card,
    Field,
    Group,
    Heading,
    HStack,
    Input,
    Skeleton,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react";
import {LuGift, LuLockOpen, LuTrendingUp, LuPercent} from "react-icons/lu";
import React, {useCallback, useMemo, useState} from "react";
import {StakingRewardParticipantSDKType, StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {useAsset, useAssets, useAssetPrice, shortNumberFormat, amountToBigNumberUAmount, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, calculateRewardsStakingPendingRewards, removeLeadingZeros, useBalance, sanitizeNumberInput, useBZETx, getChainName, useToast} from "@bze/bze-ui-kit";
import {ExtendedPendingUnlockParticipantSDKType} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {bze} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import {
    RewardsStakingUnlockAlerts,
    RewardStakingAlert, TYPE_BALANCE, TYPE_REWARDS,
    TYPE_STAKING, TYPE_UNLOCK
} from "@/components/ui/staking/rewards-staking-alerts";
import {PrettyBalance} from "@bze/bze-ui-kit";
import { EncodeObject } from "interchainjs/types";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";

const MODAL_TYPE_ACTIONS = 'actions';
const MODAL_TYPE_STAKE = 'stake';
const MODAL_TYPE_UNSTAKE = 'unstake';
const MODAL_TYPE_CLAIM = 'claim';

const {joinStaking, claimStakingRewards, exitStaking} = bze.rewards.MessageComposer.withTypeUrl;

interface RewardsStakingActionModalProps {
    onClose: () => void;
    stakingReward?: StakingRewardSDKType;
    userStake?: StakingRewardParticipantSDKType;
    userUnlocking?: ExtendedPendingUnlockParticipantSDKType[];
    onActionPerformed?: () => void;
}

export const RewardsStakingActionModal = ({
                                              onClose,
                                              stakingReward,
                                              userStake,
                                              userUnlocking,
                                              onActionPerformed
                                          }: RewardsStakingActionModalProps) => {
    const [modalType, setModalType] = useState(MODAL_TYPE_ACTIONS);
    const [stakeAmount, setStakeAmount] = useState('');
    const [formError, setFormError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const {asset: stakingAsset, isLoading: stakingAssetIsLoading} = useAsset(stakingReward?.staking_denom ?? '')
    const {asset: prizeAsset, isLoading: prizeAssetIsLoading} = useAsset(stakingReward?.prize_denom ?? '')
    const {denomTicker, isLoading: isLoadingAssets} = useAssets()
    const {balance: stakingAssetBalance} = useBalance(stakingReward?.staking_denom ?? '')
    const {address} = useChain(getChainName())
    const {tx, progressTrack} = useBZETx()
    const {toast} = useToast()

    const actionsModalTitle = useMemo(() => {
        if (!stakingReward) return 'Actions';

        return `Stake ${denomTicker(stakingReward.staking_denom)} and earn ${denomTicker(stakingReward.prize_denom)}`
    }, [denomTicker, stakingReward])
    const onCloseClick = () => {
        setModalType(MODAL_TYPE_ACTIONS);
        setStakeAmount('');
        setFormError('');
        onClose();
    }
    const openModal = (type: string) => {
        setModalType(type);
    };

    const minStakeAmount = useMemo(() => {
        if (!stakingReward || !stakingAsset) return new BigNumber(0);

        return uAmountToBigNumberAmount(stakingReward?.min_stake, stakingAsset?.decimals || 0)
    }, [stakingReward, stakingAsset])
    const prettyMinStake = useMemo(() => {
        if (!stakingReward || !stakingAsset) return 'Amount to stake';
        if (!!userStake) return 'Amount to stake';

        return `Min: ${prettyAmount(minStakeAmount)} ${stakingAsset?.ticker}`
    }, [stakingReward, stakingAsset, userStake, minStakeAmount])
    const hasUserStake = useMemo(() => !!userStake, [userStake])
    const hasPendingRewards = useMemo(() => {
        const rewardsToClaim = calculateRewardsStakingPendingRewards(stakingReward, userStake)

        return rewardsToClaim.gt(0)
    }, [stakingReward, userStake])
    const inputEstimatedRewards = useMemo(() => {
        if (!stakingReward || !stakeAmount || !stakingAsset) return '0';

        // (daily reward/(total staked + input)) * input
        //the input the user provides is an AMOUNT, not a UAmount, so we need to convert it to a UAmount
        const stakedUAmount = amountToBigNumberUAmount(stakeAmount, stakingAsset.decimals)
        const incomePerStakedCoin = new BigNumber(stakingReward.prize_amount).dividedBy(new BigNumber(stakingReward.staked_amount).plus(stakedUAmount))
        const dailyReward = incomePerStakedCoin.multipliedBy(stakedUAmount)

        return `${shortNumberFormat(uAmountToBigNumberAmount(dailyReward.integerValue(), prizeAsset?.decimals || 0))} ${prizeAsset?.ticker}`
    }, [stakingReward, prizeAsset, stakeAmount, stakingAsset])

    const { price: rewardTokenPrice } = useAssetPrice(stakingReward?.prize_denom || '');
    const { price: stakingTokenPrice } = useAssetPrice(stakingReward?.staking_denom || '');

    const estimatedDailyRewardsUsd = useMemo(() => {
        if (!stakingReward || !stakeAmount || !stakingAsset || !prizeAsset || !rewardTokenPrice || rewardTokenPrice.lte(0)) return null;

        const stakedUAmount = amountToBigNumberUAmount(stakeAmount, stakingAsset.decimals)
        const incomePerStakedCoin = toBigNumber(stakingReward.prize_amount).dividedBy(toBigNumber(stakingReward.staked_amount).plus(stakedUAmount))
        const dailyReward = incomePerStakedCoin.multipliedBy(stakedUAmount)
        const dailyRewardAmount = uAmountToBigNumberAmount(dailyReward.integerValue(), prizeAsset.decimals)

        return dailyRewardAmount.multipliedBy(rewardTokenPrice);
    }, [stakingReward, stakeAmount, stakingAsset, prizeAsset, rewardTokenPrice]);

    const stakingAPRData = useMemo(() => {
        if (!stakingReward || !stakingAsset || !prizeAsset || !stakingTokenPrice || stakingTokenPrice.lte(0) || !rewardTokenPrice || rewardTokenPrice.lte(0)) {
            return null;
        }

        const currentStaked = toBigNumber(stakingReward.staked_amount);
        if (currentStaked.lte(0)) return null;

        const dailyPrizeUsd = uAmountToBigNumberAmount(stakingReward.prize_amount, prizeAsset.decimals)
            .multipliedBy(rewardTokenPrice);
        const annualRewardsUsd = dailyPrizeUsd.multipliedBy(365);

        // Current APR (before user's stake)
        const currentStakedUsd = uAmountToBigNumberAmount(currentStaked, stakingAsset.decimals).multipliedBy(stakingTokenPrice);
        const currentAPR = currentStakedUsd.gt(0) ? annualRewardsUsd.dividedBy(currentStakedUsd).multipliedBy(100) : toBigNumber(0);

        // New APR (after user's stake)
        if (!stakeAmount || stakeAmount === '0') {
            return { currentAPR, newAPR: null, aprChange: null };
        }

        const stakeUAmount = amountToBigNumberUAmount(stakeAmount, stakingAsset.decimals);
        const newTotalStaked = currentStaked.plus(stakeUAmount);
        const newTotalStakedUsd = uAmountToBigNumberAmount(newTotalStaked, stakingAsset.decimals).multipliedBy(stakingTokenPrice);
        const newAPR = newTotalStakedUsd.gt(0) ? annualRewardsUsd.dividedBy(newTotalStakedUsd).multipliedBy(100) : toBigNumber(0);

        // Calculate percentage change in APR
        const aprChange = currentAPR.gt(0) ? newAPR.minus(currentAPR).dividedBy(currentAPR).multipliedBy(100) : toBigNumber(0);

        return {
            currentAPR,
            newAPR,
            aprChange,
        };
    }, [stakingReward, stakeAmount, stakingAsset, prizeAsset, stakingTokenPrice, rewardTokenPrice]);

    const yourStake = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(userStake?.amount, stakingAsset?.decimals || 0))} ${stakingAsset?.ticker}`
    }, [userStake, stakingAsset])
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
    const unstakeModalTitle = useMemo(() => {
        if (!stakingReward || !denomTicker) return 'Unstake Tokens';

        return `Unstake your ${denomTicker(stakingReward.staking_denom)}`
    }, [stakingReward, denomTicker])
    const claimModalTitle = useMemo(() => {
        if (!stakingReward || !denomTicker) return 'Claim Tokens';

        return `Claim your ${denomTicker(stakingReward.prize_denom)} rewards`
    }, [stakingReward, denomTicker])

    const userStakingAssetBalance = useMemo(() => {
        if (!stakingAssetBalance || !stakingAsset) return '0';

        return uAmountToAmount(stakingAssetBalance?.amount, stakingAsset?.decimals || 0)
    }, [stakingAssetBalance, stakingAsset])
    const userStakingAssetPrettyBalance = useMemo(() => {
        return `${prettyAmount(userStakingAssetBalance)} ${stakingAsset?.ticker}`
    }, [userStakingAssetBalance, stakingAsset])

    const validateStakeAmount = useCallback(() => {
        if (!stakeAmount || !stakingReward) {
            setFormError('')
            return;
        }

        const stakeAmountBN = new BigNumber(stakeAmount)
        if (stakeAmountBN.gt(userStakingAssetBalance)) {
            setFormError('Insufficient balance')
            return;
        }

        //do not validate MIN staking amount if the user is already staking this asset on this staking reward
        if (hasUserStake) {
            setFormError('')
            return;
        }

        if (stakeAmountBN.lt(minStakeAmount)) {
            setFormError(`Min stake is ${prettyAmount(minStakeAmount)} ${stakingAsset?.ticker}`)
            return;
        }

        setFormError('')
    }, [stakingReward, stakingAsset, stakeAmount, hasUserStake, userStakingAssetBalance, minStakeAmount])
    const handleConfirmStake = useCallback(async () => {
        if (!stakingReward || !stakeAmount) return;

        if (!address) {
            setFormError('No wallet connected')
            return;
        }

        const uStakeAmount = amountToBigNumberUAmount(stakeAmount, stakingAsset?.decimals || 0).integerValue()
        if (uStakeAmount.isNaN() || uStakeAmount.isZero()) {
            setFormError('Invalid stake amount provided')
            return;
        }

        if (!userStake && uStakeAmount.lt(stakingReward.min_stake)) {
            setFormError(`Min stake is ${prettyAmount(minStakeAmount)}`)
            return;
        }

        if (!stakingAssetBalance || uStakeAmount.gt(stakingAssetBalance.amount)) {
            setFormError('Insufficient balance')
            return;
        }

        setIsSubmitting(true)
        const msg = joinStaking({
            creator: address,
            rewardId: stakingReward.reward_id,
            amount: uStakeAmount.toString()
        })

        const success = await tx([msg])

        if (success && onActionPerformed) {
            onActionPerformed()
        }

        setIsSubmitting(false)
    }, [stakingReward, stakeAmount, address, stakingAsset, userStake, stakingAssetBalance, tx, onActionPerformed, minStakeAmount])
    const handleUnstake = useCallback(async () => {
        if (!stakingReward) return;

        if (!address) {
            toast.error('No wallet connected')
            return;
        }

        if (!userStake) {
            toast.error('No stake found')
            return;
        }

        setIsSubmitting(true)
        const msg = exitStaking({
            creator: address,
            rewardId: stakingReward.reward_id,
        });

        await tx([msg])

        if (onActionPerformed) {
            onActionPerformed()
        }

        setIsSubmitting(false)
    }, [stakingReward, userStake, address, tx, onActionPerformed, toast])
    const handleRewardsClaim = useCallback(async () => {
        if (!stakingReward) return;

        if (!address) {
            toast.error('No wallet connected')
            return
        }

        if (!hasPendingRewards) {
            toast.error('No rewards to claim')
            return;
        }

        setIsSubmitting(true)
        const msg = claimStakingRewards({
            creator: address,
            rewardId: stakingReward.reward_id,
        })

        await tx([msg])

        if (onActionPerformed) {
            onActionPerformed()
        }

        setIsSubmitting(false)
    }, [stakingReward, address, tx, onActionPerformed, hasPendingRewards, toast])

    return (
        <Skeleton asChild loading={stakingAssetIsLoading || prizeAssetIsLoading || isLoadingAssets}>
            <Box
                position="fixed"
                inset="0"
                bg="blackAlpha.600"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex="modal"
            >
                <Card.Root maxW="md" w="full" mx="4">
                    <Card.Header>
                        <HStack justify="space-between" align="center">
                            <Heading size="lg">
                                {modalType === MODAL_TYPE_STAKE && actionsModalTitle}
                                {modalType === MODAL_TYPE_UNSTAKE && unstakeModalTitle}
                                {modalType === MODAL_TYPE_CLAIM && claimModalTitle}
                                {modalType === MODAL_TYPE_ACTIONS && actionsModalTitle}
                                {' #' + rewardNumber}
                            </Heading>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCloseClick}
                            >
                                ✕
                            </Button>
                        </HStack>
                    </Card.Header>

                    <Card.Body>
                        {modalType === MODAL_TYPE_ACTIONS && stakingReward && (
                            <VStack gap="4">
                                <Text color="fg.muted">{'Stake your tokens and receive daily rewards.'}</Text>
                                {hasUserStake && (
                                    <RewardStakingAlert type={TYPE_STAKING} text={yourStake} />
                                )}
                                <RewardStakingAlert type={TYPE_BALANCE} text={userStakingAssetPrettyBalance} />
                                {hasUserStake && (
                                    <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards} />
                                )}

                                <RewardsStakingUnlockAlerts userUnlocking={userUnlocking}
                                                            ticker={stakingAsset?.ticker || 'coins'}
                                                            decimals={stakingAsset?.decimals || 0}/>

                                <Stack direction={{base: 'column', sm: 'row'}} width="full" gap="3">
                                    <RewardsStakingButton
                                        buttonType={TYPE_STAKING}
                                        variant='outline'
                                        onClick={() => openModal('stake')}
                                    >
                                        <Text>Stake</Text>
                                    </RewardsStakingButton>

                                    <RewardsStakingButton
                                        buttonType={TYPE_UNLOCK}
                                        disabled={!hasUserStake}
                                        onClick={() => openModal('unstake')}
                                    >
                                        <Text>Unstake</Text>
                                    </RewardsStakingButton>

                                    <RewardsStakingButton
                                        buttonType={TYPE_REWARDS}
                                        disabled={!hasPendingRewards}
                                        onClick={() => openModal('claim')}
                                    >
                                        <Text>Claim</Text>
                                    </RewardsStakingButton>
                                </Stack>
                            </VStack>
                        )}

                        {modalType === MODAL_TYPE_STAKE && stakingReward && (
                            <VStack gap="4">
                                <Text>Enter the amount you want to stake:</Text>
                                <Field.Root invalid={formError !== ''}>
                                    <Group attached w="full" maxW="sm">
                                        <Input
                                            autoComplete="off"
                                            placeholder={prettyMinStake}
                                            value={stakeAmount}
                                            onChange={(e) => {
                                                setFormError('')
                                                setStakeAmount(sanitizeNumberInput(e.target.value))
                                            }}
                                            onBlur={validateStakeAmount}
                                            type="text"
                                            size="sm"
                                            disabled={isSubmitting}
                                        />
                                        <Button variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setStakeAmount(userStakingAssetBalance)
                                                }}
                                                disabled={stakingAssetBalance.amount.isZero() || isSubmitting}
                                        >
                                            Max
                                        </Button>
                                    </Group>
                                    <Field.ErrorText>{formError}</Field.ErrorText>
                                </Field.Root>
                                {stakeAmount && (
                                    <VStack gap="3" w="full">
                                        <Alert.Root status="success" variant="subtle" w="full">
                                            <Alert.Indicator/>
                                            <VStack align="start" gap="2" flex="1">
                                                <Alert.Title>Estimated Daily Rewards:</Alert.Title>
                                                <Text fontSize="lg" fontWeight="bold" color="green.600">
                                                    {inputEstimatedRewards}
                                                </Text>
                                                {estimatedDailyRewardsUsd && estimatedDailyRewardsUsd.gt(0) && (
                                                    <Text fontSize="md" fontWeight="medium" color="green.600" _dark={{ color: "green.400" }}>
                                                        ≈ ${shortNumberFormat(estimatedDailyRewardsUsd)}
                                                    </Text>
                                                )}
                                                <Text fontSize="sm" color="gray.600" _dark={{color: "gray.400"}}>
                                                    Unlock period: {stakingReward?.lock || 0} days
                                                </Text>
                                            </VStack>
                                        </Alert.Root>

                                        {/* Show new APR if it changes by more than 10% */}
                                        {stakingAPRData && stakingAPRData.newAPR && stakingAPRData.aprChange && Math.abs(stakingAPRData.aprChange.toNumber()) > 10 && (
                                            <Alert.Root status="info" variant="subtle" w="full">
                                                <Alert.Indicator/>
                                                <VStack align="start" gap="2" flex="1">
                                                    <HStack justify="space-between" w="full">
                                                        <HStack gap="2">
                                                            <LuTrendingUp size={16} />
                                                            <Alert.Title>New Staking APR</Alert.Title>
                                                        </HStack>
                                                        <Badge
                                                            colorPalette={stakingAPRData.aprChange.lt(0) ? "red" : "green"}
                                                            size="sm"
                                                        >
                                                            {stakingAPRData.aprChange.lt(0) ? '' : '+'}{stakingAPRData.aprChange.toFixed(1)}%
                                                        </Badge>
                                                    </HStack>
                                                    <HStack justify="space-between" w="full">
                                                        <Text fontSize="sm" color="blue.600" _dark={{ color: "blue.400" }}>
                                                            Current: {stakingAPRData.currentAPR.toFixed(2)}%
                                                        </Text>
                                                        <Text fontSize="md" fontWeight="bold" color="blue.600" _dark={{ color: "blue.400" }}>
                                                            New: {stakingAPRData.newAPR.toFixed(2)}%
                                                        </Text>
                                                    </HStack>
                                                </VStack>
                                            </Alert.Root>
                                        )}
                                    </VStack>
                                )}

                                <RewardsStakingButton
                                    buttonType={TYPE_STAKING}
                                    disabled={!stakeAmount || stakingAssetBalance.amount.isZero()}
                                    loading={isSubmitting}
                                    loadingText={progressTrack}
                                    onClick={handleConfirmStake}
                                >
                                    <Text>Confirm Stake</Text>
                                </RewardsStakingButton>
                            </VStack>
                        )}

                        {modalType === MODAL_TYPE_UNSTAKE && userStake && (
                            <VStack gap="4">
                                <Box
                                    bgGradient="to-br"
                                    gradientFrom="orange.500/15"
                                    gradientTo="orange.600/15"
                                    borderWidth="1px"
                                    borderColor="orange.500/30"
                                    borderRadius="md"
                                    p="3"
                                    w="full"
                                >
                                    <VStack align="start" gap="2">
                                        <HStack gap="1" color="orange.600">
                                            <LuLockOpen size={14} />
                                            <Text fontSize="sm" fontWeight="semibold" textTransform="uppercase">Unstaking Notice</Text>
                                        </HStack>
                                        <Text fontSize="sm" color="fg.muted">
                                            Your funds will be locked for {stakingReward?.lock || 0} days. You will
                                            receive them after the lock period ends.
                                        </Text>
                                    </VStack>
                                </Box>

                                <Box
                                    bgGradient="to-br"
                                    gradientFrom="blue.500/15"
                                    gradientTo="blue.600/15"
                                    borderWidth="1px"
                                    borderColor="blue.500/30"
                                    borderRadius="md"
                                    p="3"
                                    w="full"
                                >
                                    <VStack align="start" gap="0.5">
                                        <HStack gap="1" color="blue.600">
                                            <LuPercent size={12} />
                                            <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">Amount to Unstake</Text>
                                        </HStack>
                                        <Text fontWeight="bold" fontSize="lg">{yourStake}</Text>
                                    </VStack>
                                </Box>

                                <RewardsStakingButton
                                    buttonType={TYPE_UNLOCK}
                                    disabled={!userStake}
                                    loading={isSubmitting}
                                    loadingText={progressTrack || 'Unstaking...'}
                                    onClick={handleUnstake}
                                >
                                    <Text>Confirm Unstake</Text>
                                </RewardsStakingButton>
                            </VStack>
                        )}

                        {modalType === MODAL_TYPE_CLAIM && userStake && (
                            <VStack gap="4">
                                <Box
                                    bgGradient="to-br"
                                    gradientFrom="blue.500/15"
                                    gradientTo="blue.600/15"
                                    borderWidth="1px"
                                    borderColor="purple.500/30"
                                    borderRadius="md"
                                    p="4"
                                    w="full"
                                >
                                    <VStack align="start" gap="2">
                                        <HStack gap="1" color="purple.600">
                                            <LuGift size={14} />
                                            <Text fontSize="sm" fontWeight="semibold" textTransform="uppercase">Rewards</Text>
                                        </HStack>
                                        <Text fontSize="lg" fontWeight="bold">
                                            {pendingRewards}
                                        </Text>
                                    </VStack>
                                </Box>

                                <Button
                                    colorPalette="purple"
                                    variant="outline"
                                    width="full"
                                    disabled={!userStake || !hasPendingRewards}
                                    loading={isSubmitting}
                                    loadingText={progressTrack || 'Claiming rewards...'}
                                    onClick={handleRewardsClaim}
                                >
                                    <LuGift size={16}/>
                                    <Text>Claim Rewards</Text>
                                </Button>
                            </VStack>
                        )}
                    </Card.Body>
                </Card.Root>
            </Box>
        </Skeleton>
    )
}

interface RewardsStakingPendingRewardsModalProps {
    onClose: () => void;
    onClaimSuccess?: () => void;
    pendingRewardsIds?: string[];
    pendingRewards?: PrettyBalance[];
}

export const RewardsStakingPendingRewardsModal = ({
                                                      onClose,
                                                      pendingRewardsIds,
                                                      pendingRewards,
                                                      onClaimSuccess
                                                  }: RewardsStakingPendingRewardsModalProps) => {
    const [isClaiming, setIsClaiming] = useState(false)

    const {denomTicker} = useAssets()
    const {toast} = useToast()
    const {tx, progressTrack} = useBZETx()
    const {address} = useChain(getChainName())

    const canClaim = useMemo(() => {
        if (!pendingRewardsIds || !pendingRewards) return false;

        for (const reward of pendingRewards) {
            if (reward.amount.gt(0)) return true;
        }

        return false;
    }, [pendingRewardsIds, pendingRewards])

    const claimRewards = useCallback(async () => {
        if (!canClaim) {
            toast.error('No rewards to claim')
            return
        }

        const msgs: EncodeObject[] = [];
        pendingRewardsIds?.forEach(rewardId => {
            msgs.push(claimStakingRewards({
                rewardId: rewardId,
                creator: address ?? ''
            }))
        })

        setIsClaiming(true)
        const success = await tx(msgs)
        setIsClaiming(false)
        if (success) onClaimSuccess?.()
    }, [address, canClaim, onClaimSuccess, pendingRewardsIds, toast, tx])

    return (
        <Box
            position="fixed"
            inset="0"
            bg="blackAlpha.600"
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex="modal"
        >
            <Card.Root maxW="md" w="full" mx="4">
                <Card.Header>
                    <HStack justify="space-between" align="center">
                        <Heading size="lg">
                            Claim rewards
                        </Heading>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                        >
                            ✕
                        </Button>
                    </HStack>
                </Card.Header>

                <Card.Body>
                    <VStack gap="4">
                        {canClaim ? (
                            <Box
                                bgGradient="to-br"
                                gradientFrom="blue.500/15"
                                gradientTo="blue.600/15"
                                borderWidth="1px"
                                borderColor="purple.500/30"
                                borderRadius="md"
                                p="4"
                                w="full"
                            >
                                <VStack align="start" gap="2">
                                    <HStack gap="1" color="purple.600">
                                        <LuGift size={14} />
                                        <Text fontSize="sm" fontWeight="semibold" textTransform="uppercase">Available Rewards</Text>
                                    </HStack>
                                    {pendingRewards?.filter(reward => reward.amount.gt(0)).map((reward, index) => (
                                        <Text fontSize="2xl" fontWeight="bold" color="purple.600" key={index}>
                                            {prettyAmount(reward.amount)} {denomTicker(reward.denom)}
                                        </Text>
                                    ))}
                                </VStack>
                            </Box>
                        ) : (
                            <Box
                                bgGradient="to-br"
                                gradientFrom="gray.500/15"
                                gradientTo="gray.600/15"
                                borderWidth="1px"
                                borderColor="gray.500/30"
                                borderRadius="md"
                                p="4"
                                w="full"
                                textAlign="center"
                            >
                                <Text fontSize="lg" fontWeight="bold" color="fg.muted">
                                    No rewards to claim
                                </Text>
                            </Box>
                        )}
                        <RewardsStakingButton
                            buttonType={TYPE_REWARDS}
                            colorPalette="purple"
                            variant="outline"
                            width="full"
                            disabled={!canClaim}
                            loading={isClaiming}
                            loadingText={progressTrack || 'Claiming rewards...'}
                            onClick={claimRewards}
                        >
                            Claim Rewards
                        </RewardsStakingButton>
                    </VStack>
                </Card.Body>
            </Card.Root>
        </Box>
    )
}
