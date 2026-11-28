import {describe, expect, it} from "vitest";
import type {DaoBallot, DaoProposalStatus} from "@bze/bze-ui-kit";
import {modelFromChain, type ProposalModel} from "./proposal-model";
import {
    cancelNotice, gasState, proposalActions, settleKind, yesVoteMeetsExpediteBars,
    type ActionInput, type GasState, type MyVoteState,
} from "./proposal-actions";
import {CONFIG, PROPOSAL, RESPONSE} from "@/test/proposal-fixtures";

const NOW = Date.parse("2026-11-26T12:00:00Z");
const PROPOSER = "bze1proposer";
const OK: GasState = {state: "ok"};

const model = (over: {status?: DaoProposalStatus; ended?: boolean; settleable?: boolean; retry?: string; expedited?: boolean; type?: string; yes?: string; no?: string; abstain?: string; denominator?: string; submit?: string} = {}): ProposalModel =>
    modelFromChain(
        {
            ...RESPONSE,
            voting_ended: over.ended ?? false,
            expedite_settleable: over.settleable ?? false,
            retry_deadline: over.retry ?? "0",
            proposal: {
                ...PROPOSAL,
                status: over.status ?? "VOTING",
                expedited: over.expedited ?? false,
                yes: over.yes ?? PROPOSAL.yes,
                no: over.no ?? PROPOSAL.no,
                abstain: over.abstain ?? PROPOSAL.abstain,
                pinned_denominator: over.denominator ?? PROPOSAL.pinned_denominator,
                submit_time: over.submit ?? PROPOSAL.submit_time,
            },
        },
        null,
        "Club",
        over.type ?? "DAO_TYPE_STATIC_LIST",
    );

const ballot = (option: DaoBallot["option"], weight = "1"): DaoBallot => ({proposal_id: "7", voter: "bze1me", option, weight, shares: []});
const mine = (eligibleWeight: string | null, b: DaoBallot | null = null): MyVoteState => ({state: "ok", ballot: b, eligibleWeight});

const input = (over: Partial<ActionInput> & {model: ProposalModel}): ActionInput => ({
    wallet: "bze1me", myVote: mine("1"), params: {min_expedite_delay: "86400s"}, gas: OK, nowMs: NOW, ...over,
});

const STATUSES: DaoProposalStatus[] = ["VOTING", "REJECTED", "EXECUTED", "EXECUTION_FAILED", "EXPIRED", "CANCELLED"];
const ROLES = {
    proposer: {wallet: PROPOSER, myVote: mine("1")},
    voter: {wallet: "bze1me", myVote: mine("1")},
    zeroWeight: {wallet: "bze1me", myVote: mine("0")},
    stranger: {wallet: "bze1nobody", myVote: mine("0")},
    disconnected: {wallet: null, myVote: mine(null)},
} as const;

describe("which actions are offered (status x voting_ended x expedite_settleable x role)", () => {
    for (const status of STATUSES) {
        for (const ended of [false, true]) {
            for (const settleable of [false, true]) {
                for (const [role, who] of Object.entries(ROLES)) {
                    it(`${status}, ended=${ended}, settleable=${settleable}, ${role}`, () => {
                        const view = proposalActions(input({model: model({status, ended, settleable}), ...who}));
                        const voting = status === "VOTING";
                        const connected = who.wallet !== null;
                        const canVote = connected && who.myVote.eligibleWeight === "1";

                        // vote: only while voting and before the end; enabled for a wallet with weight
                        expect(view.vote !== null).toBe(voting && !ended);
                        if (view.vote) expect(view.vote.enabled).toBe(canVote);

                        // settle: from the chain's flags (or a failed execution), for anyone who can sign
                        const settlable = (voting && (ended || settleable)) || status === "EXECUTION_FAILED";
                        expect(view.settle !== null).toBe(settlable);
                        if (view.settle) expect(view.settle.enabled).toBe(connected);

                        // cancel: the proposer only, while voting and before the end
                        expect(view.cancel !== null).toBe(voting && !ended && role === "proposer");

                        // clean up: finished proposals only
                        expect(view.cleanup !== null).toBe(["REJECTED", "EXECUTED", "EXPIRED", "CANCELLED"].includes(status));
                        if (view.cleanup) expect(view.cleanup.enabled).toBe(connected);
                    });
                }
            }
        }
    }

    it("offers nothing on an archived proposal", () => {
        const archived = {...model({status: "EXECUTED"}), archived: true};
        const view = proposalActions(input({model: archived}));
        expect(view).toEqual({vote: null, voteAndSettle: null, settle: null, cancel: null, cleanup: null});
    });

    it("the proposer is matched whatever the letter case of the address", () => {
        expect(proposalActions(input({model: model(), wallet: "BZE1PROPOSER"})).cancel).not.toBeNull();
    });
});

describe("reading failures are never 'no power'", () => {
    it("a ballot read that failed disables the vote and says it could not be read", () => {
        const view = proposalActions(input({model: model(), myVote: {state: "failed"}}));
        expect(view.vote?.enabled).toBe(false);
        expect(view.vote?.reason).toMatch(/could not be read/);
    });

    it("an eligible weight that could not be read (null) is not zero", () => {
        const view = proposalActions(input({model: model(), myVote: mine(null)}));
        expect(view.vote?.reason).toMatch(/could not be read/);
        expect(view.vote?.reason).not.toMatch(/count 0/);
    });

    it("a wallet with weight 0 gets the reason of its DAO type", () => {
        expect(proposalActions(input({model: model(), myVote: mine("0")})).vote?.reason).toMatch(/not a member/);
        expect(proposalActions(input({model: model({type: "DAO_TYPE_STAKE"}), myVote: mine("0")})).vote?.reason).toMatch(/you joined or added to your stake after/);
    });

    it("still loading is a reason, not a verdict", () => {
        expect(proposalActions(input({model: model(), myVote: {state: "loading"}})).vote?.reason).toMatch(/Reading/);
    });
});

describe("gas", () => {
    it("a wallet with nothing to pay the fee with is blocked everywhere, with the reason", () => {
        const none = gasState({loading: false, nativeEmpty: true, feeTokenEmpty: true});
        const view = proposalActions(input({model: model({ended: true}), gas: none}));
        expect(view.vote).toBeNull();
        expect(view.settle).toMatchObject({enabled: false, reason: "Your wallet has no balance to pay the network fee."});
        const done = proposalActions(input({model: model({status: "EXECUTED"}), gas: none}));
        expect(done.cleanup?.enabled).toBe(false);
    });

    it("an empty native balance is fine when the fee token has funds, and loading is not zero", () => {
        expect(gasState({loading: false, nativeEmpty: true, feeTokenEmpty: false})).toEqual({state: "ok"});
        expect(gasState({loading: true, nativeEmpty: true, feeTokenEmpty: true})).toEqual({state: "loading"});
        expect(proposalActions(input({model: model({ended: true}), gas: {state: "loading"}})).settle?.reason).toMatch(/Reading your balance/);
    });
});

describe("revote", () => {
    it("marks the current option and refuses the same one, while the others stay open", () => {
        const view = proposalActions(input({model: model(), myVote: mine("1", ballot("NO"))}));
        expect(view.vote?.current).toBe("NO");
        expect(view.vote?.options.map((o) => [o.option, o.disabled])).toEqual([["YES", false], ["NO", true], ["ABSTAIN", false]]);
    });

    it("a ballot zeroed by a member removal can be cast again with the same option", () => {
        const view = proposalActions(input({model: model(), myVote: mine("1", ballot("NO", "0"))}));
        expect(view.vote?.options.find((o) => o.option === "NO")?.disabled).toBe(false);
    });
});

// 1000 total weight; expedite bars: turnout >= 60% and yes MORE than 70% of the whole
describe("vote and settle at the bar boundary", () => {
    const offered = (over: Parameters<typeof model>[0], weight: string, b: DaoBallot | null = null, extra: Partial<ActionInput> = {}) =>
        proposalActions(input({model: model({expedited: true, ...over}), myVote: mine(weight, b), ...extra})).voteAndSettle !== null;

    it("exactly at the yes threshold does not trigger, one unit above does", () => {
        // turnout 600 already; yes 690 + 10 = 700 is not MORE than 70%; 690 + 11 = 701 is
        const base = {yes: "690", no: "0", abstain: "0"};
        expect(offered({...base, no: "0"}, "10")).toBe(false);
        expect(offered({...base}, "11")).toBe(true);
    });

    it("turnout landing exactly on the expedite quorum triggers, because the quorum is inclusive", () => {
        // a proposal whose bars make the quorum the binding one: quorum 60%, yes must exceed 20% of 1000
        const bars = {...CONFIG, expedite_quorum: "0.600000000000000000", expedite_threshold: "0.200000000000000000"};
        const make = (weight: string) => proposalActions(input({
            model: {...model({expedited: true, yes: "300", no: "100", abstain: "100"}), config: bars},
            myVote: mine(weight),
        })).voteAndSettle !== null;
        // turnout 500 + weight: 599 is one short of 600, 100 lands exactly on it
        expect(make("99")).toBe(false);
        expect(make("100")).toBe(true);
    });

    it("the boundary follows the whole weight of the DAO, not the votes cast", () => {
        // 2000 in all: 70% is 1400. yes 1000 + 400 is exactly 70%, one more is above it
        const big = {yes: "1000", no: "0", abstain: "0", denominator: "2000"};
        expect(offered(big, "400")).toBe(false);
        expect(offered(big, "401")).toBe(true);
        expect(offered({yes: "300", no: "0", abstain: "0"}, "400")).toBe(false);
        expect(offered({yes: "300", no: "0", abstain: "0"}, "401")).toBe(true);
    });

    it("an existing ballot is taken out first: a NO of weight w becomes a YES of w", () => {
        // yes 690, no 11: my NO (11) is replaced by YES (11): yes 701
        expect(offered({yes: "690", no: "11", abstain: "0"}, "11", ballot("NO", "11"))).toBe(true);
        // without the subtraction yes would be 701 too, but the no-weight must leave the tally: abstain case
        // yes 600, abstain 100 (mine): replaced by YES 100 -> yes 700, not more than 70%
        expect(offered({yes: "600", no: "0", abstain: "100"}, "100", ballot("ABSTAIN", "100"))).toBe(false);
        expect(offered({yes: "600", no: "0", abstain: "100"}, "101", ballot("ABSTAIN", "100"))).toBe(true);
    });

    it("a revote counts at the current weight, not the weight of the old ballot", () => {
        // old NO of 5, weight now 20: yes 690 + 20 = 710
        expect(offered({yes: "690", no: "5", abstain: "0"}, "20", ballot("NO", "5"))).toBe(true);
    });

    it("is not offered for a regular proposal, once the early settle is already open, or after a weighted YES", () => {
        expect(offered({expedited: false, yes: "690"}, "11")).toBe(false);
        expect(offered({yes: "690", settleable: true}, "11")).toBe(false);
        expect(offered({yes: "690"}, "11", ballot("YES", "5"))).toBe(false);
        expect(offered({yes: "690", ended: true}, "11")).toBe(false);
    });

    it("a stake DAO waits for min_expedite_delay after submission, a static list does not", () => {
        const submit = String(Math.floor(NOW / 1000) - 3600); // an hour ago, the delay is 24h
        const stake = {type: "DAO_TYPE_STAKE", yes: "690", no: "0", abstain: "0", submit};
        expect(offered(stake, "11")).toBe(false);
        expect(offered({...stake, submit: String(Math.floor(NOW / 1000) - 86_400)}, "11")).toBe(true);
        expect(offered({...stake, type: "DAO_TYPE_STATIC_LIST"}, "11")).toBe(true);
    });

    it("a stake DAO whose params could not be read is not offered it", () => {
        const submit = String(Math.floor(NOW / 1000) - 200_000);
        expect(offered({type: "DAO_TYPE_STAKE", yes: "690", submit}, "11", null, {params: null})).toBe(false);
    });

    it("is disabled with the vote's reason when the wallet cannot sign", () => {
        const view = proposalActions(input({model: model({expedited: true, yes: "690"}), myVote: mine("11"), gas: {state: "none", reason: "no gas"}}));
        expect(view.voteAndSettle).toEqual({weight: "11", enabled: false, reason: "no gas"});
    });

    it("yesVoteMeetsExpediteBars is false without rules, a tally or a numeric weight", () => {
        const m = model({expedited: true, yes: "690"});
        expect(yesVoteMeetsExpediteBars({config: null, tally: m.tally}, null, "11")).toBe(false);
        expect(yesVoteMeetsExpediteBars({config: m.config, tally: null}, null, "11")).toBe(false);
        expect(yesVoteMeetsExpediteBars(m, null, "x")).toBe(false);
        expect(yesVoteMeetsExpediteBars({config: {...CONFIG, expedite_quorum: "bad"}, tally: m.tally}, null, "11")).toBe(false);
    });
});

describe("settle, retry and mark expired", () => {
    const deadline = (offsetSeconds: number) => String(Math.floor(NOW / 1000) + offsetSeconds);

    it("a failed execution is a retry before the deadline and 'Mark expired' from it on", () => {
        const failed = (offset: number) => model({status: "EXECUTION_FAILED", retry: deadline(offset)});
        expect(proposalActions(input({model: failed(1)})).settle).toMatchObject({kind: "retry", label: "Retry"});
        expect(proposalActions(input({model: failed(0)})).settle).toMatchObject({kind: "expire", label: "Mark expired"});
        expect(proposalActions(input({model: failed(-60)})).settle).toMatchObject({kind: "expire", label: "Mark expired"});
        expect(settleKind(failed(60), NOW)).toBe("retry");
    });

    it("a failed execution with an unknown deadline is offered as a retry", () => {
        expect(settleKind(model({status: "EXECUTION_FAILED"}), NOW)).toBe("retry");
    });

    it("tells the outcome from the tally on the pinned rules before signing", () => {
        const passes = proposalActions(input({model: model({ended: true, yes: "300", no: "100", abstain: "50"})})).settle;
        expect(passes).toMatchObject({kind: "settle", outcome: "pass", label: "Settle"});
        expect(passes?.note).toMatch(/passes/);

        const rejects = proposalActions(input({model: model({ended: true, yes: "100", no: "300"})})).settle;
        expect(rejects).toMatchObject({outcome: "reject"});
        expect(rejects?.note).toMatch(/rejected/);

        const noQuorum = proposalActions(input({model: model({ended: true, yes: "100", no: "0", abstain: "0"})})).settle;
        expect(noQuorum?.outcome).toBe("reject");
    });

    it("an early settle is a pass, and says its actions run in the same transaction", () => {
        const msgs = [{"@type": "/cosmos.bank.v1beta1.MsgSend"}];
        const m = {...model({expedited: true, settleable: true}), msgs};
        const view = proposalActions(input({model: m})).settle;
        expect(view).toMatchObject({kind: "early", outcome: "pass", label: "Settle now"});
        expect(view?.note).toMatch(/actions run in this transaction/);
    });

    it("without rules or a tally the chain decides", () => {
        const view = proposalActions(input({model: {...model({ended: true}), tally: null}})).settle;
        expect(view?.outcome).toBeNull();
        expect(view?.note).toMatch(/chain decides/);
    });
});

describe("cancelNotice", () => {
    const fmt = (c: {amount: string; denom: string}) => `${c.amount} ${c.denom}`;
    const deposit = {denom: "ubze", amount: "9000000"};

    it("refunds only under ALWAYS; otherwise the deposit goes where the pinned policy says", () => {
        expect(cancelNotice({...CONFIG, deposit_refund_policy: "ALWAYS"}, deposit, fmt)).toMatch(/is refunded/);
        expect(cancelNotice({...CONFIG, deposit_refund_policy: "ONLY_PASSED", kept_deposit_destination: "BURN"}, deposit, fmt)).toMatch(/not refunded.*burned/);
        expect(cancelNotice({...CONFIG, deposit_refund_policy: "NEVER", kept_deposit_destination: "TREASURY"}, deposit, fmt)).toMatch(/treasury/);
    });

    it("always says the proposal cost is not refunded, and admits unknown rules", () => {
        expect(cancelNotice({...CONFIG, deposit_refund_policy: "ALWAYS"}, deposit, fmt)).toMatch(/proposal cost is never refunded/);
        expect(cancelNotice(null, deposit, fmt)).toMatch(/could not be read/);
        expect(cancelNotice({...CONFIG, deposit_refund_policy: null}, deposit, fmt)).toMatch(/could not be read/);
        expect(cancelNotice(CONFIG, null, fmt)).toMatch(/no deposit/);
    });
});
