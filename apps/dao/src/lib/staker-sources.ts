// The electorate sources a wallet stakes in, in the join-record form the chain
// and Scan use: `sr/{reward_id}` for a staking reward, `dr/{staking_denom}` for
// a Denom Reward. They come from the two x/rewards queries
// (`staking_reward_participant/{address}` and `denom_reward_participations/{address}`).

export interface StakingRewardParticipation {
    reward_id: string;
    amount?: string;
}

export interface DenomRewardParticipation {
    staking_denom: string;
    amount?: string;
}

const staked = (amount: string | undefined): boolean => amount === undefined || !/^0*$/.test(amount);

/** The sources of both lists, each once, a position without stake left out. */
export function stakerSources(
    stakingRewards: readonly StakingRewardParticipation[],
    denomRewards: readonly DenomRewardParticipation[],
): string[] {
    const sources = new Set<string>();
    for (const p of stakingRewards) {
        if (p.reward_id && staked(p.amount)) sources.add(`sr/${p.reward_id}`);
    }
    for (const p of denomRewards) {
        if (p.staking_denom && staked(p.amount)) sources.add(`dr/${p.staking_denom}`);
    }
    return [...sources];
}
