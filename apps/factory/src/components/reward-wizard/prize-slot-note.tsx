"use client"

import React from 'react'
import { BlockerNote } from '@/components/guided'
import { type PrizeSlot, prizeCapText } from '@/lib/denom-reward'

interface PrizeSlotNoteProps {
    slot: PrizeSlot;
    /** `max_prize_denoms_per_dr`; undefined while unknown. */
    max?: number;
}

/** Under the reward token: the cap blocker (5017) when a new reward token no longer fits, else nothing. */
export function PrizeSlotNote({ slot, max }: PrizeSlotNoteProps) {
    if (!slot.capReached) return null
    return <BlockerNote>{prizeCapText(max)}</BlockerNote>
}
