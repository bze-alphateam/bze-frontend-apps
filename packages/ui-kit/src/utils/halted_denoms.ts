/**
 * Pure halted-denom predicates. A market or pool is halted when its base OR its quote is halted.
 * Denoms are compared exactly — never parse or substring-match a market/pool id, since factory and
 * IBC denoms contain the `/` and `_` separators those ids are built with.
 */

export interface DenomPair {
    base: string;
    quote: string;
}

export const isDenomHaltedIn = (halted: ReadonlySet<string>, denom: string | undefined): boolean =>
    !!denom && halted.has(denom);

export const isPairHaltedIn = (halted: ReadonlySet<string>, pair: DenomPair | undefined): boolean =>
    !!pair && (halted.has(pair.base) || halted.has(pair.quote));
