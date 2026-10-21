import { type Asset, createMarketId } from '@bze/bze-ui-kit'
import { haltedPairError } from '@/lib/halted'

/** Why the two picked tokens can't get a new market; `existingMarketId` when the market is already there. */
export interface MarketPairProblem {
    message: string;
    /** The existing market's id in its stored direction (`<base>/<quote>`), for the DEX link. */
    existingMarketId?: string;
}

/**
 * The pair checks of step 1: two different tokens, neither halted, and no market for the pair in
 * either direction (the chain rejects the reversed pair too). Undefined while a side is missing,
 * or when the pair is fine.
 */
export function marketPairProblem(
    baseDenom: string,
    quoteDenom: string,
    baseAsset: Asset | undefined,
    quoteAsset: Asset | undefined,
    marketExists: (marketId: string) => boolean,
): MarketPairProblem | undefined {
    if (!baseDenom || !quoteDenom) return undefined
    if (baseDenom === quoteDenom) return { message: 'Pick two different tokens.' }
    const halted = haltedPairError(baseAsset, quoteAsset)
    if (halted !== '') return { message: halted }
    const direct = createMarketId(baseDenom, quoteDenom)
    const reversed = createMarketId(quoteDenom, baseDenom)
    const existingMarketId = marketExists(direct) ? direct : marketExists(reversed) ? reversed : undefined
    if (existingMarketId) {
        return { message: 'This pair already has a market. Each pair gets exactly one.', existingMarketId }
    }
    return undefined
}

/** The MsgCreateMarket fields: the pair in the user's order (not sorted), base is what trades, quote is what it is priced in. */
export function createMarketMsgValue(input: { creator: string; baseDenom: string; quoteDenom: string }) {
    return { creator: input.creator, base: input.baseDenom, quote: input.quoteDenom }
}
