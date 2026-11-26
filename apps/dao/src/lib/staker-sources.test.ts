import {describe, expect, it} from "vitest";
import {stakerSources} from "./staker-sources";

describe("stakerSources", () => {
    it("maps a staking reward to sr/{id} and a Denom Reward to dr/{staking denom}", () => {
        expect(stakerSources(
            [{reward_id: "1", amount: "500"}, {reward_id: "12", amount: "7"}],
            [{staking_denom: "ubze", amount: "9"}, {staking_denom: "factory/bze1abc/utoken", amount: "1"}],
        )).toEqual(["sr/1", "sr/12", "dr/ubze", "dr/factory/bze1abc/utoken"]);
    });

    it("lists a source once and leaves out a position without stake", () => {
        expect(stakerSources(
            [{reward_id: "1", amount: "5"}, {reward_id: "1", amount: "6"}, {reward_id: "2", amount: "0"}],
            [{staking_denom: "ubze", amount: "000"}],
        )).toEqual(["sr/1"]);
    });

    it("keeps a position whose answer carries no amount", () => {
        expect(stakerSources([{reward_id: "3"}], [{staking_denom: "ubze"}])).toEqual(["sr/3", "dr/ubze"]);
    });

    it("is empty for a wallet that stakes nowhere", () => {
        expect(stakerSources([], [])).toEqual([]);
    });
});
