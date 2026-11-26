import {describe, expect, it, vi} from "vitest";
import type {DaoBallot, Dao} from "@bze/bze-ui-kit";
import {ScanUnavailableError} from "./dao-scan";
import type {DaoProposalScan} from "./dao-proposal-scan";
import {DaoModuleUnsupported} from "./dao-view-loader";
import {
    loadActiveProposals, loadFinishedProposals, loadMyVote, loadProposal, loadVotes, refreshProposal,
    type ProposalChain, type ProposalDeps,
} from "./proposal-loader";
import {CONFIG, PROPOSAL, RESPONSE, SCAN} from "./proposal-fixtures";
import type {ScanProposalSummary} from "./proposal-types";

const DAO = {id: "4", name: "Stakers club", type: "DAO_TYPE_STAKE", address: "bze1dao", electorate: {sr_ids: ["000000000017"], dr_denom: ""}} as unknown as Dao;
const PARAMS = {min_expedite_delay: "86400s"} as never;
const DOWN = () => Promise.reject(new ScanUnavailableError("down"));

const chainWith = (over: Partial<ProposalChain> = {}): ProposalChain => ({
    getProposal: vi.fn(async () => RESPONSE),
    getDao: vi.fn(async () => DAO),
    getParams: vi.fn(async () => PARAMS),
    getBallot: vi.fn(async () => null),
    getBallots: vi.fn(async () => ({items: [], nextKey: null})),
    getVotingPower: vi.fn(async () => null),
    getDaoProposals: vi.fn(async () => ({items: [], nextKey: null})),
    getStakingDenom: vi.fn(async () => "ubze"),
    ...over,
});
const scanWith = (over: Partial<DaoProposalScan> = {}): DaoProposalScan => ({
    listForDao: vi.fn(async () => ({items: [], next_cursor: null})),
    detail: vi.fn(async () => SCAN),
    votes: vi.fn(async () => ({items: [], next_cursor: null, weight_denom: null})),
    ...over,
});
const deps = (chain: Partial<ProposalChain> = {}, scan: Partial<DaoProposalScan> = {}): ProposalDeps => ({chain: chainWith(chain), scan: scanWith(scan)});

describe("loadProposal", () => {
    it("is the chain's proposal with Scan's extras and the weight denom Scan names", async () => {
        const result = await loadProposal(deps(), "7");
        expect(result.state).toBe("ok");
        if (result.state !== "ok") return;
        expect(result.data.model).toMatchObject({status: "VOTING", archived: false, daoName: "Stakers club", daoType: "DAO_TYPE_STAKE"});
        expect(result.data.model.outcome).toMatchObject({settledHeight: 2000});
        expect(result.data.weightDenom).toBe("ubze");
        expect(result.data.scanFailed).toBe(false);
    });

    it("renders from the chain when Scan is down, with the denom read from the electorate", async () => {
        const d = deps({}, {detail: DOWN});
        const result = await loadProposal(d, "7");
        if (result.state !== "ok") throw new Error("not ok");
        expect(result.data.scanFailed).toBe(true);
        expect(result.data.model.outcome).toBeNull();
        expect(result.data.weightDenom).toBe("ubze");
        expect(d.chain.getStakingDenom).toHaveBeenCalledWith(PROPOSAL.pinned_electorate);
    });

    it("a static-list DAO has no weight denom", async () => {
        const staticDao = {...DAO, type: "DAO_TYPE_STATIC_LIST"} as Dao;
        const result = await loadProposal(deps({getDao: async () => staticDao}, {detail: async () => ({...SCAN, weight_denom: null})}), "7");
        if (result.state !== "ok") throw new Error("not ok");
        expect(result.data.weightDenom).toBeNull();
    });

    it("a chain 404 is the archived proposal, read from Scan alone", async () => {
        const d = deps({getProposal: async () => null}, {detail: async () => ({...SCAN, cleaned_height: 9000})});
        const result = await loadProposal(d, "7");
        if (result.state !== "ok") throw new Error("not ok");
        expect(result.data.model).toMatchObject({archived: true, status: "EXECUTED", daoName: "Stakers club"});
        expect(result.data.model.outcome?.cleanedHeight).toBe(9000);
    });

    it("both sides missing, a placeholder row, or a bad id is not found", async () => {
        expect((await loadProposal(deps({getProposal: async () => null}, {detail: async () => null}), "7")).state).toBe("not-found");
        expect((await loadProposal(deps({getProposal: async () => null}, {detail: async () => ({...SCAN, status: null})}), "7")).state).toBe("not-found");
        const d = deps();
        expect((await loadProposal(d, "abc")).state).toBe("not-found");
        expect(d.chain.getProposal).not.toHaveBeenCalled();
    });

    it("a chain miss with Scan down cannot be told from 'never existed': it throws so the page can retry", async () => {
        await expect(loadProposal(deps({getProposal: async () => null}, {detail: DOWN}), "7")).rejects.toBeInstanceOf(ScanUnavailableError);
    });

    it("a v8.2.x node is unsupported; another chain failure is thrown", async () => {
        expect((await loadProposal(deps({getProposal: async () => { throw new DaoModuleUnsupported(); }}), "7")).state).toBe("unsupported");
        await expect(loadProposal(deps({getProposal: async () => { throw new Error("boom"); }}), "7")).rejects.toThrow("boom");
    });
});

describe("refreshProposal", () => {
    it("re-reads the chain's answer and keeps what Scan added", async () => {
        const first = await loadProposal(deps(), "7");
        if (first.state !== "ok") throw new Error("not ok");
        const d = deps({getProposal: async () => ({...RESPONSE, voting_ended: true, proposal: {...PROPOSAL, yes: "999"}})});
        const next = await refreshProposal(d, first.data);
        expect(next.model).toMatchObject({votingEnded: true, tally: {yes: "999"}});
        expect(next.model.outcome).toMatchObject({settledHeight: 2000});
    });

    it("keeps the data when the read fails or the proposal is gone, and never polls an archived one", async () => {
        const first = await loadProposal(deps(), "7");
        if (first.state !== "ok") throw new Error("not ok");
        expect(await refreshProposal(deps({getProposal: async () => { throw new Error("x"); }}), first.data)).toBe(first.data);
        expect(await refreshProposal(deps({getProposal: async () => null}), first.data)).toBe(first.data);
        const archived = {...first.data, model: {...first.data.model, archived: true}};
        const d = deps();
        expect(await refreshProposal(d, archived)).toBe(archived);
        expect(d.chain.getProposal).not.toHaveBeenCalled();
    });
});

describe("loadVotes", () => {
    const vote = (voter: string, option: string, weight = "10", effective = weight) => ({voter, voter_label: null, option, weight, effective_weight: effective, height: 1, tx_hash: "AB", time: "2026-11-01T00:00:00Z"});

    it("reads Scan's page with the option filter and keeps its cursor", async () => {
        const votes = vi.fn(async () => ({items: [vote("bze1a", "yes", "10", "7"), vote("bze1b", "weird")], next_cursor: "n2", weight_denom: null}));
        const page = await loadVotes(deps({}, {votes}), "7", "YES", null);
        expect(votes).toHaveBeenCalledWith("7", "yes", null, 20);
        expect(page).toMatchObject({source: "scan", next: {source: "scan", key: "n2"}, rows: [{voter: "bze1a", option: "YES", weight: "10", effectiveWeight: "7"}]});
        expect(page.rows).toHaveLength(1);
    });

    it("with Scan down falls back to the chain's ballots and filters the page", async () => {
        const ballots: DaoBallot[] = [
            {proposal_id: "7", voter: "bze1a", option: "YES", weight: "5", shares: []},
            {proposal_id: "7", voter: "bze1b", option: "NO", weight: "6", shares: []},
        ];
        const d = deps({getBallots: vi.fn(async () => ({items: ballots, nextKey: "k2"}))}, {votes: DOWN});
        const page = await loadVotes(d, "7", "NO", null);
        expect(page).toMatchObject({source: "chain", next: {source: "chain", key: "k2"}, rows: [{voter: "bze1b", option: "NO", weight: "6", effectiveWeight: "6"}]});
    });

    it("a chain cursor stays on the chain; a Scan cursor that fails is an error, not a silent switch", async () => {
        const votes = vi.fn(DOWN);
        const d = deps({}, {votes});
        await loadVotes(d, "7", null, {source: "chain", key: "k2"});
        expect(votes).not.toHaveBeenCalled();
        expect(d.chain.getBallots).toHaveBeenCalledWith("7", {key: "k2", limit: 20});
        await expect(loadVotes(d, "7", null, {source: "scan", key: "n2"})).rejects.toBeInstanceOf(ScanUnavailableError);
    });

    it("a cleaned-up proposal Scan knows no votes of lists none", async () => {
        const page = await loadVotes(deps({}, {votes: async () => null}), "7", null, null);
        expect(page.rows).toEqual([]);
    });
});

describe("loadMyVote", () => {
    const model = {id: "7", daoId: "4", status: "VOTING" as const};
    const ballot: DaoBallot = {proposal_id: "7", voter: "bze1me", option: "YES", weight: "5", shares: [{source: "sr/17", amount: "5"}]};

    it("the ballot and the weight a vote would count on this proposal", async () => {
        const d = deps({getBallot: async () => ballot, getVotingPower: async () => ({current: "9", proposals: [{proposal_id: "8", eligible_weight: "1", shares: []}, {proposal_id: "7", eligible_weight: "0", shares: []}]})});
        expect(await loadMyVote(d, model, "bze1me")).toEqual({ballot, eligibleWeight: "0"});
    });

    it("no ballot is null; no weight is read once the proposal is not voting; a failed read leaves them unknown", async () => {
        const d = deps();
        expect(await loadMyVote(d, {...model, status: "EXECUTED"}, "bze1me")).toEqual({ballot: null, eligibleWeight: null});
        expect(d.chain.getVotingPower).not.toHaveBeenCalled();
        const failing = deps({getBallot: async () => { throw new Error("x"); }, getVotingPower: async () => { throw new Error("y"); }});
        expect(await loadMyVote(failing, model, "bze1me")).toEqual({ballot: null, eligibleWeight: null});
    });
});

describe("a DAO's proposals", () => {
    const item = (id: number, status: string | null, title: string | null = `P${id}`): ScanProposalSummary => ({
        id, dao_id: 4, title, status, proposer: "bze1p", proposer_label: null, expedited: false, submit_time: null, voting_end: null,
        yes: "0", no: "0", abstain: "0", denominator: "10", settled_height: null, message_types: [],
    });

    it("active: voting and failed executions, read as two requests and merged newest first", async () => {
        const listForDao = vi.fn(async (_dao: string, status: string | null) =>
            ({items: status === "voting" ? [item(9, "voting"), item(5, "voting")] : [item(7, "execution_failed")], next_cursor: null}));
        const result = await loadActiveProposals(deps({}, {listForDao}), "4");
        expect(result.source).toBe("scan");
        expect(result.rows.map((r) => r.id)).toEqual(["9", "7", "5"]);
        expect(listForDao).toHaveBeenCalledWith("4", "voting", null, 50);
        expect(listForDao).toHaveBeenCalledWith("4", "execution_failed", null, 50);
    });

    it("active with Scan down: the chain lists both statuses at once, newest first", async () => {
        const getDaoProposals = vi.fn(async () => ({items: [{...PROPOSAL, id: "3"}, {...PROPOSAL, id: "6", status: "EXECUTION_FAILED" as const}], nextKey: null}));
        const result = await loadActiveProposals(deps({getDaoProposals}, {listForDao: DOWN}), "4");
        expect(result.source).toBe("chain");
        expect(result.rows.map((r) => r.id)).toEqual(["6", "3"]);
        expect(getDaoProposals).toHaveBeenCalledWith("4", ["VOTING", "EXECUTION_FAILED"], {limit: 50, reverse: true});
    });

    it("finished: leaves out the moving and placeholder rows and keeps reading until it has enough", async () => {
        const pages = [
            {items: [item(9, "voting"), item(8, "execution_failed"), item(7, null)], next_cursor: "c2"},
            {items: [item(6, "rejected"), item(5, "executed")], next_cursor: null},
        ];
        const listForDao = vi.fn(async () => pages.shift()!);
        const result = await loadFinishedProposals(deps({}, {listForDao}), "4", null);
        expect(result.rows.map((r) => r.id)).toEqual(["6", "5"]);
        expect(result.next).toBeNull();
        expect(listForDao).toHaveBeenNthCalledWith(1, "4", null, null, 20);
        expect(listForDao).toHaveBeenNthCalledWith(2, "4", null, "c2", 20);
    });

    it("finished throws when Scan is down (the tab shows a retry)", async () => {
        await expect(loadFinishedProposals(deps({}, {listForDao: DOWN}), "4", null)).rejects.toBeInstanceOf(ScanUnavailableError);
    });
});

// the pinned config is what the page draws its bars from
it("the fixture's pinned config is the one on the model", async () => {
    const result = await loadProposal(deps(), "7");
    expect(result.state === "ok" && result.data.model.config).toEqual(CONFIG);
});
