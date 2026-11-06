import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "dark", setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import type {ActivityRow as Row} from "@/lib/token-activity";

import {TokenSiteTheme} from "../kit";
import {ActivityRow} from "./activity-row";

forbidNetwork();

const DENOM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const ENCODED = encodeURIComponent(DENOM);
const TOKEN = {denom: DENOM, symbol: "NOAD", exponent: 6};
const ACTOR = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const HASH = "8E56E5C0AC8A84FF0F0D6175ECC6784AAA74E2E285C4F644EE156100DBAEF595";

const ROW: Row = {
    txHash: HASH, height: 1, time: "2026-11-05T21:09:16Z", tag: "Burn", more: 0, title: "Sent to the burner",
    actor: ACTOR, actorLabel: null, amount: "1000000000", direction: "out",
    fee: [{denom: "ubze", amount: "930", symbol: "BZE", exponent: 6}], chain: null, detailed: true,
};

const renderRow = (props: Partial<Parameters<typeof ActivityRow>[0]> = {}) => render(
    <ChakraProvider value={defaultSystem}>
        <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><ActivityRow row={ROW} token={TOKEN} first {...props}/></TokenSiteTheme>
    </ChakraProvider>,
);

describe("ActivityRow", () => {
    it("shows the tag, title, actor, amount, fee and transaction, linking inside the token site", () => {
        renderRow();

        expect(screen.getByText("Burn")).toBeInTheDocument();
        expect(screen.getByText("Sent to the burner")).toBeInTheDocument();
        expect(screen.getByText("1,000 NOAD")).toBeInTheDocument();
        expect(screen.getByText("Fee 0.00093 BZE")).toBeInTheDocument();
        expect(screen.getByRole("link", {name: "bze1fk…y3y5k"})).toHaveAttribute("href", `/token/holder?denom=${ENCODED}&address=${ACTOR}`);
        expect(screen.getByRole("link", {name: "8E56…F595"})).toHaveAttribute("href", `/token/tx?denom=${ENCODED}&hash=${HASH}`);
        expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it("shows +N with what it means, and a placeholder until the fee is read", () => {
        renderRow({row: {...ROW, more: 3, fee: null}});

        expect(screen.getByLabelText("3 more messages in this transaction")).toHaveTextContent("+3");
        expect(screen.getByLabelText("Loading the fee")).toBeInTheDocument();
    });

    it("signs the amount from the actor's side when asked", () => {
        const {unmount} = renderRow({signed: true});
        expect(screen.getByText("−1,000 NOAD")).toBeInTheDocument();
        unmount();

        renderRow({signed: true, row: {...ROW, amount: "56000000", direction: "in"}});
        expect(screen.getByText("+56 NOAD")).toBeInTheDocument();
    });

    it("leaves the sign out when the actor only moved others' tokens", () => {
        renderRow({signed: true, row: {...ROW, direction: "none"}});

        expect(screen.getByText("1,000 NOAD")).toBeInTheDocument();
    });

    it("hides the actor when asked", () => {
        renderRow({hideActor: true});

        expect(screen.queryByText("by")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", {name: "bze1fk…y3y5k"})).not.toBeInTheDocument();
        expect(screen.getByText("Sent to the burner")).toBeInTheDocument();
    });
});
