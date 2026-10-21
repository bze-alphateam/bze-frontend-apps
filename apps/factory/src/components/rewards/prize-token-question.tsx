"use client"

import React from 'react'
import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuCircleCheck, LuInfo } from 'react-icons/lu'
import {
    Asset,
    DenomReward,
    DenomRewardPrize,
    FeeCoin,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'
import { BlockerNote } from '@/components/guided/notes'
import { AssetPicker } from '@/components/ui/asset-picker'
import { prizeSlot } from '@/lib/denom-reward'

interface PrizeTokenQuestionProps {
    denomReward: Pick<DenomReward, 'staking_denom'>;
    /** Every prize denom the compounded reward has used — what the cap counts. */
    prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>;
    /** `max_prize_denoms_per_dr`; undefined while unknown (no cap warning then). */
    maxPrizeDenoms?: number;
    /** `createDenomRewardPrizeFee`, charged once for a prize denom new to the compounded reward. */
    prizeFee?: FeeCoin;
    value: string;
    onSelect: (asset: Asset) => void;
    label?: string;
}

/** A quiet line under the picker: what this prize costs (muted) or that it is free (green). */
function Line({ tone, icon, children }: { tone: 'muted' | 'good'; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <HStack gap="8px" align="start" color={tone === 'good' ? 'hg.success.text' : 'fg.muted'}>
            <Box mt="3px" flexShrink={0} aria-hidden>{icon}</Box>
            <Text fontSize="14px" lineHeight="1.5">{children}</Text>
        </HStack>
    )
}

/**
 * The content of a "What do you give?" question of the compounded reward forms: picks the prize
 * token and says what it costs against the compounded reward's prize entries and cap.
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
    // Raw denoms are long unbreakable words: plain words stand in until the asset list loads.
    const stakeTicker = stakingAsset?.ticker ?? 'the token'
    const prizeTicker = prizeAsset?.ticker ?? 'this prize token'

    const feeText = prizeFee && feeAsset && new BigNumber(prizeFee.amount).gt(0)
        ? ` (${prettyAmount(uAmountToBigNumberAmount(prizeFee.amount, feeAsset.decimals))} ${feeAsset.ticker})`
        : ''
    const slotText = maxPrizeDenoms !== undefined
        ? `prize slot ${slot.used + 1} of ${maxPrizeDenoms}`
        : `prize slot ${slot.used + 1}`

    return (
        <VStack align="stretch" gap="12px">
            <AssetPicker label={label} value={value} onSelect={onSelect} />

            {value && slot.capReached && (
                <BlockerNote>
                    This compounded reward already uses {slot.used} prize tokens, the maximum of {maxPrizeDenoms}.
                    Pick a prize token it already pays.
                </BlockerNote>
            )}
            {value && slot.isNewPrize && !slot.capReached && (
                <Line tone="muted" icon={<LuInfo size={16} />}>
                    {prizeTicker} is new to {stakeTicker}&apos;s compounded reward, so the one-time new prize
                    fee{feeText} applies. It takes {slotText} for good. Paying {prizeTicker} here again later is free.
                </Line>
            )}
            {value && !slot.isNewPrize && (
                <Line tone="good" icon={<LuCircleCheck size={16} />}>
                    No prize fee: {stakeTicker} already pays {prizeTicker}.
                </Line>
            )}
        </VStack>
    )
}
