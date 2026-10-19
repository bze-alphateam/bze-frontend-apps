import BigNumber from "bignumber.js";
import type {MarketData} from "@bze/bze-ui-kit";

interface ListedMarket {
    base: string;
    quote: string;
}

interface CompareValue {
    amount: BigNumber;
    denom: string;
}

export interface MarketSortDeps<T extends ListedMarket> {
    isHalted: (market: T) => boolean;
    getMarketData: (market: T) => MarketData | undefined;
    isVerified: (market: T) => boolean;
    /** Compares two amounts by USD value; undefined while prices load (then only halted-last applies). */
    compareValues?: (a: CompareValue, b: CompareValue) => number;
}

/**
 * The order of the markets list: halted markets last (they stay listed so owners can reach
 * their resting orders), then markets with data, verified ones, ones with volume, and the
 * highest USD volume first. Returns a new array; the input is never sorted in place.
 */
export function sortMarkets<T extends ListedMarket>(markets: readonly T[], deps: MarketSortDeps<T>): T[] {
    const haltedLast = (a: T, b: T) => Number(deps.isHalted(a)) - Number(deps.isHalted(b));
    const {compareValues} = deps;
    if (!compareValues) {
        return [...markets].sort(haltedLast);
    }

    return [...markets].sort((a, b) => {
        const halted = haltedLast(a, b);
        if (halted !== 0) return halted;

        const aData = deps.getMarketData(a);
        const bData = deps.getMarketData(b);
        if (!aData && bData) return 1;
        if (aData && !bData) return -1;

        const aVerified = deps.isVerified(a);
        const bVerified = deps.isVerified(b);
        if (!aVerified && bVerified) return 1;
        if (aVerified && !bVerified) return -1;
        if (!aData || !bData) return 0;
        if (aData.quote_volume > 0 && bData.quote_volume === 0) return -1;
        if (aData.quote_volume === 0 && bData.quote_volume > 0) return 1;

        return -compareValues(
            {amount: new BigNumber(aData.quote_volume || 0), denom: a.quote},
            {amount: new BigNumber(bData.quote_volume || 0), denom: b.quote},
        );
    });
}
