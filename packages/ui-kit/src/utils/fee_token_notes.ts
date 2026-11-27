import BigNumber from "bignumber.js";
import {toPercentage} from "./number";
import type {DenomConfigInfo} from "../query/denom_config";

/**
 * Ratio as a percent: ratio x 100, up to 2 decimals, no trailing zeros (0.5 -> "50", 0.015 -> "1.5").
 * A non-zero ratio below 0.01% reads "<0.01" so a setting never shows as "0".
 */
export const formatRatioPercent = (ratio: DenomConfigInfo["gasSurcharge"] | number | string): string => {
    const text = toPercentage(ratio);
    return text === "0" && new BigNumber(ratio).gt(0) ? "<0.01" : text;
}

/** "+50%" for a ratio of 0.5. */
export const formatSurchargePercent = (ratio: DenomConfigInfo["gasSurcharge"]): string => `+${formatRatioPercent(ratio)}%`;

/** True when paying a tx fee in the token costs a gas surcharge (any non-zero ratio). */
export const hasSurcharge = (info?: DenomConfigInfo): info is DenomConfigInfo => Boolean(info) && info!.gasSurcharge.gt(0);
/** True when protocol fees paid in the token cost a transfer fee (any non-zero ratio). */
export const hasTransferFee = (info?: DenomConfigInfo): info is DenomConfigInfo => Boolean(info) && info!.transferFee.gt(0);

/** Short muted note shown next to a fee token option, e.g. "network fee +50% · app fees +1%". '' when none. */
export const feeTokenOptionNote = (info?: DenomConfigInfo): string => {
    const parts: string[] = [];
    if (hasSurcharge(info)) {
        parts.push(`network fee ${formatSurchargePercent(info.gasSurcharge)}`);
    }
    if (hasTransferFee(info)) {
        parts.push(`app fees ${formatSurchargePercent(info.transferFee)}`);
    }
    return parts.join(" · ");
}

/** Sentence explaining what paying fees in the token costs extra. '' when the token has no setting. */
export const feeTokenExplanation = (ticker: string, info?: DenomConfigInfo): string => {
    const sentences: string[] = [];
    if (hasSurcharge(info)) {
        const receiver = info.communityPool ? `which goes to the ${ticker} community` : "which is burned";
        sentences.push(
            `Paying fees in ${ticker} costs ${formatRatioPercent(info.gasSurcharge)}% more network fee, ${receiver}.`,
        );
    }
    if (hasTransferFee(info)) {
        sentences.push(`App fees paid in ${ticker} cost ${formatRatioPercent(info.transferFee)}% more.`);
    }
    return sentences.join(" ");
}

/** "includes +50% HONEY surcharge" for the fee estimate line. '' when the token has no gas surcharge. */
export const feeSurchargeNote = (ticker: string, info?: DenomConfigInfo): string =>
    hasSurcharge(info) ? `includes ${formatSurchargePercent(info.gasSurcharge)} ${ticker} surcharge` : "";
