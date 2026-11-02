import BigNumber from "bignumber.js";
import {toBigNumber} from "./amount";

/**
 * An asset's USD price from its two quotes: the price in USDC (its USDC pool, else its USDC
 * order book) wins whenever there is one; only an asset without a USDC price is priced through
 * BZE (its BZE price times BZE's USD price). Never an average of the two: a thin BZE pool must
 * not drag an asset away from its USDC market. 0 when neither has a price.
 */
export function assetUsdPrice(priceInUsd: BigNumber, priceInBze: BigNumber, bzeUsdPrice: BigNumber): BigNumber {
    if (priceInUsd.gt(0)) return priceInUsd;
    if (priceInBze.gt(0)) return priceInBze.multipliedBy(bzeUsdPrice);

    return toBigNumber(0);
}
