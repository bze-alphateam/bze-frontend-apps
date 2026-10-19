import {Button, chakra, Flex, SimpleGrid, Skeleton} from "@chakra-ui/react";
import {LuGift, LuInfinity, LuLockOpen} from "react-icons/lu";
import {useMemo, useState} from "react";
import {
    useAssets, prettyAmount, uAmountToAmount, uAmountToBigNumberAmount, shortNumberFormat, useToast, getChainName,
    useSDKTx, useCanAffordTx, NativeStakingData, TokenLogo, AppLink, getStakingApp, AppIcon, appAccentColor, hgVariant,
} from "@bze/bze-ui-kit";
import {cosmos} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import {
    RewardStakingAlert,
    TYPE_REWARDS,
    TYPE_STAKING,
} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";
import {MiniStat, MiniStats, StakeToEarn, StakingCard, StakingCardHeader, VerifiedPill} from "@/components/ui/staking/staking-card-parts";
import {DexDialog} from "@/components/ui/dialog";

interface NativeStakingCardProps {
    stakingData: NativeStakingData|undefined;
    isLoading: boolean;
    onClaimSuccess?: () => void;
}

const MIN_CLAIM_AMOUNT = 100_000;

export const NativeStakingCard = ({ stakingData, isLoading, onClaimSuccess }: NativeStakingCardProps) => {
    const [modalType, setModalType] = useState('');
    const [pendingClaim, setPendingClaim] = useState(false);

    const hasUserStake = !!stakingData?.currentStaking?.staked.amount.gt(0);
    const hasUnbonding = !!stakingData?.currentStaking?.unbonding.total.amount.gt(0);
    const hasRewards = !!stakingData?.currentStaking?.pendingRewards.total.amount.gt(MIN_CLAIM_AMOUNT);

    const {nativeAsset} = useAssets()
    const {toast} = useToast()
    const {address} = useChain(getChainName())
    const {tx} = useSDKTx(getChainName())
    // One MsgWithdrawDelegatorReward per validator; the wallet must hold the gas for all of them.
    const claimValidators = stakingData?.currentStaking?.pendingRewards.validators?.length ?? 0
    const feeCheck = useCanAffordTx({
        spec: hasRewards && claimValidators > 0 ? {kind: 'withdraw-delegator-reward', count: claimValidators} : undefined,
    })

    const yourStake = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(stakingData?.currentStaking?.staked.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.currentStaking?.staked.amount, nativeAsset])

    const pendingRewards = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(stakingData?.currentStaking?.pendingRewards.total.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.currentStaking?.pendingRewards.total.amount, nativeAsset])

    const pendingUnlock = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(stakingData?.currentStaking?.unbonding.total.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.currentStaking?.unbonding.total.amount, nativeAsset])

    const pendingUnlockAlert = useMemo(() => {
        const firstUnlockAmount = prettyAmount(uAmountToAmount(stakingData?.currentStaking?.unbonding.firstUnlock.amount?.amount, nativeAsset?.decimals || 0))

        return `${firstUnlockAmount} ${nativeAsset?.ticker} will be unlocked on ${stakingData?.currentStaking?.unbonding.firstUnlock.unlockTime?.toLocaleDateString()} at ${stakingData?.currentStaking?.unbonding.firstUnlock.unlockTime?.toLocaleTimeString()}`
    }, [stakingData?.currentStaking, nativeAsset])

    const dailyDistribution = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingData?.averageDailyDistribution.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.averageDailyDistribution.amount, nativeAsset])

    const totalStaked = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingData?.totalStaked.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.totalStaked.amount, nativeAsset])

    const openModal = (type: string) => {
        setModalType(type);
    };

    const closeModal = () => {
        setModalType('');
    };

    const onClaimRewards = async () => {
        if (!hasRewards || !stakingData?.currentStaking?.pendingRewards.validators || !address) {
            toast.error('Error', `Rewards amount is too low to claim. Minimum amount is ${uAmountToAmount(MIN_CLAIM_AMOUNT, nativeAsset?.decimals || 6)} ${nativeAsset?.ticker}.`)
            return
        }

        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message)
            return
        }

        setPendingClaim(true)
        const { withdrawDelegatorReward } = cosmos.distribution.v1beta1.MessageComposer.fromPartial;
        const msgs = stakingData.currentStaking.pendingRewards.validators.map(validator => {
            return withdrawDelegatorReward({
                delegatorAddress: address,
                validatorAddress: validator,
            })
        })

        const success = await tx(msgs);

        setPendingClaim(false)
        if (success) {
            closeModal()
            if (onClaimSuccess) {
                onClaimSuccess()
            }
        }
    }

    const bzeLogo = <TokenLogo src={'/images/bze_alternative_512x512.png'} symbol={nativeAsset?.ticker ?? ''} size="8"/>

    return (
        <>
            <Skeleton asChild loading={isLoading}>
                <StakingCard
                    state={hasUserStake ? 'staked' : hasUnbonding ? 'unlocking' : 'default'}
                    label="BZE Native Staking"
                    onClick={() => openModal('actions')}
                >
                    <StakingCardHeader
                        tile={bzeLogo}
                        title="BZE Native Staking"
                        tags={(
                            <>
                                <chakra.span display="inline-flex" alignItems="center" gap="5px" fontSize="12px" fontWeight="600" color={appAccentColor('staking')}>
                                    <AppIcon app="staking" size={14}/>
                                    From the Staking app
                                </chakra.span>
                                <VerifiedPill/>
                            </>
                        )}
                        apr={`≈${stakingData?.averageApr}%`}
                    />

                    {/* Perpetual indicator as separator */}
                    <Flex justify="center" align="center" gap="6px" fontSize="12px" color="hg.text.faint">
                        <LuInfinity size={14} aria-hidden="true"/>
                        Rolling rewards for years ahead
                    </Flex>

                    <StakeToEarn
                        stakeTile={bzeLogo}
                        stakeTicker={nativeAsset?.ticker}
                        earnTile={bzeLogo}
                        earnTicker={nativeAsset?.ticker}
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
                            {hasUserStake && <RewardStakingAlert type={TYPE_STAKING} text={yourStake}/>}
                            {hasUserStake && <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards}/>}
                            {hasUnbonding && (
                                <Flex direction="column" gap="2px" bg="hg.warning/8" borderWidth="1px" borderColor="hg.warning/30" borderRadius="12px" px="12px" py="10px">
                                    <Flex align="center" gap="6px" color="hg.warning.text">
                                        <LuLockOpen size={14} aria-hidden="true"/>
                                        <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">Pending Unlock</chakra.span>
                                    </Flex>
                                    <chakra.strong fontSize="16px">{pendingUnlock}</chakra.strong>
                                    <chakra.span fontSize="11px" color="hg.text.faint" lineClamp={1}>{pendingUnlockAlert}</chakra.span>
                                </Flex>
                            )}
                        </SimpleGrid>
                    )}

                    <MiniStats>
                        <MiniStat label="Unlock">{stakingData?.unlockDuration} days</MiniStat>
                        <MiniStat label="Daily">≈{dailyDistribution}</MiniStat>
                        <MiniStat label="Minimum">None</MiniStat>
                        <MiniStat label="Total">{totalStaked}</MiniStat>
                    </MiniStats>
                </StakingCard>
            </Skeleton>
            {modalType && (
                <DexDialog
                    title={modalType === 'claim' ? 'Claim Rewards' : 'BZE Native Staking'}
                    onClose={closeModal}
                >
                    {modalType === 'actions' && (
                        <Flex direction="column" gap="14px">
                            <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="fg.muted">
                                Secure the BeeZee network and earn rewards by staking your BZE coins.
                            </chakra.p>
                            <RewardsStakingButton
                                buttonType={TYPE_REWARDS}
                                size="lg"
                                disabled={!hasRewards}
                                onClick={() => openModal('claim')}
                            >
                                Claim
                            </RewardsStakingButton>
                            <Flex justify="center">
                                <AppLink app="staking" href={getStakingApp().href}>Staking</AppLink>
                            </Flex>
                        </Flex>
                    )}

                    {modalType === 'claim' && hasRewards && (
                        <Flex direction="column" gap="14px">
                            <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards} />
                            {feeCheck.message && (
                                <chakra.span fontSize="12px" color="fg.error">{feeCheck.message}</chakra.span>
                            )}
                            <Button
                                size="xl"
                                w="full"
                                variant={hgVariant('primary')}
                                gap="8px"
                                onClick={onClaimRewards}
                                disabled={pendingClaim || !feeCheck.canAfford}
                                loading={pendingClaim}
                            >
                                <LuGift size={16} aria-hidden="true"/>
                                Claim Rewards
                            </Button>
                        </Flex>
                    )}
                </DexDialog>
            )}
        </>
    );
};
