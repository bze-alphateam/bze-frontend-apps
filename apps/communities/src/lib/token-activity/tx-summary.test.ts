import {describe, expect, it} from "vitest";

import {routeDenoms, summarizeTx, type TxLeg, type TxSummarySource} from "./tx-summary";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const TMS = "factory/bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263/utms";
const CTR = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/uctr";
const SIGNER = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const DEX = "bze18mhtjwczlzqqgvw84uz8lrdv4hqule3jp8allp";
const CP = "bze1knfjgvdsv67u2ksejka54ulpfzegr6semkvjn0";
const BURNER = "bze1v7uw4xhrcv0vk7qp8jf9lu3hm5d8uu5yjp5qun";
const mod = (name: string) => ({name, kind: "module"});

const leg = (seq: number, msg_index: number | null, sender: string, recipient: string, label: TxLeg["recipient_label"], denom: string, amount: string): TxLeg =>
    ({seq, msg_index, sender, recipient, recipient_label: label, denom, amount});

const ROUTES = [`${TMS}_${NOAD}`, `${TMS}_ubze`, `${CTR}_ubze`];

// EDA3…B3C0 on testnet: 10 NOAD swapped for 6.866381 CTR through three pools.
const SWAP: TxSummarySource = {
    signer: SIGNER,
    fee: [{denom: "ubze", amount: "3823"}],
    messages: [{msg_index: 0, type_url: "/bze.tradebin.MsgMultiSwap", body: {input: {denom: NOAD, amount: "10000000"}, routes: ROUTES}}],
    transfers: [
        leg(0, null, SIGNER, "bze17xpfvakm2amg962yls6f84z3kell8c5lda0te2", mod("Fee collector"), "ubze", "3823"),
        leg(1, 0, SIGNER, DEX, mod("DEX"), NOAD, "10000000"),
        leg(2, 0, DEX, CP, mod("CP fee collector"), NOAD, "6000"),
        leg(3, 0, DEX, BURNER, mod("Burner"), NOAD, "4000"),
        leg(4, 0, DEX, CP, mod("CP fee collector"), TMS, "95700"),
        leg(5, 0, DEX, CP, mod("CP fee collector"), "ubze", "11874"),
        leg(6, 0, DEX, BURNER, mod("Burner"), "ubze", "11874"),
        leg(7, 0, DEX, SIGNER, null, CTR, "6866381"),
        leg(8, 0, SIGNER, DEX, mod("DEX"), "ubze", "100000"),
        leg(9, 0, DEX, "bze1pj73qt0lk9q64vwx4veu53ez6la2409wewcfqq", mod("Burner fee collector"), "ubze", "100000"),
    ],
};

const amounts = (list: { denom: string; amount: { toFixed: () => string } }[]) => list.map(({denom, amount}) => [denom, amount.toFixed()]);

describe("summarizeTx", () => {
    it("reads a swap the way the canvas draws it", () => {
        const summary = summarizeTx(SWAP, NOAD);

        expect(amounts(summary.paid)).toEqual([[NOAD, "10000000"]]);
        expect(amounts(summary.received)).toEqual([[CTR, "6866381"]]);
        expect(amounts(summary.tradingFee)).toEqual([["ubze", "100000"]]);
        expect(amounts(summary.swapFees)).toEqual([[NOAD, "10000"], [TMS, "95700"], ["ubze", "23748"]]);
        expect(amounts(summary.networkFee)).toEqual([["ubze", "3823"]]);
        expect(summary.route).toEqual(ROUTES);
    });

    it("sums the signer's legs of the message that moves the token, in and out", () => {
        const tx: TxSummarySource = {
            signer: SIGNER,
            fee: [{denom: "ubze", amount: "2000"}],
            messages: [
                {msg_index: 0, type_url: "/bze.rewards.MsgClaimStakingRewards"},
                {msg_index: 1, type_url: "/bze.rewards.MsgClaimDenomRewards"},
            ],
            transfers: [
                leg(1, 0, "rewards", SIGNER, null, CTR, "5"),
                leg(2, 1, "rewards", SIGNER, null, NOAD, "20"),
                leg(3, 1, "rewards", SIGNER, null, NOAD, "36"),
            ],
        };

        const summary = summarizeTx(tx, NOAD);

        expect(summary.message?.msg_index).toBe(1);
        expect(amounts(summary.received)).toEqual([[NOAD, "56"]]);
        expect(summary.paid).toEqual([]);
        expect(summary.route).toEqual([]);
    });

    it("falls back to the first message when none moves the token", () => {
        const tx: TxSummarySource = {signer: SIGNER, fee: [], messages: [{msg_index: 0, type_url: "/x.Msg"}], transfers: []};

        expect(summarizeTx(tx, NOAD).message?.type_url).toBe("/x.Msg");
    });
});

describe("routeDenoms", () => {
    it("walks the pools from the input", () => {
        expect(routeDenoms(NOAD, ROUTES)).toEqual([NOAD, TMS, "ubze", CTR]);
    });

    it("stops where a pool doesn't hold the denom the path is at", () => {
        expect(routeDenoms(NOAD, [`${TMS}_ubze`])).toEqual([NOAD]);
    });
});
