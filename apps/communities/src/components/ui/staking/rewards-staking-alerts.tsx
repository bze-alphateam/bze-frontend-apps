import {Box, HStack, Text, VStack} from "@chakra-ui/react";
import React, {useMemo} from "react";
import {prettyAmount, uAmountToAmount, useEpochs} from "@bze/bze-ui-kit";
import {ExtendedPendingUnlockParticipantSDKType} from "@bze/bze-ui-kit";
import {RewardsStakingIcon} from "@/components/ui/staking/rewards-staking-buttons";

export const TYPE_REWARDS = 'rewards'
export const TYPE_STAKING = 'staking'
export const TYPE_UNLOCK = 'unlock'
export const TYPE_BALANCE = 'balance'

interface RewardStakingAlertProps {
    type: 'rewards' | 'staking' | 'unlock' | 'balance';
    text: string;
}

export const RewardStakingAlert = ({type, text}: RewardStakingAlertProps) => {
    const alertColor = useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return 'purple.500';
            case TYPE_STAKING: return 'blue.500';
            case TYPE_UNLOCK: return 'orange.500';
            case TYPE_BALANCE: return 'blue.500';
        }
    }, [type])

    const alertTitle = useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return 'Rewards';
            case TYPE_STAKING: return 'Your Stake';
            case TYPE_UNLOCK: return 'Pending Unlock';
            case TYPE_BALANCE: return 'Balance';
        }
    }, [type])

    const boxGradientFrom = useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return 'purple.500/15';
            case TYPE_STAKING: return 'blue.500/15';
            case TYPE_UNLOCK: return 'orange.500/15';
            case TYPE_BALANCE: return 'blue.500/15';
        }
    }, [type])

    const boxGradientTo = useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return 'purple.600/15';
            case TYPE_STAKING: return 'blue.600/15';
            case TYPE_UNLOCK: return 'orange.600/15';
            case TYPE_BALANCE: return 'blue.600/15';
        }
    }, [type])

    const boxBorderColor = useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return 'purple.500/30';
            case TYPE_STAKING: return 'blue.500/30';
            case TYPE_UNLOCK: return 'orange.500/30';
            case TYPE_BALANCE: return 'blue.500/30';
        }
    }, [type])

    return (
        <Box
            bgGradient="to-br"
            gradientFrom={boxGradientFrom}
            gradientTo={boxGradientTo}
            borderWidth="1px"
            borderColor={boxBorderColor}
            borderRadius="md"
            p="3"
            w='full'
        >
            <VStack align="start" gap="0.5">
                <HStack gap="1" color={alertColor}>
                    <RewardsStakingIcon type={type} />
                    <Text fontSize="sm" fontWeight="semibold" textTransform="uppercase">{alertTitle}</Text>
                </HStack>
                <Text fontWeight="bold" fontSize="lg">{text}</Text>
            </VStack>
        </Box>
    )
}

export const RewardsStakingUnlockAlerts = ({userUnlocking, ticker, decimals}: {userUnlocking?: ExtendedPendingUnlockParticipantSDKType[], ticker: string, decimals: number}) => {
    const {getHourEpochInfo} = useEpochs()

    const pendingUnlock = useMemo(() => {
        if (!userUnlocking) return [];

        const currentHour = getHourEpochInfo()
        if (!currentHour) return []

        const result = [];
        for (const unlock of userUnlocking) {
            const remainingHours = unlock.unlockEpoch.minus(currentHour.current_epoch)
            const days = Math.floor(remainingHours.dividedBy(24).toNumber())
            const unlockAmount = prettyAmount(uAmountToAmount(unlock?.amount, decimals))
            const item = {
                amount: unlockAmount,
                title: `${unlockAmount} ${ticker} unlocking in 1 hour`
            };
            if (days >= 2) {
                item.title = `${unlockAmount} ${ticker} unlocking in ${days} days`;
            } else if (remainingHours.gt(1)) {
                item.title = `${unlockAmount} ${ticker} unlocking in ${remainingHours.toNumber()} hours`;
            }

            result.push(item)
        }

        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userUnlocking, decimals, ticker])

    return (
        <>
            {pendingUnlock.length > 0 && pendingUnlock.map((item, index) => (
                <RewardStakingAlert type={TYPE_UNLOCK} text={item.title} key={index} />
            ))}
        </>
    )
}
