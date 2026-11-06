import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import type {AddressRewardsStaking, DenomRewardHolderItem} from "@bze/bze-ui-kit";

/** One place a holder stakes T: the holders pool or a fixed-term program. */
export interface StakePosition {
    id: string;
    kind: "pool" | "program";
    /** Base units staked now. */
    staked: BigNumber;
    /** Base units on their way out. */
    unlocking: BigNumber;
    /** Days a stake stays locked after leaving. */
    lockDays: number;
    /** A program's prize denom. */
    prizeDenom?: string;
}

export interface HolderStakesInput {
    denom: string;
    /** T's holders pool with the holder's position and unlocks; undefined when T has none. */
    pool?: DenomRewardHolderItem;
    /** Every fixed-term program (any staking denom). */
    programs: StakingRewardSDKType[];
    /** The holder's program stakes and unlocks. */
    staking?: AddressRewardsStaking;
}

const sum = (amounts: string[]): BigNumber => amounts.reduce((total, amount) => total.plus(amount || 0), new BigNumber(0));

/**
 * The holder's positions in T (holder page): the holders pool, then each program staking T,
 * kept when something is staked or unlocking. Positions in other tokens are left out.
 */
export function holderStakePositions({denom, pool, programs, staking}: HolderStakesInput): StakePosition[] {
    const positions: StakePosition[] = [];

    if (pool) {
        const staked = new BigNumber(pool.position?.participant.amount || 0);
        const unlocking = sum(pool.unlocks.filter((unlock) => unlock.staking_denom === denom).map((unlock) => unlock.amount));
        if (staked.gt(0) || unlocking.gt(0)) {
            positions.push({id: "pool", kind: "pool", staked, unlocking, lockDays: pool.denomReward.lock});
        }
    }

    for (const program of programs) {
        if (program.staking_denom !== denom) continue;
        const staked = new BigNumber(staking?.active.get(program.reward_id)?.amount || 0);
        const unlocking = sum((staking?.unlocking.get(program.reward_id) ?? []).map((unlock) => unlock.amount));
        if (staked.lte(0) && unlocking.lte(0)) continue;
        positions.push({id: program.reward_id, kind: "program", staked, unlocking, lockDays: program.lock, prizeDenom: program.prize_denom});
    }

    return positions;
}

/** What the holder stakes in T in all, base units (unlocking stakes not counted). */
export const totalStaked = (positions: StakePosition[]): BigNumber =>
    positions.reduce((total, position) => total.plus(position.staked), new BigNumber(0));
