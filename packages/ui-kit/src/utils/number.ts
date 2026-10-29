import {toBigNumber} from "./amount";
import BigNumber from "bignumber.js";

/**
 * Keeps digits and a single decimal separator. With `maxDecimals` (the asset's decimals) it also
 * drops the digits past what the asset can hold, so a typed amount always converts to whole
 * micro-units (a 0-decimal asset accepts no separator at all).
 */
export const sanitizeNumberInput = (input: string, maxDecimals?: number) => {
    let sanitized = input.replace(/[^0-9.,]/g, '');
    sanitized = sanitized.replace(",", ".");

    const parts = sanitized.split('.');
    if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    if (maxDecimals !== undefined && maxDecimals >= 0) {
        const [whole, fraction] = sanitized.split('.');
        if (fraction !== undefined) {
            sanitized = maxDecimals === 0 ? whole : `${whole}.${fraction.slice(0, maxDecimals)}`;
        }
    }

    return sanitized;
}

export const sanitizeIntegerInput = (input: string): string => {
    if (input.length === 0) {
        return "";
    }

    const sanitized = input.replace(/[^0-9]/g, '');

    const parsed = parseInt(sanitized, 10);
    if (!parsed) {
        return "1";
    }

    return `${parsed}`;
}

export const toPercentage = (dec: number|bigint|BigNumber|string) => toBigNumber(dec).multipliedBy(100).decimalPlaces(2).toString();
