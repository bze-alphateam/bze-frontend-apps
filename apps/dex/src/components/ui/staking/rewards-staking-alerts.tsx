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

/** A labelled figure on a staking card or dialog: your stake in the DEX tint, an unlock in amber, the rest neutral. */
export const RewardStakingAlert = ({type, text}: RewardStakingAlertProps) => {
    const alertTitle = useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return 'Rewards';
            case TYPE_STAKING: return 'Your Stake';
            case TYPE_UNLOCK: return 'Pending Unlock';
            case TYPE_BALANCE: return 'Balance';
        }
    }, [type])

    const tone = type === TYPE_STAKING
        ? {bg: 'app.subtle', borderColor: 'app.border', title: 'hg.link'}
        : type === TYPE_UNLOCK
            ? {bg: 'hg.warning/8', borderColor: 'hg.warning/30', title: 'hg.warning.text'}
            : {bg: 'hg.inset', borderColor: 'hg.hairline', title: 'hg.text.secondary'}

    return (
        <Box
            bg={tone.bg}
            borderWidth="1px"
            borderColor={tone.borderColor}
            borderRadius="12px"
            px="12px"
            py="10px"
            w='full'
            data-testid="staking-figure"
            data-type={type}
        >
            <VStack align="start" gap="2px">
                <HStack gap="6px" color={tone.title}>
                    <RewardsStakingIcon type={type} />
                    <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">{alertTitle}</Text>
                </HStack>
                <Text fontWeight="700" fontSize="16px" color="fg">{text}</Text>
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
