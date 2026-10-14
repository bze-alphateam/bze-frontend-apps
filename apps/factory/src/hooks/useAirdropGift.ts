'use client'

import { bze } from '@bze/bzejs'
import { DenomRewardPrize, TxSpec, useCanAffordTx, useCreationFees } from '@bze/bze-ui-kit'
import { useFeePayment } from '@/hooks/useFeePayment'
import type { PayRow } from '@/components/guided'
import { airdropBlocker, newPrizeSlotInfo, prizeSlot, summarizeAirdropCosts } from '@/lib/denom-reward'

const { distributeDenomRewards } = bze.rewards.MessageComposer.withTypeUrl

export const AIRDROP_TX_KIND: TxSpec = 'distribute-denom-rewards'

interface AirdropGiftInput {
    /** The holder reward's staking denom (the community). */
    denom: string;
    /** Its live staked total; undefined while the holder reward isn't loaded (no blocker then). */
    stakedAmount?: string;
    /** Every prize denom the holder reward has used, what the cap counts. */
    prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>;
    prizeDenom: string;
    /** The gift in prize base units; undefined while the input is invalid. */
    uAmount?: string;
}

/**
 * A one-off airdrop on a holder reward (`MsgDistributeDenomRewards`): the costs, the blocker, the
 * affordability check and the message. Shared by the airdrop form and "Reach another community".
 */
export function useAirdropGift({ denom, stakedAmount, prizes, prizeDenom, uAmount }: AirdropGiftInput) {
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const prizeFee = fees.createDenomRewardPrizeFee

    const slot = prizeSlot(prizes, prizeDenom, maxPrizes)
    const isNewPrize = Boolean(prizeDenom) && slot.isNewPrize
    const costs = summarizeAirdropCosts({ uAmount, prizeDenom, prizeFee, isNewPrize })
    const blocker = stakedAmount === undefined
        ? ''
        : airdropBlocker({ stakedAmount, prizeDenom, slot, feesKnown: costs.feesKnown })

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

export interface PayRowNames {
    prizeDenom: string;
    stakingTicker: string;
    stakingPossessive: string;
    prizeTicker: string;
}

/** The "You will pay" rows of an airdrop: the gift, the prize fee (or none) and "Also charged". */
export function airdropPayRows(gift: AirdropGift, { prizeDenom, stakingTicker, stakingPossessive, prizeTicker }: PayRowNames): PayRow[] {
    const { costs, slot, isNewPrize, maxPrizes, extraFees } = gift
    const slotInfo = newPrizeSlotInfo({ ticker: stakingTicker, possessive: stakingPossessive }, prizeTicker, slot, maxPrizes)

    // A new prize with the cap reached gets no fee row: the blocker banner covers it.
    const feeRows: PayRow[] = !prizeDenom || (isNewPrize && slot.capReached)
        ? []
        : isNewPrize
            ? costs.fees.map(f => ({ label: 'New prize fee', coin: f.coin, info: slotInfo }))
            : [{ label: 'Prize fee', text: 'None', info: `${stakingTicker} already pays ${prizeTicker}, so only the network fee applies.` }]

    return [
        ...(costs.escrow ? [{ label: 'The gift', coin: costs.escrow }] : []),
        ...feeRows,
        ...extraFees.map(c => ({ label: 'Also charged', coin: c })),
    ]
}
