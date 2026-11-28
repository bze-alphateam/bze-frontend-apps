import {describe, expect, it} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {DaoProposalMessage} from "@bze/bze-ui-kit";
import {describeMessages, type MsgAction} from "@/lib/proposal-describe";
import {ActionsPanel} from "./actions-panel";

const DAO = "bze1h0neydaoaccountxxxxxxxxxxxxxxxxxey7q";
const DESK = "bze1mmdeskxxxxxxxxxxxxxxxxxxxxxxxxxxd3sk";
const SUB = "bze1gardenclubxxxxxxxxxxxxxxxxxxxxxxx9gc";
const formatCoin = (c: {denom: string; amount: string}) => `${c.amount} ${c.denom}`;

const MSGS: DaoProposalMessage[] = [
    {"@type": "/cosmos.bank.v1beta1.MsgSend", from_address: DAO, to_address: DESK, amount: [{denom: "factory/bze1x/uhoney", amount: "50000000000"}]},
    {"@type": "/cosmos.bank.v1beta1.MsgSend", from_address: DAO, to_address: DESK, amount: [{denom: "ubze", amount: "2000000000"}]},
];

const renderPanel = (actions: MsgAction[], props: Partial<Parameters<typeof ActionsPanel>[0]> = {}) =>
    render(
        <ChakraProvider value={defaultSystem}>
            <ActionsPanel actions={actions} formatCoin={formatCoin} nameOf={() => undefined} {...props} />
        </ChakraProvider>,
    );

describe("ActionsPanel", () => {
    it("the raw JSON lists every message, in the order of the action cards", () => {
        renderPanel(describeMessages(MSGS, {daoAddress: DAO, before: null, formatCoin}), {raw: MSGS});
        const cards = screen.getAllByTestId("action");
        expect(cards).toHaveLength(2);
        expect(within(cards[0]).getByTestId("action-title")).toHaveTextContent("Send 50000000000 factory/bze1x/uhoney from the DAO");
        expect(within(cards[1]).getByTestId("action-title")).toHaveTextContent("Send 2000000000 ubze from the DAO");

        fireEvent.click(screen.getByText("Raw messages (JSON)"));
        const raw = JSON.parse(screen.getByTestId("raw-messages-json").textContent ?? "null");
        expect(raw).toEqual(MSGS);
        expect(raw.map((m: {amount: {denom: string}[]}) => m.amount[0].denom)).toEqual(["factory/bze1x/uhoney", "ubze"]);
    });

    it("has no raw view without the messages, or for a text-only proposal", () => {
        renderPanel(describeMessages(MSGS, {daoAddress: DAO, before: null, formatCoin}));
        expect(screen.queryByTestId("raw-messages")).toBeNull();
    });

    it("names the DAOs a message names by number, never its id while it is known", () => {
        const actions: MsgAction[] = [
            {type: "nominate_admin", daoId: "4", nominee: DESK, toVoters: false},
            {type: "nominate_admin", daoId: "12", nominee: "", toVoters: true},
            {type: "admin_execute", daoId: "12", actions: [{type: "send", from: SUB, to: DESK, amount: [{denom: "ubze", amount: "1"}], fromDao: false, subDao: "12"}]},
        ];
        const names: Record<string, string> = {"4": "HONEY Holders", "12": "Garden club"};
        renderPanel(actions, {daoOf: (id) => names[id], expanded: true});
        const titles = screen.getAllByTestId("action-title").map((t) => t.textContent);
        expect(titles).toEqual([
            "Nominate a new admin for HONEY Holders (they have to accept)",
            "Hand Garden club to its own voters: the admin steps down and no outside account controls it.",
            "Run an action as the SubDAO Garden club",
            "Send 1 ubze from the SubDAO Garden club",
        ]);
        expect(screen.getByTestId("actions-panel")).not.toHaveTextContent(/DAO 4|DAO 12|sub-DAO/);
        expect(screen.getAllByText(/Run actions as a SubDAO/)).toHaveLength(1);
    });

    it("without a name it shows the DAO's account, and its number only when nothing else is known", () => {
        const actions: MsgAction[] = [
            {type: "withdraw_nomination", daoId: "12"},
            {type: "accept_admin", daoId: "13", nominee: ""},
        ];
        renderPanel(actions, {signerOf: (id) => (id === "12" ? SUB : undefined), expanded: true});
        const titles = screen.getAllByTestId("action-title").map((t) => t.textContent);
        expect(titles).toEqual([
            "Withdraw the pending admin nomination of bze1garden…xxx9gc",
            "Accept the admin nomination of DAO 13: the nominee becomes its admin",
        ]);
    });
});
