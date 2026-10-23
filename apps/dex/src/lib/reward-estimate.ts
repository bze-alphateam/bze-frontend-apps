import BigNumber from "bignumber.js";
import type {DenomRewardCoin} from "@bze/bze-ui-kit";
import type {StakingRow} from "@/lib/staking-list";

// The income a new stake (or an addition to one) would earn in a simple or compounded reward,
// from today's daily prizes and the pool size. Prices come in as a function, so this needs no React.

export interface RewardIncomeToken extends DenomRewardCoin {
    /** USD value of `amount`; undefined when the token has no price. */
    usd?: BigNumber;
}

export interface RewardIncomeEstimate {
    /** What the added amount earns per day, per prize token: priced tokens by USD value first, then the rest. */
    tokens: RewardIncomeToken[];
    /** USD per day of the priced tokens. */
    usdPerDay: BigNumber;
    usdPer30Days: BigNumber;
    usdPerYear: BigNumber;
    /** Prize tokens left out of the USD figures because they have no price (they still pay). */
    unpriced: number;
    /** Days the reward still pays (a simple reward ends); undefined while it runs on. */
    daysLeft?: number;
    /** The viewer's share of the pool after the stake, in percent. */
    shareAfterPct: number;
    /** USD per day of the whole position after the stake (priced tokens only). */
    totalUsdPerDay: BigNumber;
}

const bn = (v: BigNumber.Value | undefined) => new BigNumber(v ?? 0);

/**
 * Estimates what adding `addUAmount` (base units of the staking denom) to a reward earns. Each
 * day's prize is split by stake, so the added part earns `prize × (mine + add) / (total + add)`
 * minus what the current stake earns now. Undefined when nothing is added, the reward has
 * finished, or it has no daily prizes (airdrops only).
 */
export function estimateRewardIncome(
    row: StakingRow,
    addUAmount: BigNumber.Value,
    usdValue: (denom: string, uAmount: BigNumber.Value) => BigNumber,
): RewardIncomeEstimate | undefined {
    const add = bn(addUAmount);
    if (add.isNaN() || !add.gt(0) || row.status === 'finished' || !row.daily || row.daily.length === 0) return undefined;

    const total = BigNumber.max(bn(row.totalStaked), 0);
    // the viewer's stake is part of the total; never count more than the total as theirs
    const mine = BigNumber.min(BigNumber.max(bn(row.position?.stake), 0), total);
    const after = mine.plus(add);
    const totalAfter = total.plus(add);

    const priced = (denom: string, amount: BigNumber) => {
        const usd = usdValue(denom, amount);
        return usd.gt(0) ? usd : undefined;
    };

    let totalUsdPerDay = bn(0);
    const tokens: RewardIncomeToken[] = row.daily.map(prize => {
        const prizeAmount = bn(prize.amount);
        const whole = prizeAmount.multipliedBy(after).dividedBy(totalAfter);
        const now = total.gt(0) ? prizeAmount.multipliedBy(mine).dividedBy(total) : bn(0);
        const gain = BigNumber.max(whole.minus(now), 0).integerValue(BigNumber.ROUND_FLOOR);

        const wholeUsd = priced(prize.denom, whole.integerValue(BigNumber.ROUND_FLOOR));
        if (wholeUsd) totalUsdPerDay = totalUsdPerDay.plus(wholeUsd);
        return {denom: prize.denom, amount: gain.toFixed(0), usd: priced(prize.denom, gain)};
    }).filter(t => bn(t.amount).gt(0));

    tokens.sort((a, b) => {
        if (a.usd && b.usd) return b.usd.comparedTo(a.usd) ?? 0;
        if (a.usd) return -1;
        if (b.usd) return 1;
        return 0;
    });

    const usdPerDay = tokens.reduce((s, t) => (t.usd ? s.plus(t.usd) : s), bn(0));
    const daysLeft = row.progress ? Math.max(0, row.progress.duration - row.progress.done) : undefined;
    const days = (n: number) => usdPerDay.multipliedBy(daysLeft === undefined ? n : Math.min(n, daysLeft));

    return {
        tokens,
        usdPerDay,
        usdPer30Days: days(30),
        usdPerYear: days(365),
        unpriced: tokens.filter(t => !t.usd).length,
        daysLeft,
        shareAfterPct: after.dividedBy(totalAfter).multipliedBy(100).toNumber(),
        totalUsdPerDay,
    };
}
