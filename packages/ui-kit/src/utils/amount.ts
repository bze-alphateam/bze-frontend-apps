"use client";

import BigNumber from 'bignumber.js';

const MAX_PRICE_DECIMALS = 14;
// the chain's LegacyDec holds 18 decimals; a longer price string fails ValidateBasic
const MSG_PRICE_DECIMALS = 18;

export function toBigNumber(amount: string | number | BigNumber | bigint): BigNumber {
    if (amount instanceof BigNumber) {
        return amount;
    }

    return new BigNumber(amount);
}

export function uAmountToAmount(amount: string | number | BigNumber | bigint | undefined, noOfDecimals: number): string {
    return uAmountToBigNumberAmount(amount, noOfDecimals).toString();
}

export function uAmountToBigNumberAmount(amount: string | number | BigNumber | bigint | undefined, noOfDecimals: number): BigNumber {
    return toBigNumber(amount || 0)
        .shiftedBy((-1) * noOfDecimals)
        .decimalPlaces(noOfDecimals || 6)
}

// Whole micro-units only: the chain has no fraction of a micro-unit, and digits past the asset's
// decimals are dropped (never rounded up, so a user amount can't grow past what they typed).
export function amountToBigNumberUAmount(amount: string | number | BigNumber | bigint, noOfDecimals: number): BigNumber {
    return toBigNumber(amount)
        .shiftedBy(noOfDecimals)
        .integerValue(BigNumber.ROUND_DOWN);
}

// toFixed(0), not toString(): BigNumber switches to exponent notation ("1e+21") from 1e21 on,
// which no chain message accepts.
export function amountToUAmount(amount: string | number | BigNumber | bigint, noOfDecimals: number): string {
    return amountToBigNumberUAmount(amount, noOfDecimals).toFixed(0);
}

// A micro-unit price as the string a tradebin message carries: plain notation (toString() gives
// "5e-8" below 1e-7) and at most the 18 decimals the chain's LegacyDec parses, truncated.
export function uPriceToMsgPrice(uPrice: string | number | BigNumber): string {
    return toBigNumber(uPrice).decimalPlaces(MSG_PRICE_DECIMALS, BigNumber.ROUND_DOWN).toFixed();
}

export function prettyAmount(amount: number | string | BigNumber | bigint): string {
    const num = toBigNumber(amount)
    if (num.isNaN()) {
        return "0";
    }

    if (num.lt(1) && num.gt(0)) {
        return num.toFixed(6);
    }

    return Intl.NumberFormat('en', {notation: 'standard'}).format(num.toNumber());
}

export const priceToUPrice = (price: BigNumber, quoteExponent: number, baseExponent: number): string => {
    return priceToBigNumberUPrice(price, quoteExponent, baseExponent).toFixed(MAX_PRICE_DECIMALS).toString();
}

export const priceToBigNumberUPrice = (price: BigNumber | number | string, quoteExponent: number, baseExponent: number): BigNumber => {
    price = toBigNumber(price);

    return price.multipliedBy(Math.pow(10, (quoteExponent - baseExponent)));
}

export const uPriceToPrice = (price: BigNumber | string, quoteExponent: number, baseExponent: number): string => {
    return uPriceToBigNumberPrice(toBigNumber(price), quoteExponent, baseExponent).toString()
}

export const uPriceToBigNumberPrice = (price: BigNumber|number|bigint|string, quoteExponent: number, baseExponent: number): BigNumber => {
    const converted = toBigNumber(price);

    return converted.multipliedBy(Math.pow(10, (baseExponent - quoteExponent)));
}
