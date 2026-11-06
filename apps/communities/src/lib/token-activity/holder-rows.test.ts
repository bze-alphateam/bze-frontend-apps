import {describe, expect, it} from "vitest";

import {holderActivityRow} from "./holder-rows";
import type {ScanAccountActivity, ScanTx} from "./types";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const HOLDER = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const REWARDS = "bze1245yut9zht8q4hz39sd0lzqtzkuw5us58k46ua";
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

const tx = (): ScanTx => ({
    height: 4099244,
    tx_index: 0,
    hash: HASH,
    time: "2026-11-05T21:08:07.299673Z",
    success: true,
    msg_count: 2,
    msg_types: [CREATE_SCHEDULE, CREATE_SCHEDULE],
    fee: [{denom: "ubze", amount: "2195"}],
    signer: HOLDER,
    signers: [HOLDER],
    fee_payer: HOLDER,
    memo: null,
    code: 0,
    error_log: null,
    gas_wanted: 1,
    gas_used: 1,
    messages: [{msg_index: 0, type_url: CREATE_SCHEDULE, sender: HOLDER, module: "rewards", body: {}, events: []}],
    transfers: [
        {seq: 0, msg_index: null, kind: "transfer", sender: HOLDER, sender_label: null, recipient: "fees", recipient_label: null, denom: "ubze", amount: "2195", symbol: "BZE", exponent: 6},
        {seq: 1, msg_index: 0, kind: "transfer", sender: HOLDER, sender_label: null, recipient: REWARDS, recipient_label: {name: "Rewards", kind: "module"}, denom: NOAD, amount: "1000000000", symbol: "NOAD", exponent: 6},
    ],
    dex: null,
    ibc_transfers: null,
});

describe("holderActivityRow", () => {
    it("draws the holder's own change in the token, tagged like the Activity tab", () => {
        const row = holderActivityRow(item(), undefined, token, HOLDER);

        expect(row).toMatchObject({tag: "Rewards", title: "Started a reward program", amount: "1000000000", direction: "out", fee: FEE, more: 0, detailed: false});
    });

    it("takes the tag, title and message count from the transaction once read", () => {
        const row = holderActivityRow(item(), tx(), token, HOLDER);

        expect(row).toMatchObject({tag: "Rewards", amount: "1000000000", direction: "out", more: 1, detailed: true, actor: HOLDER});
    });

    it("counts a gain as incoming", () => {
        const row = holderActivityRow(item({deltas: [{denom: NOAD, amount: "56000000", symbol: "NOAD", exponent: 6}]}), undefined, token, HOLDER);

        expect(row).toMatchObject({amount: "56000000", direction: "in"});
    });

    it("skips block-level rows and rows that didn't change the token", () => {
        expect(holderActivityRow(item({tx_hash: null}), undefined, token, HOLDER)).toBeUndefined();
        expect(holderActivityRow(item({deltas: [{denom: "ubze", amount: "-728", symbol: "BZE", exponent: 6}]}), undefined, token, HOLDER)).toBeUndefined();
    });
});
