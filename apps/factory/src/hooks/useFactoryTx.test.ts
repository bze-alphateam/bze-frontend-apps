import { describe, it, expect } from "vitest";
import { txKindsOf } from "./useFactoryTx";

describe("txKindsOf", () => {
    it("maps a multi-send to its kind with the output count", () => {
        const msg = { typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend", value: { inputs: [{}], outputs: [{}, {}, {}] } };
        expect(txKindsOf([msg])).toEqual([{ kind: "multi-send", count: 3 }]);
    });

    it("keeps plain kinds and skips unknown messages", () => {
        expect(txKindsOf([
            { typeUrl: "/bze.tokenfactory.MsgMint" },
            { typeUrl: "/unknown.Msg" },
        ])).toEqual(["mint"]);
    });

    it("covers the burning raffle start (BFE-208)", () => {
        expect(txKindsOf([{ typeUrl: "/bze.burner.MsgStartRaffle" }])).toEqual(["start-raffle"]);
    });
});
