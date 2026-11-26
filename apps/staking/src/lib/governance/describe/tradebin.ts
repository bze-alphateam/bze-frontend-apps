import BigNumber from "bignumber.js";
import {denomList, obj, strings, text, type Action, type Part, type Reader} from "./actions";

/** A decimal fraction as a percent with up to 2 decimals: `0.003` → `0.3%`. */
function pct(value: unknown): string {
    const n = new BigNumber(typeof value === "string" || typeof value === "number" ? value : NaN).times(100);
    return n.isFinite() ? `${n.decimalPlaces(2).toFixed()}%` : "?";
}

/** A pool id `base_quote` as `BASE/QUOTE` parts; the raw id when it does not split in two. */
function poolName(id: string): Part[] {
    const sides = id.split("_");
    return sides.length === 2 && sides[0] !== "" && sides[1] !== "" ? [{denom: sides[0]}, "/", {denom: sides[1]}] : [id || "unknown pool"];
}

/** The tradebin module's fee changes and the (v8.2.0) halt and resume of trading. */
export const readTradebin: Reader = (type, body) => {
    const sentence = (title: Part[], details: Part[][] = []): Action => ({type: "sentence", emergency: false, title, details});
    switch (type) {
        case "/bze.tradebin.MsgUpdatePools": {
            const updates = (Array.isArray(body.updates) ? body.updates : []).map(obj).filter((u) => u !== null);
            const details = updates.map((u): Part[] => {
                const dest = obj(u.fee_dest) ?? {};
                return [
                    ...poolName(text(u, "pool_id") ?? ""),
                    `: fee ${pct(u.fee)}, split ${pct(dest.providers)} liquidity providers / ${pct(dest.treasury)} protocol / ${pct(dest.burner)} buyback & burn`,
                ];
            });
            return sentence([`Change the fees of ${updates.length} ${updates.length === 1 ? "pool" : "pools"}`], details);
        }
        case "/bze.tradebin.MsgHaltDenoms":
            return sentence(["Halt trading of ", ...denomList(strings(body.denoms))]);
        case "/bze.tradebin.MsgUnhaltDenoms":
            return sentence(["Resume trading of ", ...denomList(strings(body.denoms))]);
        default:
            return null;
    }
};
