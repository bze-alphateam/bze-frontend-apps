import BigNumber from "bignumber.js";

// tradebin's ValidateBasic refuses a price at or below 1e-10 (types/message_create_order.go minPrice)
const CHAIN_MIN_UPRICE = new BigNumber("0.0000000001");

/**
 * True when a price (micro units) is above the chain's floor, so the order is not refused
 * after the user signs it.
 */
export const isAboveChainMinPrice = (uPrice: BigNumber): boolean => uPrice.isFinite() && uPrice.gt(CHAIN_MIN_UPRICE);
