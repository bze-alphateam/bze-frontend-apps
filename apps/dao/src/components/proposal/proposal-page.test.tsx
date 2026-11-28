import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
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
}));
vi.mock("@/lib/dao-chain", () => ({liveProposalDeps: {}}));
// the transaction buttons have their own tests
vi.mock("./actions-slot", () => ({ProposalActionsSlot: () => null}));

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
    it("goes back to the DAO's Proposals tab, named, instead of an 'In <DAO>' link", async () => {
        renderPage(deps());
        const back = await screen.findByTestId("proposal-back");
        expect(back).toHaveTextContent("Stakers club · proposals");
        expect(back).toHaveAttribute("href", "/dao/4?tab=proposals");
        expect(screen.queryByTestId("proposal-dao")).toBeNull();
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
        expect(await screen.findByTestId("not-counted")).toHaveTextContent(/^12(\.0+)? BZE in Staking reward 17 doesn't count: you joined or added to it after this proposal started\.$/);
    });

    it("says nothing about it when the stake joined before the proposal", async () => {
        wallet.address = ME;
        renderPage(deps({getJoinHeight: vi.fn(async () => "99"), getVotingPower: vi.fn(async () => ({current: "12000000", proposals: [{proposal_id: "7", eligible_weight: "12000000", shares: [{source: "sr/000000000017", amount: "12000000"}]}]}))}));
        await screen.findByTestId("eligible");
        expect(screen.queryByTestId("not-counted")).toBeNull();
    });
});
