import {Button, chakra, Flex, SimpleGrid} from "@chakra-ui/react";
import {LuGift, LuLockOpen} from "react-icons/lu";
import {useMemo, useState} from "react";
import {
    useAssets, prettyAmount, uAmountToAmount, useToast, getChainName,
    useSDKTx, useCanAffordTx, NativeStakingData, AppLink, getStakingApp, hgVariant,
} from "@bze/bze-ui-kit";
import {cosmos} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import {
    RewardStakingAlert,
    TYPE_REWARDS,
    TYPE_STAKING,
} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";
import {DexDialog} from "@/components/ui/dialog";
import {NATIVE_MIN_CLAIM_AMOUNT as MIN_CLAIM_AMOUNT} from "@/lib/staking-list";

interface NativeStakingDialogProps {
    stakingData: NativeStakingData|undefined;
    /** Opens straight on the claim step (the Claim picker's single-reward path). */
    initialView?: 'actions' | 'claim';
    onClose: () => void;
    onClaimSuccess?: () => void;
}

/** BZE native staking's dialog: the stake and rewards, the Staking app link, and Claim. */
export const NativeStakingDialog = ({ stakingData, initialView = 'actions', onClose, onClaimSuccess }: NativeStakingDialogProps) => {
    const [modalType, setModalType] = useState<'actions' | 'claim'>(initialView);
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


    const openModal = (type: 'actions' | 'claim') => {
        setModalType(type);
    };

    const closeModal = onClose;

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

    return (
        <DexDialog
            title={modalType === 'claim' ? 'Claim Rewards' : 'BZE Native Staking'}
            onClose={closeModal}
        >
            {modalType === 'actions' && (
                <Flex direction="column" gap="14px">
                    <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="fg.muted">
                        Secure the BeeZee network and earn rewards by staking your BZE coins.
                    </chakra.p>
                    {hasUserStake ? (
                        <SimpleGrid columns={{base: 1, sm: 2}} gap="10px">
                            <RewardStakingAlert type={TYPE_STAKING} text={yourStake}/>
                            <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards}/>
                        </SimpleGrid>
                    ) : (
                        <chakra.p m="0" px="14px" py="12px" borderRadius="12px" bg="hg.inset" fontSize="13px" color="hg.text.secondary">
                            You are not staking BZE yet. Pick a validator in the Staking app.
                        </chakra.p>
                    )}
                    {hasUnbonding && (
                        <Flex direction="column" gap="2px" bg="hg.warning/8" borderWidth="1px" borderColor="hg.warning/30" borderRadius="12px" px="12px" py="10px">
                            <Flex align="center" gap="6px" color="hg.warning.text">
                                <LuLockOpen size={14} aria-hidden="true"/>
                                <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">Pending Unlock</chakra.span>
                            </Flex>
                            <chakra.strong fontSize="16px">{pendingUnlock}</chakra.strong>
                            <chakra.span fontSize="11px" color="hg.text.faint">{pendingUnlockAlert}</chakra.span>
                        </Flex>
                    )}
                    {/* The Staking link on the left, Claim on the right, as in the other reward dialogs' footers. */}
                    <Flex
                        data-testid="native-staking-actions"
                        justify="space-between"
                        align="center"
                        wrap="wrap"
                        gap="12px"
                        pt="14px"
                        borderTopWidth="1px"
                        borderColor="hg.divider"
                    >
                        <Flex align="center" gap="2px" fontSize="13px" color="fg.muted">
                            Stake and unstake in
                            <AppLink app="staking" href={getStakingApp().href}>Staking</AppLink>
                        </Flex>
                        {hasUserStake && (
                            <RewardsStakingButton
                                buttonType={TYPE_REWARDS}
                                flex="none"
                                w="auto"
                                px="18px"
                                disabled={!hasRewards}
                                onClick={() => openModal('claim')}
                            >
                                Claim
                            </RewardsStakingButton>
                        )}
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
    );
};
