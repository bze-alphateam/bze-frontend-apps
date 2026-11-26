import {describe, expect, it} from "vitest";
import {DAO, DAO_ADDRESS, OTHER, STAKE_DAO, THIRD, WALLET} from "@/test/composer-fixtures";
import {handOverBlocked, nominateBlocked, withdrawBlocked} from "./operations";

const administered = {...DAO, admin: WALLET};
const option = (over: Partial<{staked: string; own: string}> = {}) => [{kind: "sr" as const, id: "000000000017", stakingDenom: "ulmn", lock: 7, staked: "100", own: "0", ...over}];

describe("nominate a successor", () => {
    it("takes a valid address that is neither the admin nor the DAO, any case", () => {
        expect(nominateBlocked(administered, OTHER)).toBeUndefined();
        expect(nominateBlocked(administered, ` ${OTHER.toUpperCase()} `)).toBeUndefined();
    });

    it.each([
        ["", /Enter the address/],
        ["nope", /not a valid BeeZee address/],
        [DAO_ADDRESS, /cannot be its own nominee/],
        [DAO_ADDRESS.toUpperCase(), /cannot be its own nominee/],
        [WALLET, /already the admin/],
    ])("refuses %j", (nominee, message) => {
        expect(nominateBlocked(administered, nominee)).toMatch(message);
    });

    it("one nomination at a time: a pending one blocks it whoever is typed (1112)", () => {
        expect(nominateBlocked({...administered, pending_admin: THIRD}, OTHER)).toMatch(/already pending.*1112/);
    });
});

describe("withdraw the nomination", () => {
    it("needs a pending one", () => {
        expect(withdrawBlocked(administered)).toMatch(/no pending nomination/);
        expect(withdrawBlocked({...administered, pending_admin: THIRD})).toBeUndefined();
    });
});

describe("hand the DAO to its voters", () => {
    it("a member list needs a member", () => {
        expect(handOverBlocked(administered, [])).toBeUndefined();
        expect(handOverBlocked({...administered, members: []}, [])).toMatch(/no voters to hand it to.*1113/);
    });

    it("is refused while a nomination is pending, whoever the nominee is (the chain looks at it first, 1112)", () => {
        expect(handOverBlocked({...administered, pending_admin: THIRD}, [])).toMatch(/already pending.*1112/);
    });

    it("a stake DAO needs voting stake in its sources, without its own stake", () => {
        const stake = {...STAKE_DAO, admin: WALLET};
        expect(handOverBlocked(stake, option())).toBeUndefined();
        expect(handOverBlocked(stake, option({staked: "100", own: "100"}))).toMatch(/no voters to hand it to/);
        expect(handOverBlocked(stake, option({staked: "100", own: "40"}))).toBeUndefined();
        expect(handOverBlocked(stake, option({staked: "0"}))).toMatch(/no voters to hand it to/);
        expect(handOverBlocked({...stake, electorate: {sr_ids: [], dr_denom: ""}}, option())).toMatch(/no voters to hand it to/);
        expect(handOverBlocked({...stake, electorate: null}, option())).toMatch(/no voters to hand it to/);
    });

    it("sources that could not be read block it: never read as no voters, never as live", () => {
        const stake = {...STAKE_DAO, admin: WALLET};
        expect(handOverBlocked(stake, null)).toMatch(/could not be read/);
        // a source of the electorate that the list does not have
        expect(handOverBlocked({...stake, electorate: {sr_ids: ["000000000099"], dr_denom: ""}}, option())).toMatch(/could not be read/);
    });
});
