import {
    Button,
    chakra,
    Field,
    Flex,
    Group,
    Input,
    Skeleton,
    Stack,
} from "@chakra-ui/react";
import {LuGift, LuLock, LuLockOpen} from "react-icons/lu";
import React, {useCallback, useMemo, useState} from "react";
import {StakingRewardParticipantSDKType, StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {useAsset, useAssets, useAssetPrice, shortNumberFormat, amountToBigNumberUAmount, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, calculateRewardsStakingPendingRewards, removeLeadingZeros, useBalance, sanitizeNumberInput, useBZETx, getChainName, useToast, useMaxSpendable, useCanAffordTx, hgVariant, Notice} from "@bze/bze-ui-kit";
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
import {DexDialog} from "@/components/ui/dialog";
import {AprMove} from "@/components/ui/pools/pool-parts";
import {estimateStakeDailyRewards} from "@/lib/stake-estimate";

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
    /** The step the dialog opens on: the overview (Manage) or straight on the stake form (Stake / Add). */
    initialView?: 'actions' | 'stake';
}

export const RewardsStakingActionModal = ({
                                              onClose,
                                              stakingReward,
                                              userStake,
                                              userUnlocking,
                                              onActionPerformed,
                                              initialView = MODAL_TYPE_ACTIONS,
                                          }: RewardsStakingActionModalProps) => {
    const [modalType, setModalType] = useState<string>(initialView);
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
    // Shared gas engine: Max keeps the gas back when the staked coin is the fee coin; every
    // action (stake / unstake / claim) needs the fee in the wallet.
    const maxSpendable = useMaxSpendable(stakingReward?.staking_denom ?? '', 'join-staking')
    const stakeAffordability = useCanAffordTx({
        spec: stakingReward && stakeAmount ? 'join-staking' : undefined,
        spend: stakingReward && stakeAmount && stakingAsset
            ? {denom: stakingReward.staking_denom, amount: amountToBigNumberUAmount(stakeAmount, stakingAsset.decimals)}
            : undefined,
    })
    const unstakeFeeCheck = useCanAffordTx({spec: address && userStake ? 'exit-staking' : undefined})
    const claimFeeCheck = useCanAffordTx({spec: address ? 'claim-staking-reward' : undefined})

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
    // Daily reward of the user's whole position after the stake (the coins already staked here plus the input).
    //the input the user provides is an AMOUNT, not a UAmount, so we need to convert it to a UAmount
    const stakeEstimate = useMemo(() => {
        if (!stakingReward || !stakeAmount || !stakingAsset) return null;

        const stakedUAmount = amountToBigNumberUAmount(stakeAmount, stakingAsset.decimals)
        return estimateStakeDailyRewards(stakingReward.prize_amount, stakingReward.staked_amount, userStake?.amount ?? 0, stakedUAmount)
    }, [stakingReward, stakeAmount, stakingAsset, userStake])

    const inputEstimatedRewards = useMemo(() => {
        if (!stakeEstimate) return '0';

        return `${shortNumberFormat(uAmountToBigNumberAmount(stakeEstimate.daily.integerValue(), prizeAsset?.decimals || 0))} ${prizeAsset?.ticker}`
    }, [stakeEstimate, prizeAsset])

    // Shown only when the user already has coins staked here.
    const inputEstimatedGain = useMemo(() => {
        if (!stakeEstimate || !userStake) return undefined;

        return `+${shortNumberFormat(uAmountToBigNumberAmount(stakeEstimate.gain.integerValue(), prizeAsset?.decimals || 0))} ${prizeAsset?.ticker} more than you earn now`
    }, [stakeEstimate, userStake, prizeAsset])

    const { price: rewardTokenPrice } = useAssetPrice(stakingReward?.prize_denom || '');
    const { price: stakingTokenPrice } = useAssetPrice(stakingReward?.staking_denom || '');

    const estimatedDailyRewardsUsd = useMemo(() => {
        if (!stakeEstimate || !prizeAsset || !rewardTokenPrice || rewardTokenPrice.lte(0)) return null;

        const dailyRewardAmount = uAmountToBigNumberAmount(stakeEstimate.daily.integerValue(), prizeAsset.decimals)

        return dailyRewardAmount.multipliedBy(rewardTokenPrice);
    }, [stakeEstimate, prizeAsset, rewardTokenPrice]);

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

        if (!stakeAffordability.canAfford) {
            setFormError(stakeAffordability.message)
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
    }, [stakingReward, stakingAsset, stakeAmount, hasUserStake, userStakingAssetBalance, minStakeAmount, stakeAffordability.canAfford, stakeAffordability.message])
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

        if (!stakeAffordability.canAfford) {
            setFormError(stakeAffordability.message)
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
    }, [stakingReward, stakeAmount, address, stakingAsset, userStake, stakingAssetBalance, tx, onActionPerformed, minStakeAmount, stakeAffordability.canAfford, stakeAffordability.message])
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

        if (!unstakeFeeCheck.canAfford) {
            toast.error('Not enough for the network fee', unstakeFeeCheck.message)
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
    }, [stakingReward, userStake, address, tx, onActionPerformed, toast, unstakeFeeCheck.canAfford, unstakeFeeCheck.message])
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

        if (!claimFeeCheck.canAfford) {
            toast.error('Not enough for the network fee', claimFeeCheck.message)
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
    }, [stakingReward, address, tx, onActionPerformed, hasPendingRewards, toast, claimFeeCheck.canAfford, claimFeeCheck.message])

    const title = `${
        modalType === MODAL_TYPE_UNSTAKE ? unstakeModalTitle
            : modalType === MODAL_TYPE_CLAIM ? claimModalTitle
                : actionsModalTitle
    } #${rewardNumber}`

    return (
        <DexDialog title={title} onClose={onCloseClick}>
            <Skeleton loading={stakingAssetIsLoading || prizeAssetIsLoading || isLoadingAssets}>
                {modalType === MODAL_TYPE_ACTIONS && stakingReward && (
                    <Flex direction="column" gap="10px">
                        <chakra.p m="0" fontSize="14px" color="fg.muted">Stake your tokens and receive daily rewards.</chakra.p>
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

                        <Stack direction={{base: 'column', sm: 'row'}} width="full" gap="8px" mt="4px">
                            <RewardsStakingButton buttonType={TYPE_STAKING} onClick={() => openModal('stake')}>
                                Stake
                            </RewardsStakingButton>
                            <RewardsStakingButton buttonType={TYPE_UNLOCK} disabled={!hasUserStake} onClick={() => openModal('unstake')}>
                                Unstake
                            </RewardsStakingButton>
                            <RewardsStakingButton buttonType={TYPE_REWARDS} disabled={!hasPendingRewards} onClick={() => openModal('claim')}>
                                Claim
                            </RewardsStakingButton>
                        </Stack>
                    </Flex>
                )}

                {modalType === MODAL_TYPE_STAKE && stakingReward && (
                    <Flex direction="column" gap="10px">
                        <Field.Root invalid={formError !== ''}>
                            <Field.Label fontSize="14px" fontWeight="400" color="fg.muted">Enter the amount you want to stake:</Field.Label>
                            <Group attached w="full">
                                <Input
                                    autoComplete="off"
                                    inputMode="decimal"
                                    placeholder={prettyMinStake}
                                    value={stakeAmount}
                                    onChange={(e) => {
                                        setFormError('')
                                        setStakeAmount(sanitizeNumberInput(e.target.value))
                                    }}
                                    onBlur={validateStakeAmount}
                                    type="text"
                                    h="44px"
                                    bg="hg.inset"
                                    disabled={isSubmitting}
                                />
                                <Button variant="outline"
                                        h="44px"
                                        px="14px"
                                        bg="hg.card"
                                        borderColor="hg.lineStrong"
                                        color="hg.text.secondary"
                                        onClick={() => {
                                            setFormError('')
                                            setStakeAmount(maxSpendable.inputValue)
                                        }}
                                        disabled={stakingAssetBalance.amount.isZero() || isSubmitting}
                                >
                                    Max
                                </Button>
                            </Group>
                            <Field.ErrorText>{formError}</Field.ErrorText>
                        </Field.Root>
                        {stakeAmount && (
                            <>
                                <Flex direction="column" gap="3px" px="14px" py="12px" borderRadius="12px" bg="hg.success/8" borderWidth="1px" borderColor="hg.success/30">
                                    <chakra.span fontSize="13px" color="fg.muted">Estimated Daily Rewards:</chakra.span>
                                    <chakra.strong fontSize="18px" color="hg.success.text">{inputEstimatedRewards}</chakra.strong>
                                    <chakra.span fontSize="12px" color="hg.text.faint">
                                        {estimatedDailyRewardsUsd && estimatedDailyRewardsUsd.gt(0) ? `≈ $${shortNumberFormat(estimatedDailyRewardsUsd)} · ` : ''}
                                        Unlock period: {stakingReward?.lock || 0} days
                                    </chakra.span>
                                    {inputEstimatedGain && (
                                        <chakra.span fontSize="12px" color="hg.text.faint">{inputEstimatedGain}</chakra.span>
                                    )}
                                </Flex>

                                {/* Show new APR if it changes by more than 10% */}
                                {stakingAPRData && stakingAPRData.newAPR && stakingAPRData.aprChange && Math.abs(stakingAPRData.aprChange.toNumber()) > 10 && (
                                    <AprMove current={stakingAPRData.currentAPR} next={stakingAPRData.newAPR} change={stakingAPRData.aprChange}/>
                                )}
                            </>
                        )}

                        <Button
                            size="lg"
                            w="full"
                            variant={hgVariant('primary')}
                            gap="8px"
                            disabled={!stakeAmount || stakingAssetBalance.amount.isZero()}
                            loading={isSubmitting}
                            loadingText={progressTrack}
                            onClick={handleConfirmStake}
                        >
                            <LuLock size={16} aria-hidden="true"/>
                            Confirm Stake
                        </Button>
                    </Flex>
                )}

                {modalType === MODAL_TYPE_UNSTAKE && userStake && (
                    <Flex direction="column" gap="10px">
                        <Notice status="warning" title="Unstaking Notice" icon={<LuLockOpen/>}>
                            Your funds will be locked for {stakingReward?.lock || 0} days. You will
                            receive them after the lock period ends.
                        </Notice>
                        <DialogFigure label="Amount to Unstake"><chakra.strong fontSize="18px">{yourStake}</chakra.strong></DialogFigure>
                        <Button
                            size="lg"
                            w="full"
                            variant={hgVariant('primary')}
                            disabled={!userStake}
                            loading={isSubmitting}
                            loadingText={progressTrack || 'Unstaking...'}
                            onClick={handleUnstake}
                        >
                            Confirm Unstake
                        </Button>
                    </Flex>
                )}

                {modalType === MODAL_TYPE_CLAIM && userStake && (
                    <Flex direction="column" gap="10px">
                        <DialogFigure label="Rewards"><chakra.strong fontSize="18px">{pendingRewards}</chakra.strong></DialogFigure>
                        <Button
                            size="lg"
                            w="full"
                            variant={hgVariant('primary')}
                            gap="8px"
                            disabled={!userStake || !hasPendingRewards}
                            loading={isSubmitting}
                            loadingText={progressTrack || 'Claiming rewards...'}
                            onClick={handleRewardsClaim}
                        >
                            <LuGift size={16} aria-hidden="true"/>
                            Claim Rewards
                        </Button>
                    </Flex>
                )}
            </Skeleton>
        </DexDialog>
    )
}

/** A neutral labelled figure in a dialog. */
const DialogFigure = ({label, children}: { label: string; children: React.ReactNode }) => (
    <Flex direction="column" gap="4px" px="14px" py="12px" borderRadius="12px" bg="hg.inset">
        <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.secondary">{label}</chakra.span>
        {children}
    </Flex>
)

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
    // One MsgClaimStakingRewards per reward id; the wallet must hold the gas for all of them.
    const feeCheck = useCanAffordTx({
        spec: address && pendingRewardsIds && pendingRewardsIds.length > 0
            ? {kind: 'claim-staking-reward', count: pendingRewardsIds.length}
            : undefined,
    })

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
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message)
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
    }, [address, canClaim, onClaimSuccess, pendingRewardsIds, toast, tx, feeCheck.canAfford, feeCheck.message])

    return (
        <DexDialog title="Claim rewards" onClose={onClose}>
            <Flex direction="column" gap="10px">
                {canClaim ? (
                    <DialogFigure label="Available Rewards">
                        {pendingRewards?.filter(reward => reward.amount.gt(0)).map((reward, index) => (
                            <chakra.strong fontSize="22px" key={index}>
                                {prettyAmount(reward.amount)} {denomTicker(reward.denom)}
                            </chakra.strong>
                        ))}
                    </DialogFigure>
                ) : (
                    <Flex justify="center" px="14px" py="16px" borderRadius="12px" bg="hg.inset">
                        <chakra.strong fontSize="16px" color="fg.muted">No rewards to claim</chakra.strong>
                    </Flex>
                )}
                <Button
                    size="lg"
                    w="full"
                    variant={hgVariant('primary')}
                    gap="8px"
                    disabled={!canClaim}
                    loading={isClaiming}
                    loadingText={progressTrack || 'Claiming rewards...'}
                    onClick={claimRewards}
                >
                    <LuGift size={16} aria-hidden="true"/>
                    Claim Rewards
                </Button>
            </Flex>
        </DexDialog>
    )
}
