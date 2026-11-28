import {useState} from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {ctxWith, OTHER, SUB_DAO, THIRD} from "@/test/composer-fixtures";
import type {ActionContext, ActionDraft} from "@/lib/actions/types";
import {composeAction} from "@/lib/actions/compose-action";
import {findAction} from "@/lib/actions/registry";
import type {StaleNomination} from "@/lib/propose/relations";
import {ActionsList} from "./actions-list";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useToast: () => ({toast: vi.fn()}),
}));

const formatCoin = (c: {denom: string; amount: string}) => `${c.amount} ${c.denom}`;

/** The list as the composer drives it: the drafts live in state, and what they compose to is read back at the end. */
const Harness = ({ctx, onDrafts, stale}: {ctx: ActionContext; onDrafts: (drafts: ActionDraft[]) => void; stale?: StaleNomination[]}) => {
    const [drafts, setDrafts] = useState<ActionDraft[]>([]);
    return (
        <ChakraProvider value={defaultSystem}>
            <ActionsList
                drafts={drafts}
                composed={drafts.map((d) => composeAction(d, ctx, findAction))}
                ctx={ctx}
                maxActions={16}
                formatCoin={formatCoin}
                onChange={(next) => { setDrafts(next); onDrafts(next); }}
                staleNominations={stale}
            />
        </ChakraProvider>
    );
};

const type = (testId: string, value: string, index = 0) => fireEvent.change(screen.getAllByTestId(testId)[index], {target: {value}});

describe("the actions list", () => {
    it("offers a DAO without sub-DAOs no sub-DAO action, and one with a sub-DAO both", () => {
        const none = render(<Harness ctx={ctxWith()} onDrafts={() => {}} />);
        fireEvent.click(screen.getByTestId("add-action"));
        expect(screen.queryByTestId("add-sub-dao-execute")).toBeNull();
        expect(screen.getByTestId("add-update-members")).toBeTruthy();
        none.unmount();

        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={() => {}} />);
        fireEvent.click(screen.getByTestId("add-action"));
        expect(screen.getByTestId("add-sub-dao-execute-7")).toBeTruthy();
        expect(screen.getByTestId("add-sub-dao-admin-7")).toBeTruthy();
    });

    it("runs actions as a sub-DAO: the nested list pays from the sub-DAO and shows it", () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("add-action"));
        fireEvent.click(screen.getByTestId("add-sub-dao-execute-7"));

        const nested = screen.getByTestId("nested-actions");
        expect(within(nested).getByTestId("no-inner-actions")).toBeTruthy();
        fireEvent.click(within(nested).getByTestId("add-action"));
        fireEvent.click(within(nested).getByTestId("add-pay"));
        // the nested pay form holds the sub-DAO's treasury, not the DAO's
        expect(within(nested).getByTestId("pay-held").textContent).toBe("The treasury holds 90 BZE.");
        type("pay-amount", "1.5");
        type("pay-to", OTHER);

        const rows = screen.getAllByTestId("action-row");
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getAllByTestId("action-preview").length).toBeGreaterThan(0);
        expect(drafts[0].type).toBe("sub-dao-execute");
        expect(JSON.parse(drafts[0].fields.inner)).toEqual([{type: "pay", fields: {denom: "ubze", amount: "1.5", to: OTHER}}]);
        expect(drafts[0].fields.daoId).toBe("7");
        // the outer row (read last in the document, after its nested form) says whose treasury pays
        expect(screen.getAllByTestId("action-preview")[1].textContent).toContain("from the sub-DAO (DAO 7)");
    });

    it("starts the inner list again when another sub-DAO is picked", () => {
        const other = {...SUB_DAO, dao: {...SUB_DAO.dao, id: "8", address: THIRD, name: "Bee club"}};
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO, other]})} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("add-action"));
        fireEvent.click(screen.getByTestId("add-sub-dao-execute-7"));
        const nested = () => screen.getByTestId("nested-actions");
        fireEvent.click(within(nested()).getByTestId("add-action"));
        fireEvent.click(within(nested()).getByTestId("add-pay"));
        expect(JSON.parse(drafts[0].fields.inner)).toHaveLength(1);

        fireEvent.change(screen.getByTestId("sub-execute-dao"), {target: {value: "8"}});
        expect(drafts[0].fields).toEqual({daoId: "8", inner: ""});
    });

    it("says in the form when the sub-DAOs could not be read", () => {
        render(<Harness ctx={ctxWith({subDaos: null})} onDrafts={() => {}} />);
        fireEvent.click(screen.getByTestId("add-action"));
        fireEvent.click(screen.getByTestId("add-sub-dao-execute"));
        expect(screen.getByText(/could not be read right now/)).toBeTruthy();
    });
});

describe("the picker", () => {
    const pick = (ctx: ActionContext, stale: StaleNomination[] = []) => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctx} stale={stale} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("add-action"));
        return () => drafts;
    };
    const POLLEN: StaleNomination = {dao: {id: "11", name: "Pollen Fund", address: THIRD}, parent: {id: "3", name: "Meadow DAO"}, changed: {id: "3", name: "Meadow DAO"}};

    it("groups the entries: basics, this DAO, other DAOs", () => {
        pick(ctxWith({subDaos: [SUB_DAO], incoming: [{id: "9", name: "Bee Art Collective", address: OTHER}]}));
        expect(within(screen.getByTestId("picker-group-basics")).getByTestId("add-pay")).toBeTruthy();
        expect(within(screen.getByTestId("picker-group-this-dao")).getByTestId("add-update-members")).toBeTruthy();
        expect(within(screen.getByTestId("picker-group-other-daos")).getByTestId("add-accept-nomination-9")).toBeTruthy();
        expect(within(screen.getByTestId("picker-group-other-daos")).getByTestId("manage-sub-dao-7")).toBeTruthy();
    });

    it("names each SubDAO: Manage <name> (SubDAO), never by a number", () => {
        pick(ctxWith({subDaos: [SUB_DAO]}));
        const row = screen.getByTestId("manage-sub-dao-7");
        expect(row).toHaveTextContent("Manage Garden club (SubDAO)");
        expect(row).toHaveTextContent("Hand over, or run actions as it.");
        expect(screen.getByTestId("action-picker")).not.toHaveTextContent(/a DAO this one runs|this DAO administers|DAO #|DAO 7/);
    });

    it("adds a SubDAO action with that SubDAO chosen", () => {
        const other = {...SUB_DAO, dao: {...SUB_DAO.dao, id: "8", address: THIRD, name: "Bee club"}};
        const drafts = pick(ctxWith({subDaos: [SUB_DAO, other]}));
        fireEvent.click(screen.getByTestId("add-sub-dao-admin-8"));
        expect(drafts()[0]).toMatchObject({type: "sub-dao-admin", fields: {daoId: "8", mode: "nominate"}});
        expect((screen.getByTestId("sub-admin-dao") as HTMLSelectElement).value).toBe("8");
        expect(screen.getByTestId("sub-admin-dao")).toHaveTextContent("Bee club");
        expect(screen.getByTestId("sub-admin-dao")).not.toHaveTextContent(/DAO 8|\(DAO/);
    });

    it("offers one accept per nominating DAO, enabled, and adds it with that DAO chosen", () => {
        const drafts = pick(ctxWith({incoming: [{id: "9", name: "Bee Art Collective", address: OTHER}]}));
        const accept = screen.getByTestId("add-accept-nomination-9");
        expect(accept).toHaveTextContent("Accept: become the admin of Bee Art Collective");
        expect(accept).toHaveTextContent("Bee Art Collective nominated Founders.");
        expect(accept).not.toBeDisabled();
        fireEvent.click(accept);
        expect(drafts()[0]).toMatchObject({type: "accept-nomination", fields: {daoId: "9"}});
    });

    it("shows a stale nomination greyed out and disabled, with a Stale pill and why", () => {
        const drafts = pick(ctxWith({incoming: [{id: "9", name: "Bee Art Collective", address: OTHER}]}), [POLLEN]);
        const stale = screen.getByTestId("stale-nomination-11");
        expect(stale).toBeDisabled();
        expect(stale).toHaveTextContent("Accept: become the admin of Pollen Fund");
        expect(within(stale).getByTestId("stale-pill")).toHaveTextContent("Stale");
        expect(within(stale).getByTestId("stale-nomination-text")).toHaveTextContent("Out of date: Meadow DAO, the DAO that runs Pollen Fund, changed its admin after Founders was nominated. Meadow DAO has to nominate it again.");
        fireEvent.click(stale);
        expect(drafts()).toEqual([]);
        expect(screen.getByTestId("add-accept-nomination-9")).not.toBeDisabled();
    });

    it("explains the stale rule in the Other DAOs group when there is a nomination, and not without one", () => {
        pick(ctxWith({incoming: [{id: "9", name: "Bee Art Collective", address: OTHER}]}));
        const note = within(screen.getByTestId("picker-group-other-daos")).getByTestId("picker-stale-note");
        expect(note).toHaveTextContent("goes out of date when the DAO that runs the nominating DAO changes its admin");
        expect(note).toHaveTextContent("has to nominate again");
    });

    it("has no stale note when nothing nominated this DAO", () => {
        pick(ctxWith({subDaos: [SUB_DAO]}));
        expect(screen.getByTestId("picker-group-other-daos")).toBeTruthy();
        expect(screen.queryByTestId("picker-stale-note")).toBeNull();
    });

    it("still lists a stale nomination when it is the only one (the accept entry itself is then not offered)", () => {
        pick(ctxWith({incoming: []}), [POLLEN]);
        expect(screen.getByTestId("stale-nomination-11")).toBeDisabled();
        expect(screen.queryByTestId(/^add-accept-nomination/)).toBeNull();
    });
});

describe("the nested list's row ids", () => {
    it("stay unique when a row is removed and another added", () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("add-action"));
        fireEvent.click(screen.getByTestId("add-sub-dao-execute-7"));
        const nested = () => screen.getByTestId("nested-actions");
        for (let i = 0; i < 3; i++) {
            fireEvent.click(within(nested()).getByTestId("add-action"));
            fireEvent.click(within(nested()).getByTestId("add-pay"));
        }
        fireEvent.click(within(nested()).getAllByTestId("action-remove")[1]);
        fireEvent.click(within(nested()).getByTestId("add-action"));
        fireEvent.click(within(nested()).getByTestId("add-pay"));
        expect(JSON.parse(drafts[0].fields.inner)).toHaveLength(3);
        expect(within(nested()).getAllByTestId("action-row")).toHaveLength(3);
    });
});
