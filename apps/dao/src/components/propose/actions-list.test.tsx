import {useState} from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {ctxWith, OTHER, SUB_DAO, THIRD} from "@/test/composer-fixtures";
import type {ActionContext, ActionDraft} from "@/lib/actions/types";
import {composeAction} from "@/lib/actions/compose-action";
import {findAction} from "@/lib/actions/registry";
import {ActionsList} from "./actions-list";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useToast: () => ({toast: vi.fn()}),
}));

const formatCoin = (c: {denom: string; amount: string}) => `${c.amount} ${c.denom}`;

/** The list as the composer drives it: the drafts live in state, and what they compose to is read back at the end. */
const Harness = ({ctx, onDrafts}: {ctx: ActionContext; onDrafts: (drafts: ActionDraft[]) => void}) => {
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
        expect(screen.getByTestId("add-sub-dao-execute")).toBeTruthy();
        expect(screen.getByTestId("add-sub-dao-admin")).toBeTruthy();
    });

    it("runs actions as a sub-DAO: the nested list pays from the sub-DAO and shows it", () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("add-action"));
        fireEvent.click(screen.getByTestId("add-sub-dao-execute"));

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
        fireEvent.click(screen.getByTestId("add-sub-dao-execute"));
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

describe("the nested list's row ids", () => {
    it("stay unique when a row is removed and another added", () => {
        let drafts: ActionDraft[] = [];
        render(<Harness ctx={ctxWith({subDaos: [SUB_DAO]})} onDrafts={(d) => { drafts = d; }} />);
        fireEvent.click(screen.getByTestId("add-action"));
        fireEvent.click(screen.getByTestId("add-sub-dao-execute"));
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
