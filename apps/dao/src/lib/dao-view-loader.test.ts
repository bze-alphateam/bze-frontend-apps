import {describe, expect, it, vi} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import type {DaoPageScan} from "./dao-page-scan";
import type {ScanVoterBallot} from "./dao-types";
import {
    DaoModuleUnsupported, loadDaoView, loadMyVotes, loadHistoryPage, parseDaoId, type DaoViewChain, type DaoViewDeps,
} from "./dao-view-loader";

const dao = (over: Partial<Dao> = {}): Dao => ({
    id: "2", address: "bze1dao2", admin: "bze1dao2", pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: "Founders", description: "",
    config: {} as Dao["config"], members: [], created_at: "1790000000", admin_seq: "0", pending_admin_seq: "0", ...over,
});

function deps(chain: Partial<DaoViewChain> = {}, scan: Partial<DaoPageScan> = {}): DaoViewDeps {
    return {
        chain: {
            getDao: vi.fn(async () => dao()),
            getParams: vi.fn(async () => ({max_open_proposals: "10"}) as never),
            getController: vi.fn(async () => ({controller: "bze1dao2", end_reason: "SELF_OWNED" as const, path: ["bze1dao2"]})),
            getDaoByAddress: vi.fn(async () => null),
            getBalances: vi.fn(async () => [{denom: "ubze", amount: "5"}]),
            getOpenProposals: vi.fn(async () => []),
            getStakeSources: vi.fn(async () => []),
            getVotingPower: vi.fn(async () => null),
            ...chain,
        },
        scan: {
            daoDetail: vi.fn(async () => null),
            history: vi.fn(async () => ({items: [], next_cursor: null})),
            votesByVoter: vi.fn(async () => ({items: [], next_cursor: null, supported: true})),
            ...scan,
        },
    };
}

const ballot = (proposal: number, daoId: number | null): ScanVoterBallot => ({
    proposal: {id: proposal, title: null, status: null, voting_end: null}, dao: daoId === null ? null : {id: daoId, name: "x"},
    option: "YES", weight: "1", effective_weight: "1", height: 1, tx_hash: null, time: "2026-11-01T00:00:00Z",
});

describe("parseDaoId", () => {
    it.each([["2", "2"], ["007", "7"], ["abc", null], ["0", null], ["-1", null], ["", null], ["1.5", null], ["1e3", null]])("%s", (raw, expected) => {
        expect(parseDaoId(raw)).toBe(expected);
    });
});

describe("loadDaoView", () => {
    it("an id that is not a number is not found and asks nothing", async () => {
        const d = deps();
        expect(await loadDaoView(d, "abc")).toEqual({state: "not-found"});
        expect(d.chain.getDao).not.toHaveBeenCalled();
    });

    it("an unknown DAO is not found", async () => {
        expect(await loadDaoView(deps({getDao: vi.fn(async () => null)}), "9")).toEqual({state: "not-found"});
    });

    it("a node without x/dao is unsupported; another failure is thrown", async () => {
        expect(await loadDaoView(deps({getDao: vi.fn(async () => { throw new DaoModuleUnsupported(); })}), "2")).toEqual({state: "unsupported"});
        await expect(loadDaoView(deps({getDao: vi.fn(async () => { throw new Error("down"); })}), "2")).rejects.toThrow("down");
    });

    it("loads the live parts and knows the DAO itself", async () => {
        const result = await loadDaoView(deps(), "2");
        expect(result.state).toBe("ok");
        if (result.state !== "ok") return;
        expect(result.view.treasury).toEqual({ok: true, value: [{denom: "ubze", amount: "5"}]});
        expect(result.view.knownDaos.get("bze1dao2")).toEqual({id: "2", name: "Founders"});
        expect(result.view.sources).toEqual({ok: true, value: []});
    });

    it("a part that fails does not take the page down", async () => {
        const result = await loadDaoView(deps({
            getBalances: vi.fn(async () => { throw new Error("x"); }),
            getParams: vi.fn(async () => { throw new Error("x"); }),
            getOpenProposals: vi.fn(async () => { throw new Error("x"); }),
        }), "2");
        expect(result.state === "ok" && [result.view.treasury.ok, result.view.params.ok, result.view.openProposals.ok]).toEqual([false, false, false]);
    });

    it("names the DAOs among the admin chain", async () => {
        const d = deps({
            getDao: vi.fn(async () => dao({admin: "bze1b", pending_admin: "bze1n"})),
            getController: vi.fn(async () => ({controller: "bze1b", end_reason: "SELF_OWNED" as const, path: ["bze1dao2", "bze1b"]})),
            getDaoByAddress: vi.fn(async (a: string) => (a === "bze1b" ? dao({id: "3", name: "Parent", address: "bze1b"}) : null)),
        });
        const result = await loadDaoView(d, "2");
        expect(result.state === "ok" && result.view.knownDaos.get("bze1b")).toEqual({id: "3", name: "Parent"});
        expect(result.state === "ok" && result.view.knownDaos.has("bze1n")).toBe(false);
    });

    it("reads the sources of a stake electorate, and a failure there is a failed part", async () => {
        const stake = dao({type: "DAO_TYPE_STAKE", electorate: {sr_ids: ["1"], dr_denom: ""}});
        const ok = await loadDaoView(deps({getDao: vi.fn(async () => stake), getStakeSources: vi.fn(async () => [{kind: "dr" as const, stakingDenom: "ubze", lockDays: 5, staked: "1"}])}), "2");
        expect(ok.state === "ok" && ok.view.sources.ok).toBe(true);
        const failed = await loadDaoView(deps({getDao: vi.fn(async () => stake), getStakeSources: vi.fn(async () => { throw new Error("x"); })}), "2");
        expect(failed.state === "ok" && failed.view.sources.ok).toBe(false);
    });
});

describe("loadMyVotes", () => {
    it("keeps only the votes of this DAO, across pages", async () => {
        const votesByVoter = vi.fn()
            .mockResolvedValueOnce({items: [ballot(1, 2), ballot(2, 3), ballot(3, null)], next_cursor: "c", supported: true})
            .mockResolvedValueOnce({items: [ballot(4, 2)], next_cursor: null, supported: true});
        const votes = await loadMyVotes(deps({}, {votesByVoter}), "2", "bze1me");
        expect(votes.items.map((v) => v.proposal.id)).toEqual([1, 4]);
        expect(votes.truncated).toBe(false);
        expect(votesByVoter).toHaveBeenNthCalledWith(2, "bze1me", "c", 100);
    });

    it("stops at a page cap and says it did", async () => {
        const votesByVoter = vi.fn(async () => ({items: [], next_cursor: "more", supported: true}));
        const votes = await loadMyVotes(deps({}, {votesByVoter}), "2", "bze1me");
        expect(votes.truncated).toBe(true);
        expect(votesByVoter).toHaveBeenCalledTimes(5);
    });
});

describe("loadHistoryPage", () => {
    it("passes the cursor and returns the next one", async () => {
        const history = vi.fn(async () => ({items: [], next_cursor: "n"}));
        expect(await loadHistoryPage(deps({}, {history}), "2", "c")).toEqual({items: [], next: "n"});
        expect(history).toHaveBeenCalledWith("2", "c", 20);
    });
});
