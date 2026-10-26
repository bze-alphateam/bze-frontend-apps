'use client'

import { bze } from '@bze/bzejs'
import { DenomRewardPrize, TxSpec, useCanAffordTx, useCreationFees } from '@bze/bze-ui-kit'
import { useFeePayment } from '@/hooks/useFeePayment'
import type { PayRow } from '@/components/guided'
import { airdropBlocker, prizeSlot, summarizeAirdropCosts } from '@/lib/denom-reward'

const { distributeDenomRewards } = bze.rewards.MessageComposer.withTypeUrl

export const AIRDROP_TX_KIND: TxSpec = 'distribute-denom-rewards'

interface AirdropGiftInput {
    /** The compounded reward's staking denom (the community). */
    denom: string;
    /** Its live staked total; undefined while the compounded reward isn't loaded (no blocker then). */
    stakedAmount?: string;
    /** Every prize denom the compounded reward has used, what the cap counts. */
    prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>;
    prizeDenom: string;
    /** The gift in prize base units; undefined while the input is invalid. */
    uAmount?: string;
    /** For the nobody-stakes blocker. */
    stakedTicker?: string;
}

/**
 * A one-off airdrop on a compounded reward (`MsgDistributeDenomRewards`): the costs, the blocker, the
 * affordability check and the message. Used by the Airdrop coins wizard.
 */
export function useAirdropGift({ denom, stakedAmount, prizes, prizeDenom, uAmount, stakedTicker }: AirdropGiftInput) {
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const prizeFee = fees.createDenomRewardPrizeFee

    const slot = prizeSlot(prizes, prizeDenom, maxPrizes)
    const isNewPrize = Boolean(prizeDenom) && slot.isNewPrize
    const costs = summarizeAirdropCosts({ uAmount, prizeDenom, prizeFee, isNewPrize })
    const blocker = stakedAmount === undefined
        ? ''
        : airdropBlocker({ stakedAmount, prizeDenom, slot, feesKnown: costs.feesKnown, max: maxPrizes, stakedTicker })

    const mainFee = costs.feeTotals[0]
    const extraFees = costs.feeTotals.slice(1)
    const feePayment = useFeePayment(mainFee, AIRDROP_TX_KIND)
    const afford = useCanAffordTx({
        spec: costs.escrow ? AIRDROP_TX_KIND : undefined,
        spend: costs.escrow ? [costs.escrow, ...extraFees] : undefined,
        moduleFee: feePayment.estimate.resolvedFee,
    })

    const feesReady = costs.feesKnown && (!mainFee || feePayment.canPayFee)
    /** Everything but the wallet and the form's own answers is in place. */
    const canSign = costs.escrow !== undefined && blocker === '' && feesReady && !afford.isLoading && afford.canAfford

    const message = (creator: string) => costs.escrow
        ? distributeDenomRewards({ creator, denom, prizeDenom, amount: costs.escrow.amount })
        : undefined

    return { slot, isNewPrize, maxPrizes, prizeFee, isFeeLoading, costs, blocker, mainFee, extraFees, afford, canSign, message }
}

export type AirdropGift = ReturnType<typeof useAirdropGift>

/** The "You will pay" rows of an airdrop: the gift and the new prize fee (if any); the panel sums them. */
export function airdropPayRows(gift: AirdropGift, prizeDenom: string): PayRow[] {
    const { costs, slot, isNewPrize } = gift

    // A new prize with the cap reached gets no fee row: the blocker banner covers it.
    const feeRows: PayRow[] = prizeDenom && isNewPrize && !slot.capReached
        ? costs.fees.map(f => ({ label: 'New prize fee', coin: f.coin }))
        : []

    return [
        ...(costs.escrow ? [{ label: 'Airdrop', coin: costs.escrow }] : []),
        ...feeRows,
    ]
}
