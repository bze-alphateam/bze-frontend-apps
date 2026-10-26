"use client"

import React from 'react'
import { VStack } from '@chakra-ui/react'
import { Asset, DenomRewardPrize } from '@bze/bze-ui-kit'
import { BlockerNote } from '@/components/guided/notes'
import { AssetPicker } from '@/components/ui/asset-picker'
import { prizeCapText, prizeSlot } from '@/lib/denom-reward'

interface PrizeTokenQuestionProps {
    /** Every prize denom the compounded reward has used — what the cap counts. */
    prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>;
    /** `max_prize_denoms_per_dr`; undefined while unknown (no cap warning then). */
    maxPrizeDenoms?: number;
    value: string;
    onSelect: (asset: Asset) => void;
    label?: string;
}

/**
 * The content of a "What do you give?" question of the compounded reward forms: picks the reward
 * token and blocks it when the compounded reward's prize cap is reached.
 */
export function PrizeTokenQuestion({
    prizes,
    maxPrizeDenoms,
    value,
    onSelect,
    label = 'Reward token',
}: PrizeTokenQuestionProps) {
    const slot = prizeSlot(prizes, value, maxPrizeDenoms)

    return (
        <VStack align="stretch" gap="12px">
            <AssetPicker label={label} value={value} onSelect={onSelect} />

            {value && slot.capReached && <BlockerNote>{prizeCapText(maxPrizeDenoms)}</BlockerNote>}
        </VStack>
    )
}
