import { describe, it, expect } from "vitest";
import { bze } from "@bze/bzejs";
import { DEFAULT_FEE_SETTINGS, denomConfigValue } from "./denom-config";

// The sign doc the wallet signs, built through the bzejs 4.0.0 converters from the value the form
// sends. Every field must be there, zero rates and an empty pool included.
const { MsgSetDenomConfig } = bze.tokenfactory;
const DENOM = "factory/bze1me/uhoney";
const POOL = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";

describe("MsgSetDenomConfig amino sign doc", () => {
    it("keeps an empty pool and zero rates for the default config", () => {
        const msg = MsgSetDenomConfig.fromPartial(denomConfigValue("bze1me", DENOM, DEFAULT_FEE_SETTINGS));

        expect(MsgSetDenomConfig.toAminoMsg(msg)).toEqual({
            type: "bze/x/tokenfactory/MsgSetDenomConfig",
            value: { creator: "bze1me", denom: DENOM, community_pool: "", transfer_fee: "0", gas_surcharge: "0" },
        });
    });

    it("writes the rates in the converter's decimal form (18-digit atomics) for non-zero values", () => {
        const msg = MsgSetDenomConfig.fromPartial(denomConfigValue("bze1me", DENOM, { communityPool: POOL, transferFeePct: "1", gasSurchargePct: "50" }));

        expect(MsgSetDenomConfig.toAminoMsg(msg).value).toEqual({
            creator: "bze1me",
            denom: DENOM,
            community_pool: POOL,
            transfer_fee: "10000000000000000",
            gas_surcharge: "500000000000000000",
        });
    });

    it("round-trips through the protobuf encoding with all three fields", () => {
        for (const settings of [DEFAULT_FEE_SETTINGS, { communityPool: POOL, transferFeePct: "0.01", gasSurchargePct: "200" }]) {
            const value = denomConfigValue("bze1me", DENOM, settings);
            const decoded = MsgSetDenomConfig.decode(MsgSetDenomConfig.encode(MsgSetDenomConfig.fromPartial(value)).finish());
            expect(decoded.communityPool).toBe(value.communityPool);
            expect(decoded.transferFee).toBe(value.transferFee);
            expect(decoded.gasSurcharge).toBe(value.gasSurcharge);
        }
    });
});
