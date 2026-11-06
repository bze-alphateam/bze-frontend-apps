import {describe, expect, it} from "vitest";

import {holderActivityRow} from "./holder-rows";
import type {ScanAccountActivity} from "./types";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const HOLDER = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const HASH = "7FC2CF6CB23815BBDEA52752C5F2C4D38ED67F141236059EF3D72E3CB676E7C1";
const token = {denom: NOAD, symbol: "NOAD", exponent: 6};
const FEE = [{denom: "ubze", amount: "2195", symbol: "BZE", exponent: 6}];
const CREATE_SCHEDULE = "/bze.rewards.MsgCreateDenomRewardSchedule";

// 7FC2…E7C1 on testnet: the creator started a 1,000 NOAD reward program.
const item = (extra: Partial<ScanAccountActivity> = {}): ScanAccountActivity => ({
    time: "2026-11-05T21:08:07.299673Z",
    height: 4099244,
    tx_hash: HASH,
    kind: "reward_program",
    category: "rewards",
    is_signer: true,
    success: true,
    counterparty: null,
    deltas: [
        {denom: NOAD, amount: "-1000000000", symbol: "NOAD", exponent: 6},
        {denom: "ubze", amount: "-50000002195", symbol: "BZE", exponent: 6},
    ],
    msg_types: [CREATE_SCHEDULE],
    details: null,
    fee: FEE,
    ...extra,
});

describe("holderActivityRow", () => {
    it("draws the holder's own change in the token, tagged like the Activity tab", () => {
        const row = holderActivityRow(item(), token, HOLDER);

        expect(row).toMatchObject({tag: "Rewards", title: "Started a reward program", amount: "1000000000", direction: "out", fee: FEE, more: 0});
    });

    it("counts the other messages of the transaction", () => {
        const row = holderActivityRow(item({msg_types: ["/bze.rewards.MsgClaimStakingRewards", "/bze.rewards.MsgClaimDenomRewards"]}), token, HOLDER);

        expect(row).toMatchObject({tag: "Claim", title: "Claimed rewards", more: 1});
    });

    it("counts a gain as incoming", () => {
        const row = holderActivityRow(item({deltas: [{denom: NOAD, amount: "56000000", symbol: "NOAD", exponent: 6}]}), token, HOLDER);

        expect(row).toMatchObject({amount: "56000000", direction: "in"});
    });

    it("shows no fee when the holder didn't pay it", () => {
        expect(holderActivityRow(item({fee: null}), token, HOLDER)?.fee).toEqual([]);
    });

    it("skips block-level rows and rows that didn't change the token", () => {
        expect(holderActivityRow(item({tx_hash: null}), token, HOLDER)).toBeUndefined();
        expect(holderActivityRow(item({deltas: [{denom: "ubze", amount: "-728", symbol: "BZE", exponent: 6}]}), token, HOLDER)).toBeUndefined();
    });
});
