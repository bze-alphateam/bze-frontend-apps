"use client"

import React from 'react'
import BigNumber from 'bignumber.js'
import { Box, HStack, Text } from '@chakra-ui/react'
import { LuCircleCheck, LuInfo } from 'react-icons/lu'
import { prettyAmount, uAmountToBigNumberAmount, useAsset, type FeeCoin } from '@bze/bze-ui-kit'
import { BlockerNote } from '@/components/guided'
import type { PrizeSlot } from '@/lib/denom-reward'
import { newPrizeNote } from '@/lib/prize-wizard'

interface PrizeSlotNoteProps {
    stakedTicker: string;
    prizeTicker: string;
    slot: PrizeSlot;
    /** `max_prize_denoms_per_dr`; undefined while unknown. */
    max?: number;
    /** `createDenomRewardPrizeFee`. */
    prizeFee?: FeeCoin;
}

/**
 * Under the prize token: the cap blocker (5017), "BZE is a new prize token here: +25,000 TBZE,
 * uses 1 of the remaining 4 prize slots.", or that a prize the reward already pays is free.
 */
export function PrizeSlotNote({ stakedTicker, prizeTicker, slot, max, prizeFee }: PrizeSlotNoteProps) {
    const { asset: feeAsset } = useAsset(prizeFee?.denom ?? '')
    const feeText = prizeFee && feeAsset && new BigNumber(prizeFee.amount).gt(0)
        ? `${prettyAmount(uAmountToBigNumberAmount(prizeFee.amount, feeAsset.decimals))} ${feeAsset.ticker}`
        : ''

    if (slot.capReached) {
        return (
            <BlockerNote>
                {`${stakedTicker}'s compounded reward already uses ${slot.used} prize tokens, the maximum${max === undefined ? '' : ` of ${max}`}. Pick a prize token it already pays.`}
            </BlockerNote>
        )
    }
    const isNew = slot.isNewPrize
    return (
        <HStack gap="8px" align="start" color={isNew ? 'fg.muted' : 'hg.success.text'} data-testid="prize-slot-note">
            <Box mt="3px" flexShrink={0} aria-hidden>{isNew ? <LuInfo size={16} /> : <LuCircleCheck size={16} />}</Box>
            <Text fontSize="14px" lineHeight="1.5">
                {isNew ? newPrizeNote(prizeTicker, feeText, slot, max) : `No prize fee: ${stakedTicker} already pays ${prizeTicker}.`}
            </Text>
        </HStack>
    )
}
