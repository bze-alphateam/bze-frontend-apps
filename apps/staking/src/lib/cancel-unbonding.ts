import BigNumber from 'bignumber.js';
import type {UnbondingDelegationSDKType, ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

/**
 * Entries closer to completion than this are not offered for cancelling: the chain compares
 * against the block time, which can run ahead of the browser clock, and the tx still has to
 * be signed and included. The chain refuses an entry whose completion time has passed.
 */
export const CANCEL_COMPLETION_MARGIN_MS = 5 * 60 * 1000;

/** Why an entry can not be cancelled, or undefined when it can. */
export type CancelBlockReason = 'jailed' | 'completed' | 'empty';

export const CANCEL_BLOCK_REASON_TEXT: Record<CancelBlockReason, string> = {
    jailed: 'Validator is jailed: the chain does not allow cancelling until it is unjailed.',
    completed: 'Unbonding has completed (or is about to): it can no longer be cancelled.',
    empty: 'Nothing left in this entry to cancel.',
};

export interface UnbondingEntryView {
    /** Unique per entry: validator + creation height. */
    key: string;
    validatorAddress: string;
    moniker: string;
    /** The entry's current balance in micro-units (what a cancel puts back into delegation). */
    balance: BigNumber;
    /** Height the unbonding was created at, as the decimal string the chain returned. */
    creationHeight: string;
    completionTime: Date;
    /** True once the completion time is in the past (by the browser clock). */
    completed: boolean;
    jailed: boolean;
    blockReason?: CancelBlockReason;
}

interface BuildEntriesInput {
    unbondingDelegations: UnbondingDelegationSDKType[];
    /** Every validator known to the page: the bonded list plus the unbonding entries' own validators. */
    validators: ValidatorSDKType[];
    /** Milliseconds since epoch. */
    now: number;
    /** Fallback name when the validator is unknown. */
    fallbackName: (validatorAddress: string) => string;
}

/**
 * One view per unbonding entry, sorted by completion time, with the reason the chain would
 * refuse cancelling it (x/staking `CancelUnbondingDelegation`: jailed validator, entry whose
 * completion time has passed). A validator missing from `validators` is not treated as
 * jailed: the chain decides, and the tx simulation stops the transaction before signing.
 */
export function buildUnbondingEntries({unbondingDelegations, validators, now, fallbackName}: BuildEntriesInput): UnbondingEntryView[] {
    const byAddress = new Map<string, ValidatorSDKType>();
    validators.forEach(v => byAddress.set(v.operator_address, v));

    return unbondingDelegations.flatMap(d => {
        const validator = byAddress.get(d.validator_address);
        const jailed = validator?.jailed === true;
        const moniker = validator?.description?.moniker || fallbackName(d.validator_address);

        return d.entries.map(entry => {
            // REST returns int64 as a string and times as RFC 3339, whatever the SDK type says.
            const creationHeight = String(entry.creation_height);
            const completionTime = new Date(entry.completion_time);
            const balance = new BigNumber(entry.balance);
            const completed = completionTime.getTime() <= now;

            let blockReason: CancelBlockReason | undefined;
            if (jailed) {
                blockReason = 'jailed';
            } else if (completionTime.getTime() <= now + CANCEL_COMPLETION_MARGIN_MS) {
                blockReason = 'completed';
            } else if (!balance.isFinite() || !balance.gt(0)) {
                blockReason = 'empty';
            }

            return {
                key: `${d.validator_address}-${creationHeight}`,
                validatorAddress: d.validator_address,
                moniker,
                balance,
                creationHeight,
                completionTime,
                completed,
                jailed,
                blockReason,
            };
        });
    }).sort((a, b) => a.completionTime.getTime() - b.completionTime.getTime());
}

/** The entries a "Cancel all" sends, and how many it leaves out. */
export function splitCancellable(entries: UnbondingEntryView[]): {cancellable: UnbondingEntryView[]; skipped: UnbondingEntryView[]} {
    return {
        cancellable: entries.filter(e => !e.blockReason),
        skipped: entries.filter(e => !!e.blockReason),
    };
}

/** Total balance of the entries, micro-units. */
export function totalBalance(entries: UnbondingEntryView[]): BigNumber {
    return entries.reduce((sum, e) => sum.plus(e.balance), new BigNumber(0));
}

export interface CancelUnbondingMsgValue {
    delegatorAddress: string;
    validatorAddress: string;
    amount: {denom: string; amount: string};
    creationHeight: bigint;
}

/**
 * The `MsgCancelUnbondingDelegation` values for the entries: the entry's full current balance in
 * the bond denom, and its creation height (the chain finds the entry by it).
 */
export function cancelUnbondingValues(delegatorAddress: string, bondDenom: string, entries: UnbondingEntryView[]): CancelUnbondingMsgValue[] {
    return entries.map(e => ({
        delegatorAddress,
        validatorAddress: e.validatorAddress,
        amount: {denom: bondDenom, amount: e.balance.toFixed(0)},
        creationHeight: BigInt(e.creationHeight),
    }));
}

/** Distinct validator addresses of the unbonding delegations missing from `known`. */
export function missingValidatorAddresses(unbondingDelegations: UnbondingDelegationSDKType[], known: ValidatorSDKType[]): string[] {
    const knownSet = new Set(known.map(v => v.operator_address));
    return Array.from(new Set(unbondingDelegations.map(d => d.validator_address))).filter(a => !knownSet.has(a));
}
