import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { MetadataSDKType } from "@bze/bzejs/cosmos/bank/v1beta1/bank";
import type { Asset } from "@bze/bze-ui-kit";
import type { AdminState } from "@/lib/workspace";

// The card with the tx layer and wallet stubbed: it asserts the modes and the message it builds.
const m = vi.hoisted(() => ({ tx: vi.fn() }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1owner" }) }));

import { MetadataCard } from "./metadata-card";

const DENOM = "factory/bze1owner/utok";
const asset = { denom: DENOM, ticker: "TOK", name: "Tok", decimals: 6, logo: "" } as unknown as Asset;
const onChain: MetadataSDKType = {
    description: "The old one",
    denom_units: [
        { denom: DENOM, exponent: 0, aliases: ["utok"] },
        { denom: "tok", exponent: 6, aliases: [] },
    ],
    base: DENOM,
    display: "tok",
    name: "Tok",
    symbol: "TOK",
    uri: "ipfs://logo",
    uri_hash: "h",
};

const renderCard = (access: AdminState, opts: { metadata?: MetadataSDKType } = {}) => {
    const metadata = "metadata" in opts ? opts.metadata : onChain;
    const onSaved = vi.fn();
    render(
        <ChakraProvider value={defaultSystem}>
            <MetadataCard asset={asset} metadata={metadata} isLoading={false} access={access} onSaved={onSaved} />
        </ChakraProvider>,
    );
    return onSaved;
};

beforeEach(() => {
    m.tx.mockReset();
    m.tx.mockImplementation(async (_msgs, opts) => { opts?.onSuccess?.({}); return true; });
});

describe("MetadataCard", () => {
    it("shows what wallets show with the fixed fields", () => {
        renderCard("admin");
        const card = within(screen.getByRole("region", { name: "What wallets show" }));
        expect(card.getByText("Tok")).toBeInTheDocument();
        expect(card.getByText("TOK")).toBeInTheDocument();
        expect(card.getByText("The old one")).toBeInTheDocument();
        expect(card.getByText(DENOM)).toBeInTheDocument();
        expect(card.queryByText("The ticker, token ID and decimals can never change.")).not.toBeInTheDocument();
    });

    it("edits in place, reviews old → new and saves from the on-chain metadata", async () => {
        const onSaved = renderCard("admin");
        await userEvent.click(screen.getByRole("button", { name: "Edit" }));

        const review = screen.getByRole("button", { name: "Review changes" });
        expect(review).toBeDisabled();
        expect(screen.getByText("Nothing changed yet.")).toBeInTheDocument();

        const name = screen.getByRole("textbox", { name: "Name" });
        await userEvent.clear(name);
        await userEvent.type(name, "Tok Coin");
        const description = screen.getByRole("textbox", { name: "Description" });
        await userEvent.clear(description);
        await userEvent.type(description, "New words");
        expect(screen.getByTestId("metadata-description-counter")).toHaveTextContent("9 / 512");
        await userEvent.click(review);

        const nameDiff = within(screen.getByTestId("metadata-diff-name"));
        expect(nameDiff.getByText("Tok")).toHaveStyle({ textDecoration: "line-through" });
        expect(nameDiff.getByText("Tok Coin")).toBeInTheDocument();
        expect(within(screen.getByTestId("metadata-diff-description")).getByText("The old one")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Save on-chain" }));
        const [[msg]] = m.tx.mock.calls[0];
        expect(msg.typeUrl).toBe("/bze.tokenfactory.MsgSetDenomMetadata");
        expect(msg.value).toMatchObject({
            creator: "bze1owner",
            metadata: {
                name: "Tok Coin",
                description: "New words",
                base: DENOM,
                display: "tok",
                symbol: "TOK",
                uri: "ipfs://logo",
                uriHash: "h",
                denomUnits: [{ denom: DENOM, exponent: 0, aliases: ["utok"] }, { denom: "tok", exponent: 6, aliases: [] }],
            },
        });
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("blocks review on an invalid name and goes Back from review to the form", async () => {
        renderCard("admin");
        await userEvent.click(screen.getByRole("button", { name: "Edit" }));
        const name = screen.getByRole("textbox", { name: "Name" });
        await userEvent.clear(name);
        await userEvent.type(name, "X");
        expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();

        await userEvent.type(name, "Y");
        await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
        await userEvent.click(screen.getByRole("button", { name: "Back" }));
        expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("XY");
    });

    it("saves the wizard's layout when the token has no metadata", async () => {
        renderCard("admin", { metadata: undefined });
        await userEvent.click(screen.getByRole("button", { name: "Edit" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Description" }), "First words");
        await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
        await userEvent.click(screen.getByRole("button", { name: "Save on-chain" }));

        const [[msg]] = m.tx.mock.calls[0];
        expect(msg.value.metadata).toMatchObject({
            name: "Tok",
            description: "First words",
            base: DENOM,
            display: "tok",
            symbol: "TOK",
            uri: "",
            denomUnits: [{ denom: DENOM, exponent: 0, aliases: ["utok"] }, { denom: "tok", exponent: 6, aliases: [] }],
        });
    });

    it.each(["renounced", "not-admin", "unknown"] as const)("%s: read-only", (access) => {
        renderCard(access);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        if (access === "renounced") {
            expect(screen.getByTestId("metadata-frozen")).toHaveTextContent(/^Frozen$/);
        } else {
            expect(screen.queryByTestId("metadata-frozen")).not.toBeInTheDocument();
        }
    });
});
