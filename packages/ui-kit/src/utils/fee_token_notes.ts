import {toPercentage} from "./number";
import type {DenomConfigInfo} from "../query/denom_config";

/** Ratio as a percent: ratio x 100, up to 2 decimals, no trailing zeros (0.5 -> "50", 0.015 -> "1.5"). */
export const formatRatioPercent = toPercentage;

/** "+50%" for a ratio of 0.5. */
export const formatSurchargePercent = (ratio: DenomConfigInfo["gasSurcharge"]): string => `+${formatRatioPercent(ratio)}%`;

// A ratio that shows as "0%" (zero, or so small it rounds to 0 at 2 decimals) is not worth a note.
const isShown = (ratio: DenomConfigInfo["gasSurcharge"]): boolean => ratio.gt(0) && formatRatioPercent(ratio) !== "0";
const hasSurcharge = (info?: DenomConfigInfo): info is DenomConfigInfo => Boolean(info) && isShown(info!.gasSurcharge);
const hasTransferFee = (info?: DenomConfigInfo): info is DenomConfigInfo => Boolean(info) && isShown(info!.transferFee);

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
