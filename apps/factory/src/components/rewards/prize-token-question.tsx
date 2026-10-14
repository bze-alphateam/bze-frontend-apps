"use client"

import React from 'react'
import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuCircleCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu'
import {
    Asset,
    DenomReward,
    DenomRewardPrize,
    FeeCoin,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'
import { AssetPicker } from '@/components/ui/asset-picker'
import { prizeSlot } from '@/lib/denom-reward'

interface PrizeTokenQuestionProps {
    denomReward: Pick<DenomReward, 'staking_denom'>;
    /** Every prize denom the holder reward has used — what the cap counts. */
    prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>;
    /** `max_prize_denoms_per_dr`; undefined while unknown (no cap warning then). */
    maxPrizeDenoms?: number;
    /** `createDenomRewardPrizeFee`, charged once for a prize denom new to the holder reward. */
    prizeFee?: FeeCoin;
    value: string;
    onSelect: (asset: Asset) => void;
    label?: string;
}

function Note({ tone, icon, children }: { tone: 'red' | 'muted' | 'green'; icon: React.ReactNode; children: React.ReactNode }) {
    const styles = tone === 'red'
        ? { bg: 'red.500/10', color: 'red.600' }
        : tone === 'green'
            ? { bg: 'green.500/10', color: 'fg' }
            : { bg: 'bg.muted', color: 'fg' }
    return (
        <HStack gap={2} p={3} borderRadius="lg" align="start" {...styles}>
            <Box mt="0.5" flexShrink={0}>{icon}</Box>
            <Text fontSize="sm">{children}</Text>
        </HStack>
    )
}

/**
 * The content of a "What do you give?" question of the holder rewards forms: picks the prize
 * token and says what it costs against the holder reward's prize entries and cap.
 */
export function PrizeTokenQuestion({
    denomReward,
    prizes,
    maxPrizeDenoms,
    prizeFee,
    value,
    onSelect,
    label = 'Prize token (paid from your wallet)',
}: PrizeTokenQuestionProps) {
    const { asset: stakingAsset } = useAsset(denomReward.staking_denom)
    const { asset: prizeAsset } = useAsset(value)
    const { asset: feeAsset } = useAsset(prizeFee?.denom ?? '')

    const slot = prizeSlot(prizes, value, maxPrizeDenoms)
    const stakeTicker = stakingAsset?.ticker ?? denomReward.staking_denom
    const prizeTicker = prizeAsset?.ticker ?? value

    const feeText = prizeFee && feeAsset && new BigNumber(prizeFee.amount).gt(0)
        ? ` (${prettyAmount(uAmountToBigNumberAmount(prizeFee.amount, feeAsset.decimals))} ${feeAsset.ticker})`
        : ''
    const slotText = maxPrizeDenoms !== undefined
        ? `prize slot ${slot.used + 1} of ${maxPrizeDenoms}`
        : `prize slot ${slot.used + 1}`

    return (
        <VStack align="stretch" gap={3}>
            <AssetPicker label={label} value={value} onSelect={onSelect} />

            {value && slot.capReached && (
                <Note tone="red" icon={<LuTriangleAlert size={16} />}>
                    This holder reward already uses {slot.used} prize tokens, the maximum of {maxPrizeDenoms}.
                    Pick a prize token it already pays.
                </Note>
            )}
            {value && slot.isNewPrize && !slot.capReached && (
                <Note tone="muted" icon={<LuInfo size={16} />}>
                    {prizeTicker} is new to {stakeTicker}&apos;s holder rewards, so the one-time new prize
                    fee{feeText} applies. It takes {slotText} for good. Paying {prizeTicker} here again later is free.
                </Note>
            )}
            {value && !slot.isNewPrize && (
                <Note tone="green" icon={<LuCircleCheck size={16} />}>
                    No prize fee: {stakeTicker} already pays {prizeTicker}.
                </Note>
            )}
        </VStack>
    )
}
