import { prettyAmount, toBigNumber, uAmountToBigNumberAmount } from "@bze/bze-ui-kit";
import type { RaffleSDKType } from "@bze/bzejs/bze/burner/raffle";

// Pure raffle display logic, extracted from the raffle card/pages so it can be
// unit-tested without React. Chain-value formatting is delegated to ui-kit's
// pure helpers (toBigNumber / uAmountToBigNumberAmount / prettyAmount); this
// module has no next/* or React imports.

/**
 * The raffle prize — the pot scaled by the payout ratio — as a display string.
 * `pot` is a uamount, so `decimals` converts it to a human amount first.
 */
export function rafflePrize(
    pot: RaffleSDKType["pot"],
    ratio: RaffleSDKType["ratio"],
    decimals: number,
): string {
    const potAmount = uAmountToBigNumberAmount(pot, decimals);
    const prizeAmount = potAmount.multipliedBy(toBigNumber(ratio));
    return prettyAmount(prizeAmount);
}

/**
 * Win chance rendered as a "1 in N" string. `chances` is the number of winning
 * chances out of one million; a non-positive or unparseable value yields "N/A".
 */
export function raffleWinChance(chances: RaffleSDKType["chances"]): string {
    const chancesBn = toBigNumber(chances);
    if (chancesBn.isNaN() || !chancesBn.isPositive()) {
        return "N/A";
    }
    const oneMillion = toBigNumber(1000000);
    const odds = oneMillion.dividedBy(chancesBn);
    return `1 in ${prettyAmount(odds)}`;
}
