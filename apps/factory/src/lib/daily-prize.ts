import BigNumber from 'bignumber.js'
import { bze } from '@bze/bzejs'
import { amountToUAmount, type FeeCoin, type TxSpec } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    type PrizeSlot,
    type ScheduleCostSummary,
    prizeBlocker,
    validateScheduleDays,
} from '@/lib/denom-reward'

// A new daily prize on a compounded reward (denom reward schedule), as the wizards check it: the
// inputs, the prize slot and the balance, then the costs and the messages of "make it stakable" with
// an optional first prize (BFE-265). The daily prize wizard (BFE-268) uses the same checks.

const { createDenomReward, createDenomRewardSchedule } = bze.rewards.MessageComposer.withTypeUrl

export interface DailyPrizeCheckInput {
    prizeDenom: string;
    /** The prize token's decimals; undefined until a prize token is picked (and known). */
    prizeDecimals?: number;
    dailyInput: string;
    daysInput: string;
    slot: PrizeSlot;
    /** False when a fee that applies could not be read from the chain. */
    feesKnown: boolean;
    /** The wallet's prize balance in base units; undefined without a wallet (the check is skipped). */
    prizeBalance?: BigNumber;
}

export interface DailyPrizeCheck {
    dailyError: string;
    daysError: string;
    /** The daily prize in base units, once the amount is valid. */
    dailyUAmount?: BigNumber;
    /** The days, once valid. */
    days?: number;
    /** daily × days, base units, once both are valid. */
    escrow?: BigNumber;
    /** Why the chain would refuse this prize token ('' when nothing does): the slot cap, an unknown fee. */
    blocker: string;
    /** The wallet holds less than daily × days of the prize. */
    short: boolean;
    valid: boolean;
}

/** The checks of the daily prize form's add mode: amount, 1…36,500 days, the prize slot and the balance. */
export function checkDailyPrize(input: DailyPrizeCheckInput): DailyPrizeCheck {
    const { prizeDenom, prizeDecimals, dailyInput, daysInput, slot, feesKnown, prizeBalance } = input
    const dailyError = prizeDecimals === undefined ? '' : validateAmount(dailyInput, prizeDecimals)
    const daysError = validateScheduleDays(daysInput)
    const dailyUAmount = prizeDecimals !== undefined && dailyError === '' ? amountToUAmount(dailyInput, prizeDecimals) : undefined
    const days = daysError === '' ? Number(daysInput.trim()) : undefined
    const escrow = dailyUAmount !== undefined && days !== undefined ? new BigNumber(dailyUAmount).multipliedBy(days) : undefined
    const blocker = prizeBlocker({ prizeDenom, slot, feesKnown })
    const short = escrow !== undefined && prizeBalance !== undefined && prizeBalance.lt(escrow)

    return {
        dailyError,
        daysError,
        dailyUAmount: dailyUAmount === undefined ? undefined : new BigNumber(dailyUAmount),
        days,
        escrow,
        blocker,
        short,
        valid: Boolean(prizeDenom) && prizeDecimals !== undefined && escrow !== undefined && blocker === '' && !short,
    }
}

/** "50 BZE/day × 30 days". */
export function dailyPrizeSummary(dailyText: string, ticker: string, days: number): string {
    return `${dailyText} ${ticker}/day × ${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`
}

/** A first daily prize funded with the compounded reward. */
export interface FirstPrize {
    prizeDenom: string;
    /** Base units. */
    dailyUAmount: BigNumber | string;
    days: number;
}

export interface CompoundedCosts {
    /** Every fee the tx charges, named, in charging order. */
    fees: { label: string; coin: FeeCoin }[];
    /** The prize escrow (daily × days), when a first prize is funded. */
    escrow?: FeeCoin;
    /** The charged fees merged per denom: the first is resolved against the fee token, the rest are charged natively. */
    feeTotals: FeeCoin[];
    /** False when a fee that applies could not be read from the chain: never treat that as free. */
    feesKnown: boolean;
}

const sumByDenom = (coins: FeeCoin[]): FeeCoin[] => {
    const totals = new Map<string, BigNumber>()
    coins.forEach(c => totals.set(c.denom, (totals.get(c.denom) ?? new BigNumber(0)).plus(c.amount)))
    return Array.from(totals, ([denom, amount]) => ({ denom, amount: amount.toFixed(0) }))
}

// The names the guided forms give the fees summarizeScheduleCosts returns.
const PRIZE_FEE_LABELS: Record<string, string> = {
    'Schedule fee': 'Daily prize fee',
    'New prize token fee': 'New prize fee',
}

/**
 * What "make it stakable" takes from the wallet, before gas: `createDenomRewardFee`, and with a first
 * prize also the prize's own costs (from summarizeScheduleCosts).
 */
export function compoundedCosts(createFee: FeeCoin | undefined, prize?: ScheduleCostSummary): CompoundedCosts {
    const fees = [
        ...(createFee ? [{ label: 'Compounded reward fee', coin: createFee }] : []),
        ...(prize?.fees ?? []).map(f => ({ label: PRIZE_FEE_LABELS[f.label] ?? f.label, coin: f.coin })),
    ]
    // A zero fee param makes the charge free on chain; keep it named but don't count it.
    const charged = fees.map(f => f.coin).filter(c => new BigNumber(c.amount).gt(0))
    return {
        fees,
        escrow: prize?.escrow,
        feeTotals: sumByDenom(charged),
        feesKnown: Boolean(createFee) && (prize?.feesKnown ?? true),
    }
}

/** The tx kinds for the gas estimate: the create message, plus the schedule with a first prize. */
export const compoundedTxKind = (withPrize: boolean): TxSpec =>
    withPrize ? ['create-denom-reward', 'create-denom-reward-schedule'] : 'create-denom-reward'

/** `MsgCreateDenomReward`, followed by `MsgCreateDenomRewardSchedule` when a first prize is funded. */
export function compoundedRewardMsgs(creator: string, denom: string, prize?: FirstPrize) {
    const create = createDenomReward({ creator, denom })
    if (!prize) return [create]
    return [create, createDenomRewardSchedule({
        creator,
        denom,
        prizeDenom: prize.prizeDenom,
        dailyAmount: new BigNumber(prize.dailyUAmount).toFixed(0),
        duration: String(prize.days),
    })]
}
