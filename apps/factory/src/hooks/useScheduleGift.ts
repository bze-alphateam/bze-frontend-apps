'use client'

import { bze } from '@bze/bzejs'
import BigNumber from 'bignumber.js'
import { DenomRewardPrize, TxSpec, useCanAffordTx, useCreationFees } from '@bze/bze-ui-kit'
import { useFeePayment } from '@/hooks/useFeePayment'
import type { PayRow } from '@/components/guided'
import type { PayRowNames } from '@/hooks/useAirdropGift'
import { newPrizeSlotInfo, prizeSlot, summarizeScheduleCosts } from '@/lib/denom-reward'

const { createDenomRewardSchedule, updateDenomRewardSchedule } = bze.rewards.MessageComposer.withTypeUrl

// The names the guided forms give the fees summarizeScheduleCosts returns.
const FEE_LABELS: Record<string, string> = {
    'Schedule fee': 'Daily prize fee',
    'New prize token fee': 'New prize fee',
}

interface ScheduleGiftInput {
    /** The holder reward's staking denom. */
    denom: string;
    prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>;
    prizeDenom: string;
    /** Daily prize in base units; undefined while the input is invalid. */
    dailyUAmount?: BigNumber | string;
    /** Days to fund (create: the duration; extend: the extra days); undefined while invalid. */
    days?: number;
    /** The schedule to extend; absent to create a new one. */
    scheduleId?: string;
}

/**
 * A daily prize on a holder reward, new (`MsgCreateDenomRewardSchedule`) or extended
 * (`MsgUpdateDenomRewardSchedule`): the costs, the affordability check and the message. Shared by
 * the daily-prize form and "Reach another community".
 */
export function useScheduleGift({ denom, prizes, prizeDenom, dailyUAmount, days, scheduleId }: ScheduleGiftInput) {
    const isExtend = scheduleId !== undefined
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const prizeFee = fees.createDenomRewardPrizeFee

    const slot = prizeSlot(prizes, prizeDenom, maxPrizes)
    const costs = summarizeScheduleCosts({
        dailyUAmount,
        days,
        prizeDenom,
        mode: isExtend ? 'extend' : 'create',
        scheduleFee: fees.addDenomRewardScheduleFee,
        prizeFee,
        isNewPrize: Boolean(prizeDenom) && slot.isNewPrize,
    })

    // The fees normally share one denom (BZE) and are resolved against the fee token as one
    // total. A second fee denom (only if governance sets one) is charged natively.
    const txKind: TxSpec = isExtend ? 'update-denom-reward-schedule' : 'create-denom-reward-schedule'
    const mainFee = costs.feeTotals[0]
    const extraFees = costs.feeTotals.slice(1)
    const feePayment = useFeePayment(mainFee, txKind)
    const afford = useCanAffordTx({
        spec: costs.escrow ? txKind : undefined,
        spend: costs.escrow ? [costs.escrow, ...extraFees] : undefined,
        moduleFee: feePayment.estimate.resolvedFee,
    })

    const feesReady = isExtend || (costs.feesKnown && (!mainFee || feePayment.canPayFee))
    const feeUnknown = !isExtend && !isFeeLoading && !costs.feesKnown
    /** Everything but the wallet and the form's own answers is in place. */
    const canSign = costs.escrow !== undefined && !slot.capReached && feesReady && !afford.isLoading && afford.canAfford

    const message = (creator: string) => {
        if (dailyUAmount === undefined || days === undefined) return undefined
        return isExtend
            ? updateDenomRewardSchedule({ creator, denom, scheduleId, duration: String(days) })
            : createDenomRewardSchedule({
                creator,
                denom,
                prizeDenom,
                dailyAmount: new BigNumber(dailyUAmount).toFixed(0),
                duration: String(days),
            })
    }

    return { isExtend, slot, maxPrizes, prizeFee, isFeeLoading, feeUnknown, txKind, costs, mainFee, extraFees, afford, canSign, message }
}

export type ScheduleGift = ReturnType<typeof useScheduleGift>

/**
 * The "You will pay" rows of a daily prize: the locked amount, then the fees (or none when
 * extending). With `names`, the new prize fee row explains the prize slot it takes.
 */
export function schedulePayRows(gift: ScheduleGift, names?: Omit<PayRowNames, 'prizeDenom'>): PayRow[] {
    const { costs, extraFees, isExtend, slot, maxPrizes } = gift
    const slotInfo = names
        ? newPrizeSlotInfo({ ticker: names.stakingTicker, possessive: names.stakingPossessive }, names.prizeTicker, slot, maxPrizes)
        : undefined
    const feeRows: PayRow[] = costs.fees.map(f => {
        const label = FEE_LABELS[f.label] ?? f.label
        return label === 'New prize fee' && slotInfo ? { label, coin: f.coin, info: slotInfo } : { label, coin: f.coin }
    })
    // Several charged fees: show their per-denom totals too, the amounts the wallet is charged.
    const chargedCount = costs.fees.filter(f => new BigNumber(f.coin.amount).gt(0)).length
    const totalRows: PayRow[] = chargedCount > 1
        ? costs.feeTotals.map((c, i) => ({ label: i === 0 ? 'Fees total' : 'Also charged', coin: c }))
        : extraFees.map(c => ({ label: 'Also charged', coin: c }))

    return [
        ...(costs.escrow ? [{ label: 'Locked for prizes', coin: costs.escrow }] : []),
        ...(isExtend
            ? [{ label: 'Fee', text: 'None', info: 'None — extending only locks the extra days. Anyone can extend any schedule.' }]
            : [...feeRows, ...totalRows]),
    ]
}
