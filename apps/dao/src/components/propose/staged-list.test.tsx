import {useState} from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {ctxWith, DAO, OTHER, SUB_DAO, THIRD, WALLET} from "@/test/composer-fixtures";
import type {ActionContext, ActionDraft} from "@/lib/actions/types";
import {composeAction} from "@/lib/actions/compose-action";
import {findAction} from "@/lib/actions/registry";
import {shortAddress} from "@/lib/format";
import type {StaleNomination} from "@/lib/propose/relations";
import {ActionsList} from "./actions-list";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useToast: () => ({toast: vi.fn()}),
}));

const formatCoin = (c: {denom: string; amount: string}) => `${c.amount} ${c.denom}`;

/** The composer's list (`staged`): the drafts live in state, what they compose to is read back. */
const Harness = ({ctx, onDrafts = () => {}, stale, start = [], onEditing}: {ctx: ActionContext; onDrafts?: (drafts: ActionDraft[]) => void; stale?: StaleNomination[]; start?: ActionDraft[]; onEditing?: (open: boolean) => void}) => {
    const [drafts, setDrafts] = useState<ActionDraft[]>(start);
    return (
        <ChakraProvider value={defaultSystem}>
            <ActionsList
                staged
                wallet={WALLET}
                drafts={drafts}
                composed={drafts.map((d) => composeAction(d, ctx, findAction))}
                ctx={ctx}
                maxActions={16}
                formatCoin={formatCoin}
                onChange={(next) => { setDrafts(next); onDrafts(next); }}
                staleNominations={stale}
                onEditing={onEditing}
            />
        </ChakraProvider>
    );
};

const openPicker = async () => {
    fireEvent.click(screen.getByTestId("add-action"));
    return screen.findByTestId("action-picker");
};
const choose = async (testId: string) => {
    const picker = await openPicker();
    fireEvent.click(within(picker).getByTestId(testId));
};
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), {target: {value}});

describe("the staged list: a form card first, the list only on Add to proposal", () => {
    it("adds a payment once it is complete, as a numbered card read back from the message", async () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith()} onDrafts={(d) => { drafts = d; }} />);
        await choose("add-pay");
        const editor = screen.getByTestId("action-editor");
        expect(editor).toHaveTextContent("Pay from the treasury");
        expect(editor).toHaveTextContent("cosmos.bank MsgSend from the DAO's address");
        type("pay-amount", "1.5");
        type("pay-to", OTHER);
        // nothing is in the list until it is added
        expect(drafts).toEqual([]);
        expect(screen.queryByTestId("action-row")).toBeNull();

        fireEvent.click(screen.getByTestId("action-commit"));
        expect(drafts).toHaveLength(1);
        expect(screen.queryByTestId("action-editor")).toBeNull();
        const row = screen.getByTestId("action-row");
        expect(row).toHaveTextContent(/^1/);
        expect(within(row).getByTestId("action-card-title")).toHaveTextContent("Pay from the treasury");
        expect(within(row).getByTestId("action-preview")).toHaveTextContent(`1500000 ubze to ${shortAddress(OTHER)}`);
    });

    it("Cancel leaves the list as it was", async () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith()} onDrafts={(d) => { drafts = d; }} />);
        await choose("add-pay");
        type("pay-amount", "2");
        fireEvent.click(screen.getByTestId("action-cancel"));
        expect(drafts).toEqual([]);
        expect(screen.queryByTestId("action-editor")).toBeNull();
        expect(screen.getByTestId("add-action")).toBeTruthy();
    });

    it("an invalid action is not added: the attempt shows why", async () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith()} onDrafts={(d) => { drafts = d; }} />);
        await choose("add-pay");
        // untouched, no error is shown yet
        expect(screen.queryByTestId("action-error")).toBeNull();
        fireEvent.click(screen.getByTestId("action-commit"));
        expect(drafts).toEqual([]);
        expect(screen.getByTestId("action-error")).toBeTruthy();
        expect(screen.getByTestId("action-editor")).toBeTruthy();
    });

    it("Edit reopens the form on the card's place; Cancel keeps the old action, Save changes replaces it", async () => {
        let drafts: ActionDraft[] = [];
        const start: ActionDraft[] = [{key: "a1", type: "pay", fields: {denom: "ubze", amount: "1", to: OTHER}}];
        render(<Harness ctx={ctxWith()} start={start} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("action-edit"));
        type("pay-amount", "3");
        fireEvent.click(screen.getByTestId("action-cancel"));
        expect(screen.getByTestId("action-preview")).toHaveTextContent("1000000 ubze");

        fireEvent.click(screen.getByTestId("action-edit"));
        type("pay-amount", "3");
        expect(screen.getByTestId("action-commit")).toHaveTextContent("Save changes");
        fireEvent.click(screen.getByTestId("action-commit"));
        expect(drafts).toEqual([{key: "a1", type: "pay", fields: {denom: "ubze", amount: "3", to: OTHER}}]);
        expect(screen.getByTestId("action-preview")).toHaveTextContent("3000000 ubze");
    });

    it("Move up swaps an action with the one before it; the first cannot move", () => {
        let drafts: ActionDraft[] = [];
        const start: ActionDraft[] = [
            {key: "a1", type: "pay", fields: {denom: "ubze", amount: "1", to: OTHER}},
            {key: "a2", type: "pay", fields: {denom: "ubze", amount: "2", to: THIRD}},
        ];
        render(<Harness ctx={ctxWith()} start={start} onDrafts={(d) => { drafts = d; }} />);
        const ups = screen.getAllByTestId("action-move-up");
        expect(ups[0]).toBeDisabled();
        fireEvent.click(ups[1]);
        expect(drafts.map((d) => d.key)).toEqual(["a2", "a1"]);
    });

    it("while a form card is open the other cards cannot move, open or go, and the page is told", async () => {
        const onEditing = vi.fn();
        const start: ActionDraft[] = [
            {key: "a1", type: "pay", fields: {denom: "ubze", amount: "1", to: OTHER}},
            {key: "a2", type: "pay", fields: {denom: "ubze", amount: "2", to: THIRD}},
            {key: "a3", type: "pay", fields: {denom: "ubze", amount: "3", to: THIRD}},
        ];
        render(<Harness ctx={ctxWith()} start={start} onEditing={onEditing} />);
        fireEvent.click(screen.getAllByTestId("action-edit")[1]);
        expect(onEditing).toHaveBeenLastCalledWith(true);
        const rows = screen.getAllByTestId("action-row");
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(within(row).getByTestId("action-move-up")).toBeDisabled();
            expect(within(row).getByTestId("action-edit")).toBeDisabled();
            expect(within(row).getByTestId("action-remove")).toBeDisabled();
        }
        fireEvent.click(screen.getByTestId("action-cancel"));
        expect(onEditing).toHaveBeenLastCalledWith(false);
        expect(screen.getAllByTestId("action-edit")[0]).not.toBeDisabled();
    });

    it("a card whose action went invalid says why", () => {
        const start: ActionDraft[] = [{key: "a1", type: "pay", fields: {denom: "ubze", amount: "1", to: "nobody"}}];
        render(<Harness ctx={ctxWith()} start={start} />);
        expect(within(screen.getByTestId("action-row")).getByTestId("action-error")).toBeTruthy();
    });

    it("names the wallet (you) on a members card", () => {
        const start: ActionDraft[] = [{key: "a1", type: "update-members", fields: {add: "", remove: WALLET}}];
        render(<Harness ctx={ctxWith()} start={start} />);
        expect(screen.getByTestId("action-preview")).toHaveTextContent(`Remove ${shortAddress(WALLET)} (you)`);
    });

    it("titles the list with the DAO it runs as", () => {
        render(<Harness ctx={ctxWith()} />);
        expect(screen.getByTestId("actions-editor")).toHaveTextContent("What it does if it passes");
        expect(screen.getByTestId("actions-editor")).toHaveTextContent("Run as Founders, in this order");
    });
});

describe("the picker dialog", () => {
    it("says which DAO, its type and who governs it", async () => {
        render(<Harness ctx={ctxWith()} />);
        const picker = await openPicker();
        expect(within(picker).getByTestId("picker-subtitle")).toHaveTextContent("Founders · Member list · governs itself");
        expect(within(picker).getByTestId("add-pay")).toHaveTextContent("Send tokens the DAO holds to an address.");
        expect(within(picker).getByTestId("add-custom")).toHaveTextContent("Any chain message, written as JSON, signed by the DAO.");
    });

    it("offers Text only on an empty list, which explains itself and adds nothing", async () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith()} onDrafts={(d) => { drafts = d; }} />);
        await choose("add-text-only");
        expect(screen.getByTestId("text-only")).toHaveTextContent("Nothing runs if it passes.");
        expect(drafts).toEqual([]);
    });

    it("has no Text only once the list has an action", async () => {
        render(<Harness ctx={ctxWith()} start={[{key: "a1", type: "pay", fields: {denom: "ubze", amount: "1", to: OTHER}}]} />);
        const picker = await openPicker();
        expect(within(picker).queryByTestId("add-text-only")).toBeNull();
    });

    it("lists Withdraw greyed out with Nothing is pending when a self-governed DAO has no nomination", async () => {
        render(<Harness ctx={ctxWith()} />);
        const picker = await openPicker();
        const idle = within(picker).getByTestId("withdraw-nothing-pending");
        expect(idle).toBeDisabled();
        expect(idle).toHaveTextContent("Nothing is pending");
        expect(within(picker).queryByTestId("add-withdraw-nomination")).toBeNull();
    });

    it("offers Withdraw itself while a nomination is pending", async () => {
        render(<Harness ctx={ctxWith({dao: {...DAO, pending_admin: OTHER}})} />);
        const picker = await openPicker();
        expect(within(picker).getByTestId("add-withdraw-nomination")).not.toBeDisabled();
        expect(within(picker).queryByTestId("withdraw-nothing-pending")).toBeNull();
    });

    it("a stale nomination is greyed out with a Stale pill and cannot be picked", async () => {
        const pollen: StaleNomination = {dao: {id: "11", name: "Pollen Fund", address: THIRD}, parent: {id: "3", name: "Meadow DAO"}, changed: {id: "3", name: "Meadow DAO"}};
        render(<Harness ctx={ctxWith({incoming: []})} stale={[pollen]} />);
        const picker = await openPicker();
        const stale = within(picker).getByTestId("stale-nomination-11");
        expect(stale).toBeDisabled();
        expect(within(stale).getByTestId("stale-pill")).toHaveTextContent("Stale");
        expect(within(stale).getByTestId("stale-nomination-text")).toHaveTextContent("Meadow DAO has to nominate it again.");
    });

    it("one row per SubDAO opens a Manage card with its ways to manage it", async () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={(d) => { drafts = d; }} />);
        await choose("manage-sub-dao-7");
        const editor = screen.getByTestId("action-editor");
        expect(editor).toHaveTextContent("Manage Garden club");
        expect(editor).toHaveTextContent("Founders is its admin");
        expect(screen.getByTestId("sub-way-execute")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("sub-way-nominate")).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByTestId("sub-way-voters")).toBeTruthy();
        // no pending nomination on the SubDAO: nothing to withdraw
        expect(screen.queryByTestId("sub-way-withdraw")).toBeNull();
        // the SubDAO is chosen by the row: no select for it
        expect(screen.queryByTestId("sub-execute-dao")).toBeNull();

        fireEvent.click(screen.getByTestId("sub-way-voters"));
        expect(screen.getByTestId("sub-way-voters")).toHaveAttribute("aria-pressed", "true");
        expect(screen.queryByTestId("sub-admin-mode")).toBeNull();
        fireEvent.click(screen.getByTestId("action-commit"));
        expect(drafts[0]).toMatchObject({type: "sub-dao-admin", fields: {daoId: "7", mode: "voters"}});
        expect(screen.getByTestId("action-card-title")).toHaveTextContent("Manage Garden club (SubDAO)");
    });

    it("runs actions as a SubDAO: the inner list is staged too and pays from the SubDAO's treasury", async () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={(d) => { drafts = d; }} />);
        await choose("manage-sub-dao-7");
        const nested = screen.getByTestId("nested-actions");
        fireEvent.click(within(nested).getByTestId("add-action"));
        const picker = await screen.findByTestId("action-picker");
        fireEvent.click(within(picker).getByTestId("add-pay"));
        // the Manage card waits while its inner form card is open
        const outerCommit = () => screen.getAllByTestId("action-commit").at(-1)!;
        expect(outerCommit()).toBeDisabled();
        expect(screen.getByTestId("action-commit-blocked")).toHaveTextContent("Add or cancel the open action above first.");
        expect(screen.getByTestId("pay-held")).toHaveTextContent("Treasury holds 90 BZE.");
        type("pay-amount", "1.5");
        type("pay-to", OTHER);
        fireEvent.click(within(screen.getByTestId("nested-actions")).getByTestId("action-commit"));
        expect(within(screen.getByTestId("nested-actions")).getByTestId("action-card-title")).toHaveTextContent("As Garden club: pay from its treasury");

        // the outer card is added last, and reads back the inner actions
        const commits = screen.getAllByTestId("action-commit");
        fireEvent.click(commits[commits.length - 1]);
        expect(drafts[0].type).toBe("sub-dao-execute");
        expect(JSON.parse(drafts[0].fields.inner)).toEqual([{type: "pay", fields: {denom: "ubze", amount: "1.5", to: OTHER}}]);
        expect(screen.getByTestId("action-preview")).toHaveTextContent("1 action as Garden club");
        expect(screen.getByTestId("action-inner")).toHaveTextContent(`1500000 ubze to ${shortAddress(OTHER)}`);
    });
});
