import {describe, expect, it, vi} from "vitest";
import type {DaoBallot, Dao} from "@bze/bze-ui-kit";
import {ScanUnavailableError} from "./dao-scan";
import type {DaoProposalScan} from "./dao-proposal-scan";
import {DaoModuleUnsupported} from "./dao-view-loader";
import {
    loadDaoRefs, loadMyVote, loadProposal, loadVotesPage, notCountedLine, refreshProposal,
    type ProposalChain, type ProposalDeps,
} from "./proposal-loader";
import {CONFIG, PROPOSAL, RESPONSE, SCAN} from "@/test/proposal-fixtures";

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
    getStakes: vi.fn(async () => []),
    getJoinHeight: vi.fn(async () => null),
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

    it("reads Scan again when the status changed, so the settle and the deposit release appear without a reload", async () => {
        const detail = vi.fn(async () => (detail.mock.calls.length === 1 ? {...SCAN, status: "voting", settled_height: null, deposit_refunded: null} : SCAN));
        const first = await loadProposal(deps({}, {detail}), "7");
        if (first.state !== "ok") throw new Error("not ok");
        expect(first.data.model.outcome?.settledHeight).toBeNull();

        const d = deps({getProposal: async () => ({...RESPONSE, proposal: {...PROPOSAL, status: "EXECUTED" as const}})}, {detail});
        const next = await refreshProposal(d, first.data);
        expect(detail).toHaveBeenCalledTimes(2);
        expect(next.model.outcome).toMatchObject({settledHeight: 2000, depositRefunded: true});
        expect(next.scanFailed).toBe(false);
    });

    it("does not ask Scan again while the status is the same, and keeps the old Scan data when the refresh fails", async () => {
        const first = await loadProposal(deps(), "7");
        if (first.state !== "ok") throw new Error("not ok");
        const detail = vi.fn(DOWN);
        await refreshProposal(deps({}, {detail}), first.data);
        expect(detail).not.toHaveBeenCalled();
        const changed = deps({getProposal: async () => ({...RESPONSE, proposal: {...PROPOSAL, status: "REJECTED" as const}})}, {detail});
        const next = await refreshProposal(changed, first.data);
        expect(next.model.status).toBe("REJECTED");
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

describe("loadDaoRefs", () => {
    it("the name and account of each DAO the actions name; a DAO the chain lacks or fails to read is left out", async () => {
        const getDao = vi.fn(async (id: string) => {
            if (id === "12") return {...DAO, id: "12", name: "Garden club", address: "bze1garden"} as Dao;
            if (id === "13") throw new Error("down");
            return null;
        });
        expect(await loadDaoRefs(deps({getDao}), ["12", "13", "14"])).toEqual({"12": {name: "Garden club", address: "bze1garden"}});
        expect(getDao).toHaveBeenCalledTimes(3);
    });

    it("a DAO without a name keeps its account", async () => {
        const d = deps({getDao: async () => ({...DAO, name: "", address: "bze1garden"}) as Dao});
        expect(await loadDaoRefs(d, ["12"])).toEqual({"12": {name: undefined, address: "bze1garden"}});
    });
});

describe("loadVotesPage", () => {
    const vote = (voter: string, option: string, weight = "10", effective = weight) => ({voter, voter_label: null, option, weight, effective_weight: effective, height: 1, tx_hash: "AB", time: "2026-11-01T00:00:00Z"});
    const first = {page: 1};

    it("reads Scan's numbered page with the option filter, its total and the ballots per option", async () => {
        const votes = vi.fn(async () => ({items: [vote("bze1a", "yes", "10", "7"), vote("bze1b", "weird")], next_cursor: null, weight_denom: null, total: 214, option_counts: {yes: 150, no: 50, abstain: 14}}));
        const page = await loadVotesPage(deps({}, {votes}), "7", "YES", {page: 3});
        expect(votes).toHaveBeenCalledWith("7", {option: "yes", page: 3, limit: 20});
        expect(page).toMatchObject({state: "ok", source: "scan", mode: "pages", total: 214, next: null, returned: 2, counts: {yes: 150, no: 50, abstain: 14}});
        expect(page.items).toEqual([expect.objectContaining({voter: "bze1a", option: "YES", weight: "10", effectiveWeight: "7"})]);
    });

    it("never reads next_cursor in page mode", async () => {
        const votes = vi.fn(async () => ({items: [], next_cursor: "stray", weight_denom: null, total: 0, option_counts: {yes: 0, no: 0, abstain: 0}}));
        expect((await loadVotesPage(deps({}, {votes}), "7", null, first)).next).toBeNull();
    });

    it("an older Scan without a total is read by cursor from then on (Prev / Next), without counts", async () => {
        const votes = vi.fn(async () => ({items: [vote("bze1a", "no")], next_cursor: "n2", weight_denom: null}));
        const d = deps({}, {votes});
        const page = await loadVotesPage(d, "7", null, first);
        expect(page).toMatchObject({mode: "cursor", total: null, next: "n2", counts: null});
        await loadVotesPage(d, "7", null, {page: 2, cursor: "n2", source: "scan"});
        expect(votes).toHaveBeenLastCalledWith("7", {option: null, cursor: "n2", limit: 20});
    });

    it("a proposal Scan does not know lists none, and does not mark the client as one without totals", async () => {
        const votes = vi.fn(async () => null);
        const d = deps({}, {votes});
        expect((await loadVotesPage(d, "7", null, first)).items).toEqual([]);
        await loadVotesPage(d, "7", null, first);
        expect(votes).toHaveBeenLastCalledWith("7", {option: null, page: 1, limit: 20});
    });

    it("with Scan down the first page falls back to the chain's ballots (by key, no names) and filters them", async () => {
        const ballots: DaoBallot[] = [
            {proposal_id: "7", voter: "bze1a", option: "YES", weight: "5", shares: []},
            {proposal_id: "7", voter: "bze1b", option: "NO", weight: "6", shares: []},
        ];
        const d = deps({getBallots: vi.fn(async () => ({items: ballots, nextKey: "k2"}))}, {votes: DOWN});
        const page = await loadVotesPage(d, "7", "NO", first);
        expect(page).toMatchObject({source: "chain", mode: "cursor", total: null, next: "k2", counts: null});
        expect(page.items).toEqual([{voter: "bze1b", name: null, option: "NO", weight: "6", effectiveWeight: "6", time: null, txHash: null}]);
    });

    it("with Scan down the chain filter keeps paging past pages it empties, and says there is more when it stops", async () => {
        const mk = (voter: string, option: "YES" | "NO"): DaoBallot => ({proposal_id: "7", voter, option, weight: "1", shares: []});
        const pages = [
            {items: [mk("a", "YES"), mk("b", "YES")], nextKey: "k2"},
            {items: [mk("c", "YES")], nextKey: "k3"},
            {items: [mk("d", "NO")], nextKey: "k4"},
        ];
        const getBallots = vi.fn(async () => pages.shift()!);
        const page = await loadVotesPage(deps({getBallots}, {votes: DOWN}), "7", "NO", first);
        expect(getBallots).toHaveBeenCalledTimes(3);
        expect(page.items.map((r) => r.voter)).toEqual(["d"]);
        expect(page.next).toBe("k4");

        const endless = vi.fn(async () => ({items: [mk("x", "YES")], nextKey: "more"}));
        const empty = await loadVotesPage(deps({getBallots: endless}, {votes: DOWN}), "7", "NO", first);
        expect(empty.items).toEqual([]);
        expect(empty.next).not.toBeNull();
    });

    it("a list that started on the chain stays there; a later Scan page that fails is an error, never the chain's first page", async () => {
        const votes = vi.fn(DOWN);
        const d = deps({}, {votes});
        await loadVotesPage(d, "7", null, {page: 2, cursor: "k2", source: "chain"});
        expect(votes).not.toHaveBeenCalled();
        expect(d.chain.getBallots).toHaveBeenCalledWith("7", {key: "k2", limit: 20});
        await expect(loadVotesPage(d, "7", null, {page: 2, source: "scan"})).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(loadVotesPage(d, "7", null, {page: 2, cursor: "n2", source: "scan"})).rejects.toBeInstanceOf(ScanUnavailableError);
        expect(d.chain.getBallots).toHaveBeenCalledTimes(1);
    });
});

describe("loadMyVote", () => {
    const model = {id: "7", daoId: "4", status: "VOTING" as const, daoType: "DAO_TYPE_STATIC_LIST", electorate: null, submitHeight: "100"};
    const ballot: DaoBallot = {proposal_id: "7", voter: "bze1me", option: "YES", weight: "5", shares: [{source: "sr/17", amount: "5"}]};

    it("the ballot and the weight a vote would count on this proposal", async () => {
        const d = deps({getBallot: async () => ballot, getVotingPower: async () => ({current: "9", proposals: [{proposal_id: "8", eligible_weight: "1", shares: []}, {proposal_id: "7", eligible_weight: "0", shares: []}]})});
        expect(await loadMyVote(d, model, "bze1me")).toEqual({ballot, eligibleWeight: "0", notCounted: []});
        expect(d.chain.getStakes).not.toHaveBeenCalled();
    });

    it("no ballot is null; no weight is read once the proposal is not voting", async () => {
        const d = deps();
        expect(await loadMyVote(d, {...model, status: "EXECUTED"}, "bze1me")).toEqual({ballot: null, eligibleWeight: null, notCounted: []});
        expect(d.chain.getVotingPower).not.toHaveBeenCalled();
    });

    it("a failed ballot read is an error, never read as 'not voted'", async () => {
        await expect(loadMyVote(deps({getBallot: async () => { throw new Error("x"); }}), model, "bze1me")).rejects.toThrow("x");
    });

    it("a failed voting-power read only leaves the weight unknown", async () => {
        const d = deps({getVotingPower: async () => { throw new Error("y"); }});
        expect(await loadMyVote(d, model, "bze1me")).toEqual({ballot: null, eligibleWeight: null, notCounted: []});
    });

    describe("the stake that does not count", () => {
        const stake = {...model, daoType: "DAO_TYPE_STAKE", electorate: {sr_ids: ["17", "18"], dr_denom: "uhoney"}};
        const power = {current: "0", proposals: [{proposal_id: "7", eligible_weight: "300", shares: [{source: "sr/17", amount: "300"}]}]};
        const stakes = [{source: "sr/17", amount: "1000"}, {source: "sr/18", amount: "50"}, {source: "dr/uhoney", amount: "40"}, {source: "sr/99", amount: "5"}];

        it("is the stake in each pinned source minus the shares counted for it, where the wallet joined at or after the submit block", async () => {
            const heights: Record<string, string | null> = {"sr/17": "150", "sr/18": "100", "dr/uhoney": "99"};
            const getJoinHeight = vi.fn(async (source: string) => heights[source] ?? null);
            const d = deps({getVotingPower: async () => power, getStakes: async () => stakes, getJoinHeight});
            const mine = await loadMyVote(d, stake, "bze1me");
            // sr/17: 1000 held, 300 counted, joined above the submit block; sr/18 joined in it (the chain's >=); dr/uhoney before it
            expect(mine.notCounted).toEqual([{source: "sr/17", amount: "700"}, {source: "sr/18", amount: "50"}]);
            expect(getJoinHeight).toHaveBeenCalledWith("sr/17", "bze1me");
            // a source outside the pinned electorate is never asked about
            expect(getJoinHeight).not.toHaveBeenCalledWith("sr/99", "bze1me");
        });

        it("joined below the submit block, or without a join record, counts: no line", async () => {
            const d = deps({getVotingPower: async () => power, getStakes: async () => stakes, getJoinHeight: async (source) => (source === "sr/17" ? "42" : null)});
            expect((await loadMyVote(d, stake, "bze1me")).notCounted).toEqual([]);
        });

        it("stake that is fully counted asks for no join record", async () => {
            const getJoinHeight = vi.fn(async () => "500");
            const d = deps({getVotingPower: async () => power, getStakes: async () => [{source: "sr/17", amount: "300"}], getJoinHeight});
            expect((await loadMyVote(d, stake, "bze1me")).notCounted).toEqual([]);
            expect(getJoinHeight).not.toHaveBeenCalled();
        });

        it("a read that fails leaves the list empty and the rest of the vote intact", async () => {
            const d = deps({getVotingPower: async () => power, getStakes: async () => { throw new Error("down"); }});
            expect(await loadMyVote(d, stake, "bze1me")).toEqual({ballot: null, eligibleWeight: "300", notCounted: []});
            const e = deps({getVotingPower: async () => power, getStakes: async () => stakes, getJoinHeight: async () => { throw new Error("down"); }});
            expect((await loadMyVote(e, stake, "bze1me")).notCounted).toEqual([]);
        });
    });

    it("the line says the wallet joined or added to the source", () => {
        expect(notCountedLine("12,000 HONEY", "Staking reward 12")).toBe("12,000 HONEY in Staking reward 12 doesn't count: you joined or added to it after this proposal started.");
    });
});

// the pinned config is what the page draws its bars from
it("the fixture's pinned config is the one on the model", async () => {
    const result = await loadProposal(deps(), "7");
    expect(result.state === "ok" && result.data.model.config).toEqual(CONFIG);
});
