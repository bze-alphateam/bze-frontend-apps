import {describe, expect, it} from "vitest";
import type {DaoVotingPowerResponse} from "@bze/bze-ui-kit";
import type {Part} from "@/lib/dao-view-loader";
import type {StakeSource} from "@/lib/dao-voters";
import {CONFIG, DAO, OTHER, PARAMS, STAKE_DAO, THIRD, WALLET} from "@/test/composer-fixtures";
import {proposerStatus, type EligibilityInput} from "./eligibility";

const power = (current: string): Part<DaoVotingPowerResponse | null> => ({ok: true, value: {current, proposals: []}});
const source = (staked: string, own = "0"): StakeSource => ({kind: "sr", id: "17", stakingDenom: "ubze", lockDays: 7, staked, own});
const open = (dao: typeof DAO, on: boolean) => ({...dao, config: {...CONFIG, open_submission: on}});

const base = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
    dao: DAO, params: PARAMS, wallet: WALLET, power: power("0"), openCount: 0, sources: {ok: true, value: []}, ...over,
});

describe("proposerStatus", () => {
    describe("a member-list DAO", () => {
        it("a member may propose", () => {
            expect(proposerStatus(base())).toMatchObject({kind: "allowed", reason: "You can propose: you're a member of this DAO."});
            expect(proposerStatus(base({wallet: WALLET.toUpperCase()}))).toMatchObject({kind: "allowed"});
        });
        it("someone else may not, unless the DAO is open", () => {
            expect(proposerStatus(base({wallet: THIRD}))).toMatchObject({kind: "not-a-voter", cause: "not-member", message: "Proposals here are for members. Ask a member to propose adding you."});
            expect(proposerStatus(base({dao: open(DAO, true), wallet: THIRD}))).toMatchObject({kind: "allowed", reason: "You can propose: anyone can submit proposals to this DAO."});
        });
        it("a DAO without members has no voters", () => {
            expect(proposerStatus(base({dao: {...DAO, members: []}}))).toMatchObject({kind: "blocked", cause: "no-voters", message: expect.stringContaining("nobody who can vote yet (1119)")});
        });
    });

    describe("a stake DAO", () => {
        const stake = (over: Partial<EligibilityInput> = {}) => base({dao: STAKE_DAO, sources: {ok: true, value: [source("1000")]}, ...over});

        it("stake now is only a maybe: the join rule is the chain's to check", () => {
            expect(proposerStatus(stake({power: power("500")}))).toMatchObject({kind: "maybe", reason: expect.stringContaining("joined or added to it before")});
        });
        it("no stake at all is clearly not a voter", () => {
            expect(proposerStatus(stake({power: power("0")}))).toMatchObject({kind: "not-a-voter", cause: "no-stake", message: expect.stringContaining("Proposals here are for stakers.")});
        });
        it("an open stake DAO takes anyone", () => {
            expect(proposerStatus(stake({dao: open(STAKE_DAO, true), power: power("0")}))).toMatchObject({kind: "allowed"});
        });
        it("a power the chain could not give leaves the decision to the chain", () => {
            expect(proposerStatus(stake({power: {ok: false}}))).toEqual({kind: "unknown"});
            expect(proposerStatus(stake({power: {ok: true, value: null}}))).toEqual({kind: "unknown"});
        });
        it("no stake in the sources, or only the DAO's own, means no voters", () => {
            expect(proposerStatus(stake({sources: {ok: true, value: [source("0")]}}))).toMatchObject({kind: "blocked"});
            expect(proposerStatus(stake({sources: {ok: true, value: [source("700", "700")]}}))).toMatchObject({kind: "blocked"});
            expect(proposerStatus(stake({sources: {ok: true, value: [source("700", "300")]}, power: power("1")}))).toMatchObject({kind: "maybe"});
        });
        it("sources that could not be read do not block", () => {
            expect(proposerStatus(stake({sources: {ok: false}, power: power("1")}))).toMatchObject({kind: "maybe"});
        });
        it("an electorate that is gone has no voters", () => {
            expect(proposerStatus(stake({dao: {...STAKE_DAO, electorate: null}}))).toMatchObject({kind: "blocked"});
        });
    });

    describe("open proposals", () => {
        it("blocks everyone at the limit and shows the count", () => {
            const status = proposerStatus(base({openCount: 10}));
            expect(status).toMatchObject({kind: "blocked", cause: "full", message: "10 of 10 proposal slots are in use. Wait for one to be settled (1120)."});
            expect(proposerStatus(base({openCount: 10, dao: open(DAO, true)}))).toMatchObject({kind: "blocked"});
        });
        it("one below the limit is fine; an unknown count does not block", () => {
            expect(proposerStatus(base({openCount: 9}))).toMatchObject({kind: "allowed"});
            expect(proposerStatus(base({openCount: null}))).toMatchObject({kind: "allowed"});
        });
    });

    it("another wallet that is a member passes", () => {
        expect(proposerStatus(base({wallet: OTHER}))).toMatchObject({kind: "allowed"});
    });
});
