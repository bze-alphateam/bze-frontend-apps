import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao, DaoProposalMessage} from "@bze/bze-ui-kit";

const wallet = vi.hoisted(() => ({address: undefined as string | undefined}));

vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: wallet.address})}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    getChainName: () => "beezee",
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
    useSDKTx: () => ({tx: vi.fn(), progressTrack: ""}),
    useSettings: () => ({feeDenom: "ubze"}),
    useBalance: (denom: string) => ({balance: {denom, amount: new BigNumber(1000)}, isLoading: false, hasAmount: () => true}),
}));
vi.mock("@/lib/dao-chain", () => ({liveProposalDeps: {}}));

import type {DaoProposalScan} from "@/lib/dao-proposal-scan";
import type {ProposalChain, ProposalDeps} from "@/lib/proposal-loader";
import {PROPOSAL, RESPONSE, SCAN} from "@/test/proposal-fixtures";
import {ProposalPage} from "./proposal-page";

const ME = "bze1me";
const DAO_ADDRESS = "bze1daoaccountxxxxxxxxxxxxxxxxxxxxxxxx4dao";
const DAO = {id: "4", name: "Stakers club", type: "DAO_TYPE_STAKE", address: DAO_ADDRESS, electorate: {sr_ids: ["000000000017"], dr_denom: ""}} as unknown as Dao;
const SUB = {id: "12", name: "Garden club", type: "DAO_TYPE_STATIC_LIST", address: "bze1garden"} as unknown as Dao;
const MSGS: DaoProposalMessage[] = [
    {"@type": "/cosmos.bank.v1beta1.MsgSend", from_address: DAO_ADDRESS, to_address: "bze1desk", amount: [{denom: "ubze", amount: "50000000"}]},
    {"@type": "/bze.dao.MsgNominateAdmin", authority: DAO_ADDRESS, dao_id: "12", nominee: ""},
];
const PARAMS = {min_expedite_delay: "86400s", execution_window: "1209600s"};

function deps(chain: Partial<ProposalChain> = {}): ProposalDeps {
    const full: ProposalChain = {
        getProposal: vi.fn(async () => ({...RESPONSE, proposal: {...PROPOSAL, msgs: MSGS}})),
        getDao: vi.fn(async (id: string) => (id === "4" ? DAO : id === "12" ? SUB : null)),
        getParams: vi.fn(async () => PARAMS as never),
        getBallot: vi.fn(async () => null),
        getBallots: vi.fn(async () => ({items: [], nextKey: null})),
        getVotingPower: vi.fn(async () => ({current: "1000000", proposals: [{proposal_id: "7", eligible_weight: "0", shares: []}]})),
        getDaoProposals: vi.fn(async () => ({items: [], nextKey: null})),
        getStakingDenom: vi.fn(async () => "ubze"),
        getStakes: vi.fn(async () => [{source: "sr/000000000017", amount: "12000000"}]),
        getJoinHeight: vi.fn(async () => "150"),
        ...chain,
    };
    const scan: DaoProposalScan = {
        listForDao: vi.fn(),
        detail: vi.fn(async () => ({...SCAN, status: "voting", settled_height: null, executed: null})),
        votes: vi.fn(async () => ({items: [], next_cursor: null, weight_denom: null, total: 0, option_counts: {yes: 0, no: 0, abstain: 0}})),
    };
    return {chain: full, scan};
}

const renderPage = (d: ProposalDeps) =>
    render(
        <ChakraProvider value={defaultSystem}>
            <ProposalPage id="7" deps={d} />
        </ChakraProvider>,
    );

beforeEach(() => {
    wallet.address = undefined;
});

describe("ProposalPage", () => {
    it("the board's header: back link, number and status, the title, then In <DAO> · by · the clock · Explorer; no hero", async () => {
        renderPage(deps());
        const back = await screen.findByTestId("proposal-back");
        expect(back).toHaveTextContent("Stakers club · proposals");
        expect(back).toHaveAttribute("href", "/dao/4?tab=proposals");
        expect(screen.getByTestId("proposal-number")).toHaveTextContent("Proposal #7");
        expect(screen.getByTestId("proposal-status")).toHaveTextContent("Voting");
        expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Fund the festival");
        expect(screen.getByTestId("proposal-dao")).toHaveTextContent("In Stakers club");
        // the desktop meta line is hidden below md, which is jsdom's width
        expect(within(screen.getByTestId("proposal-dao")).getByRole("link", {hidden: true})).toHaveAttribute("href", "/dao/4?tab=proposals");
        expect(screen.getByTestId("proposal-proposer")).toHaveTextContent("by");
        expect(screen.getByTestId("proposal-ends")).toHaveTextContent(/^Voting ends/);
        expect(within(screen.getByTestId("proposal-explorer")).getByRole("link", {hidden: true})).toHaveAttribute("href", expect.stringMatching(/\/daos\/4\/proposals\/7$/));
        expect(screen.queryByTestId("page-hero")).toBeNull();
        // the phone line: the clock and the proposer only
        expect(screen.getByTestId("proposal-meta-phone")).toHaveTextContent(/^Voting ends .* · by /);
    });

    it("two columns: summary, actions, tally and votes in the main one; Your vote, timeline and money in the aside; no 'What you can do' card", async () => {
        renderPage(deps());
        const main = await screen.findByTestId("proposal-main");
        const aside = screen.getByTestId("proposal-aside");
        for (const id of ["summary-panel", "actions-panel", "tally-panel", "votes-panel"]) expect(within(main).getByTestId(id)).toBeInTheDocument();
        for (const id of ["your-vote", "timeline-panel", "money-panel"]) expect(within(aside).getByTestId(id)).toBeInTheDocument();
        expect(aside.tagName).toBe("ASIDE");
        expect(screen.queryByText("What you can do")).toBeNull();
        expect(within(main).getAllByRole("heading", {level: 2}).map((h) => h.textContent)).toEqual(["Summary", "What it does if it passes", "Tally", "Votes"]);
        expect(within(aside).getAllByRole("heading", {level: 2}).map((h) => h.textContent)).toEqual(["Your vote", "Timeline", "Deposit and cost"]);
    });

    it("the raw JSON lists every message in order, and the actions name the DAOs they act on", async () => {
        renderPage(deps());
        await screen.findAllByTestId("action");
        expect(JSON.parse(screen.getByTestId("raw-messages-json").textContent ?? "null")).toEqual(MSGS);
        await waitFor(() => expect(screen.getByTestId("actions-panel")).toHaveTextContent("Hand Garden club to its own voters"));
        expect(screen.getByTestId("actions-panel")).not.toHaveTextContent("DAO 12");
    });

    it("while voting, says until when a failed execution could be retried (voting end + the execution window)", async () => {
        renderPage(deps());
        const item = await screen.findByText("If the actions fail, anyone can retry until then");
        expect(item.closest("[data-kind]")).toHaveAttribute("data-kind", "retry-until");
    });

    it("tells a staker which stake does not count, because they joined or added to it after the proposal started", async () => {
        wallet.address = ME;
        renderPage(deps());
        expect(await screen.findByTestId("not-counted")).toHaveTextContent(/^Your 12(\.0+)? BZE in Staking reward 17 doesn't count here: you joined or added to it after this proposal started\.$/);
    });

    it("says nothing about it when the stake joined before the proposal", async () => {
        wallet.address = ME;
        renderPage(deps({getJoinHeight: vi.fn(async () => "99"), getVotingPower: vi.fn(async () => ({current: "12000000", proposals: [{proposal_id: "7", eligible_weight: "12000000", shares: [{source: "sr/000000000017", amount: "12000000"}]}]}))}));
        expect(await screen.findByTestId("vote-weight-note")).toHaveTextContent(/Your vote counts for\s*12/);
        expect(screen.queryByTestId("not-counted")).toBeNull();
    });
});
