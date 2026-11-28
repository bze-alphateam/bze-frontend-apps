import type {ReactNode} from "react";
import {describe, expect, it} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {DaoParams} from "@bze/bze-ui-kit";
import {modelFromChain} from "@/lib/proposal-model";
import type {ProposalPageData} from "@/lib/proposal-loader";
import type {MsgAction} from "@/lib/proposal-describe";
import {CONFIG, PROPOSAL, RESPONSE} from "@/test/proposal-fixtures";
import {TallyPanel} from "./tally-panel";
import {MoneyPanel, TimelinePanel} from "./timeline-money";
import {WhatItDoes} from "./what-it-does";

const wrap = (ui: ReactNode) => render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
// the fixture is submitted on 27 Oct 2026 and votes until 30 Oct
const NOW = Date.parse("2026-10-28T00:00:00Z");

const modelOf = (over: Partial<typeof PROPOSAL>, daoType = "DAO_TYPE_STAKE") => modelFromChain({...RESPONSE, proposal: {...PROPOSAL, ...over}}, null, "Club", daoType);
const dataOf = (over: Partial<typeof PROPOSAL>, daoType = "DAO_TYPE_STAKE"): ProposalPageData => ({
    model: modelOf(over, daoType),
    dao: {ok: true, value: null}, params: {ok: true, value: {min_expedite_delay: "86400s", execution_window: "1209600s"} as DaoParams}, scanDetail: null, scanFailed: false, weightDenom: null,
});

describe("TallyPanel", () => {
    it("a stake proposal: the votes cast as one bar, Turnout and Yes share with Met, and what would happen if voting ended now", () => {
        wrap(<TallyPanel model={modelOf({})} formatWeight={(a) => `${a} HONEY`} />);
        // 300 / 100 / 50 of the 450 cast
        expect(Array.from(screen.getByTestId("tally-stack").children).map((c) => c.getAttribute("data-option"))).toEqual(["yes", "no", "abstain"]);
        expect(screen.getByTestId("tally-yes")).toHaveTextContent("Yes 300 HONEY");
        expect(within(screen.getByTestId("bar-quorum")).getByTestId("bar-value")).toHaveTextContent("45 %");
        expect(within(screen.getByTestId("bar-quorum")).getByTestId("bar-met")).toHaveTextContent("Met");
        expect(within(screen.getByTestId("bar-quorum")).getByTestId("bar-text")).toHaveTextContent("Needs at least 40 % of 1000 HONEY");
        expect(within(screen.getByTestId("bar-threshold")).getByTestId("bar-text")).toHaveTextContent("Needs more than 50 % of yes + no");
        expect(screen.getByTestId("tally-verdict")).toHaveTextContent("If voting ended now, this proposal would pass.");
        expect(screen.getByTestId("tally-panel")).toHaveTextContent("Counted against 1000 HONEY, the voting power when it was submitted, and the rules it started with.");
        expect(screen.getByText("Updated every 60 s while voting")).toBeInTheDocument();
    });

    it("an expedited member-list proposal: the expedite pair first, counted in members, then the regular bars", () => {
        const config = {...CONFIG, expedite_threshold: "0.500000000000000000", expedite_quorum: "0.500000000000000000"};
        wrap(<TallyPanel model={modelOf({expedited: true, pinned_config: config, pinned_denominator: "5", yes: "2", no: "0", abstain: "0"}, "DAO_TYPE_STATIC_LIST")} formatWeight={(a) => a} />);
        const panel = screen.getByTestId("tally-panel");
        expect(panel).toHaveTextContent("To settle early (expedite bars, against all 5 members)");
        const ids = Array.from(panel.querySelectorAll("[data-testid^='bar-'][data-met]")).map((e) => e.getAttribute("data-testid"));
        expect(ids).toEqual(["bar-expedite-yes", "bar-expedite-quorum", "bar-quorum", "bar-threshold"]);
        const yes = screen.getByTestId("bar-expedite-yes");
        expect(yes).toHaveTextContent("Yes of all members");
        expect(within(yes).getByTestId("bar-value")).toHaveTextContent("2 of 5");
        expect(within(yes).getByTestId("bar-met")).toHaveTextContent("Not met yet");
        expect(within(yes).getByTestId("bar-text")).toHaveTextContent("Needs more than 50 %, so 3 of 5");
        expect(within(screen.getByTestId("bar-quorum")).getByTestId("bar-text")).toHaveTextContent("Needs at least 40 % of members");
        expect(within(panel).getByText("Expedited")).toBeInTheDocument();
    });
});

describe("WhatItDoes", () => {
    const ctx = {formatCoin: (c: {amount: string; denom: string}) => `${c.amount} ${c.denom}`, nameOf: () => undefined, daoOf: () => undefined};

    it("one numbered card per action in order, with the board's titles, then the raw JSON", () => {
        const actions: MsgAction[] = [
            {type: "send", from: "bze1dao", to: "bze1desk", amount: [{denom: "BZE", amount: "2,000"}], fromDao: true, subDao: null},
            {type: "update_members", add: ["bze1newmember"], remove: []},
        ];
        wrap(<WhatItDoes actions={actions} raw={[{"@type": "a"}, {"@type": "b"}]} memberCount={5} {...ctx} />);
        const cards = screen.getAllByTestId("action");
        expect(cards.map((c) => within(c).getByTestId("action-title").textContent)).toEqual(["Pay from the treasury", "Change the members"]);
        expect(cards[0]).toHaveTextContent(/^1/);
        expect(cards[0]).toHaveTextContent("2,000 BZE");
        expect(cards[1]).toHaveTextContent("Members after: 6. They can vote on proposals submitted after the block they're added in.");
        expect(screen.getByText("Run as the DAO, in this order, in the settle transaction")).toBeInTheDocument();
        expect(JSON.parse(screen.getByTestId("raw-messages-json").textContent ?? "null")).toHaveLength(2);
    });

    it("a text-only proposal says so, with no raw JSON", () => {
        wrap(<WhatItDoes actions={[]} raw={[]} memberCount={null} {...ctx} />);
        expect(screen.getByTestId("text-only")).toBeInTheDocument();
        expect(screen.queryByTestId("raw-messages")).toBeNull();
    });
});

describe("TimelinePanel and MoneyPanel", () => {
    it("the timeline: Submitted by the proposer with its block, the next step marked, the settle and the retry window still to come", () => {
        wrap(<TimelinePanel data={dataOf({msgs: [{"@type": "/cosmos.bank.v1beta1.MsgSend"}] as never})} nowMs={NOW} />);
        const items = screen.getAllByTestId("timeline-item");
        expect(items.map((i) => i.getAttribute("data-kind"))).toEqual(["submitted", "voting-end", "settle-next", "retry-until"]);
        expect(items[0]).toHaveTextContent("Submitted by bze1proposer");
        expect(within(items[0]).getByTestId("timeline-block")).toHaveTextContent("block 100");
        expect(items.map((i) => i.getAttribute("data-dot"))).toEqual(["done", "next", "later", "later"]);
        expect(items[2]).toHaveTextContent("Settled: counted, and if it passed its actions run");
        expect(items[2]).toHaveTextContent(/From .* UTC, by anyone/);
        expect(items[3]).toHaveTextContent(/^If the actions fail, anyone can retry until thenUntil /);
    });

    it("Deposit and cost as rows", () => {
        wrap(<MoneyPanel data={dataOf({})} formatCoin={(c) => `${Number(c.amount) / 1e6} BZE`} />);
        expect(screen.getByTestId("money-panel")).toHaveTextContent("Deposit and cost");
        expect(screen.getByTestId("money-deposit")).toHaveTextContent("9 BZE, held by the module");
        expect(screen.getByTestId("deposit-if-passes")).toHaveTextContent("Back to the proposer");
        expect(screen.getByTestId("deposit-rule")).toHaveTextContent("Burned");
        expect(screen.getByTestId("money-cost")).toHaveTextContent("5 BZE, sent to the DAO's treasury. Never refunded.");
    });
});
