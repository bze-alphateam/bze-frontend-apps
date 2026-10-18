import BigNumber from "bignumber.js";
import {bze} from "@bze/bzejs";
import type {
    StakingRewardParticipantSDKType,
    StakingRewardSDKType,
} from "@bze/bzejs/bze/rewards/store";
import {
    type AddressRewardsStaking,
    calculateRewardsStakingPendingRewards,
    claimableCoins,
    type DenomRewardHolderItem,
} from "@bze/bze-ui-kit";

const {claimDenomRewards, claimStakingRewards} = bze.rewards.MessageComposer.withTypeUrl;

/** A display amount in the drawer: grouped, no padding zeros; 2 decimals from 1 up, 6 below. */
export function walletAmount(amount: BigNumber): string {
    return amount.decimalPlaces(amount.abs().gte(1) ? 2 : 6, BigNumber.ROUND_DOWN).toFormat();
}

/** A USD value in the drawer, always with cents. */
export function walletUsd(amount: BigNumber): string {
    return `$${amount.toFormat(2, BigNumber.ROUND_HALF_UP)}`;
}

/** A coin in base units. */
export interface WalletCoin {
    denom: string;
    amount: BigNumber;
}

/** What the wallet drawer shows about the viewer's T positions (Business Logic R4), in base units. */
export interface TokenWalletPositions {
    /** Staked in T's holders pool (Denom Rewards). */
    holdersPool: BigNumber;
    /** Staked in the fixed-term programs whose staking denom is T. */
    programs: BigNumber;
    /** T on its way back: holders-pool exits plus program unstakes, still locked. */
    unlocking: BigNumber;
    /** Rewards ready to claim, one entry per prize denom, biggest first. */
    pending: WalletCoin[];
    /** Whether the holders pool has anything to claim. */
    claimHoldersPool: boolean;
    /** The programs staking T that have something to claim. */
    claimProgramIds: string[];
}

interface PositionsInput {
    denom: string;
    /** The holders pool of T as the viewer sees it; undefined when T has none. */
    holdersPool?: DenomRewardHolderItem;
    /** Every fixed-term program (they are filtered on `staking_denom = T` here). */
    programs: StakingRewardSDKType[];
    /** The viewer's program stakes and unstakes. */
    addressPrograms?: AddressRewardsStaking;
}

const add = (totals: Map<string, BigNumber>, denom: string, amount: BigNumber.Value) =>
    totals.set(denom, (totals.get(denom) ?? new BigNumber(0)).plus(amount));

/**
 * The viewer's T positions: holders pool + programs staking T. Programs that pay T but stake
 * another token are not counted here (they belong to Earn).
 */
export function tokenWalletPositions({denom, holdersPool, programs, addressPrograms}: PositionsInput): TokenWalletPositions {
    const pending = new Map<string, BigNumber>();

    const poolPending = claimableCoins(holdersPool?.position);
    poolPending.forEach((coin) => add(pending, coin.denom, coin.amount));

    let staked = new BigNumber(0);
    let unlocking = (holdersPool?.unlocks ?? []).reduce((sum, unlock) => sum.plus(unlock.amount), new BigNumber(0));
    const claimProgramIds: string[] = [];

    for (const program of programs) {
        if (program.staking_denom !== denom) continue;

        const stake: StakingRewardParticipantSDKType | undefined = addressPrograms?.active.get(program.reward_id);
        if (stake) {
            staked = staked.plus(stake.amount || 0);
            const reward = calculateRewardsStakingPendingRewards(program, stake);
            if (reward.gt(0)) {
                add(pending, program.prize_denom, reward);
                claimProgramIds.push(program.reward_id);
            }
        }

        for (const unlock of addressPrograms?.unlocking.get(program.reward_id) ?? []) {
            unlocking = unlocking.plus(unlock.amount || 0);
        }
    }

    return {
        holdersPool: new BigNumber(holdersPool?.position?.participant.amount || 0),
        programs: staked,
        unlocking,
        pending: Array.from(pending.entries())
            .map(([coinDenom, amount]) => ({denom: coinDenom, amount}))
            .sort((a, b) => b.amount.comparedTo(a.amount) ?? 0),
        claimHoldersPool: poolPending.length > 0,
        claimProgramIds,
    };
}

/**
 * The messages of "Claim all": one holders-pool claim when it has something pending, one claim per
 * program with something pending. Never a claim with nothing in it (the chain rejects those).
 */
export function claimAllMessages(creator: string, denom: string, positions: TokenWalletPositions) {
    return [
        ...(positions.claimHoldersPool ? [claimDenomRewards({creator, denom})] : []),
        ...positions.claimProgramIds.map((rewardId) => claimStakingRewards({creator, rewardId})),
    ];
}
