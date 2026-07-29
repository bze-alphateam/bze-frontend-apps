import BigNumber from "bignumber.js";
import type {
    ValidatorSDKType,
    DelegationResponseSDKType,
} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import type { DelegationDelegatorRewardSDKType } from "@bze/bzejs/cosmos/distribution/v1beta1/distribution";

// Pure "my delegations" logic for the staking dashboard, extracted from
// useNativeStakingData so it can be unit-tested without React / chain queries.

export interface ValidatorWithDelegation {
    validator: ValidatorSDKType;
    delegation?: DelegationResponseSDKType;
    rewards: BigNumber;
}

export interface BuildMyValidatorsParams {
    /** Bonded validators — the global list used everywhere else in the UI. */
    allValidators: readonly ValidatorSDKType[];
    /**
     * Validators the delegator is bonded to as reported by the chain. This
     * includes jailed / unbonding / unbonded validators that are absent from
     * `allValidators`, so merging it in keeps those delegations visible.
     */
    delegatorValidators: readonly ValidatorSDKType[];
    /** The delegator's delegations (with their staked balance). */
    delegations: readonly DelegationResponseSDKType[];
    /** Per-validator reward entries for the delegator. */
    rewards: readonly DelegationDelegatorRewardSDKType[];
    /** The chain's native denom — the reward denom we surface. */
    nativeDenom: string;
}

// A staked balance below 1 uamount is dust left over from a full undelegation;
// such delegations are dropped so they don't clutter the list.
const MIN_STAKED_UAMOUNT = 1;

/**
 * The connected delegator's positions as a display-ready list: each entry pairs
 * a validator with its delegation and the pending native-denom rewards, sorted
 * by staked amount descending.
 *
 * `allValidators` only carries bonded validators, so `delegatorValidators` is
 * merged in to surface jailed / unbonding validators the user still has stake
 * with — otherwise those delegations would be silently hidden and the user
 * couldn't act on them. Returns a new array and never mutates its inputs.
 */
export function buildMyValidators({
    allValidators,
    delegatorValidators,
    delegations,
    rewards,
    nativeDenom,
}: BuildMyValidatorsParams): ValidatorWithDelegation[] {
    const validatorMap = new Map<string, ValidatorSDKType>();
    allValidators.forEach((v) => validatorMap.set(v.operator_address, v));
    delegatorValidators.forEach((v) => validatorMap.set(v.operator_address, v));

    return delegations
        .filter(
            (d) =>
                d.delegation &&
                validatorMap.has(d.delegation.validator_address) &&
                new BigNumber(d.balance?.amount ?? "0").gte(MIN_STAKED_UAMOUNT),
        )
        .map((d) => {
            const valAddr = d.delegation!.validator_address;
            const rewardEntry = rewards.find((r) => r.validator_address === valAddr);
            const nativeReward = rewardEntry?.reward.find((r) => r.denom === nativeDenom);
            return {
                validator: validatorMap.get(valAddr)!,
                delegation: d,
                rewards: new BigNumber(nativeReward?.amount ?? "0").integerValue(),
            };
        })
        .sort((a, b) => {
            const aAmount = new BigNumber(a.delegation?.balance?.amount ?? "0");
            const bAmount = new BigNumber(b.delegation?.balance?.amount ?? "0");
            return bAmount.minus(aAmount).toNumber();
        });
}
