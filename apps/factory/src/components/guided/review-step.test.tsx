import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The fee engine is mocked, the same way the PayPanel test does: the Review step must read
// the same inputs and agree with it.
const { payment } = vi.hoisted(() => ({ payment: { current: {} as Record<string, unknown> } }));
vi.mock("@/hooks/useFeePayment", () => ({ useFeePayment: () => payment.current }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, { denom: string; ticker: string; decimals: number; logo: string }> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssetPrice: () => ({ hasPrice: false, uAmountUsdValue: () => new BigNumber(0) }),
        TokenLogo: () => <span />,
    };
});

import { ReviewStep } from "./review-step";

const FEE = { denom: "ubze", amount: "25000000000" };
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

const pay = (overrides: Record<string, unknown> = {}) => ({
    isLoading: false,
    method: "native",
    gasFee: { amount: new BigNumber(4000), displayAmount: new BigNumber("0.004"), ticker: "BZE", isLoading: false },
    ...overrides,
});

const renderReview = (props: Partial<Parameters<typeof ReviewStep>[0]> = {}) => {
    const onSubmit = vi.fn();
    render(
        <ReviewStep
            number={4}
            total={4}
            state="active"
            leaves={[{ label: "Factory fee", coin: FEE }, { label: "Escrowed prize", coin: { denom: "utok", amount: "1000000" } }]}
            moduleFee={FEE}
            txKind="create-denom"
            gets={[{ label: "Your token", value: "HONEY" }]}
            extra={[{ label: "Admin", value: "You" }]}
            permanent={["The ticker can never change."]}
            submitLabel="Create token"
            onSubmit={onSubmit}
            {...props}
        />,
        { wrapper },
    );
    return onSubmit;
};

beforeEach(() => {
    payment.current = pay();
});

describe("ReviewStep", () => {
    it("lists what leaves the wallet (with the network fee), what you get, free rows and what is permanent", () => {
        renderReview();

        expect(screen.getByRole("region", { name: "Review" })).toHaveTextContent("Step 4 of 4 · Review");
        expect(screen.getByText("Everything right?")).toBeInTheDocument();
        const leaves = within(screen.getByRole("region", { name: "Leaves your wallet" }));
        expect(leaves.getByText("Factory fee")).toBeInTheDocument();
        expect(leaves.getByText("25,000 BZE")).toBeInTheDocument();
        expect(leaves.getByText("1 TOK")).toBeInTheDocument();
        expect(leaves.getByText("≈ 0.004000 BZE")).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "You get" })).getByText("HONEY")).toBeInTheDocument();
        expect(screen.getByText("Admin")).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Permanent" })).getByText("The ticker can never change.")).toBeInTheDocument();
    });

    it("the final button sends", async () => {
        const onSubmit = renderReview();
        await userEvent.click(screen.getByRole("button", { name: "Create token" }));
        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it.each([
        ["the page's own conditions", { disabled: true }, pay()],
        ["the fee still loading", { isLoading: true }, pay()],
        ["an unknown fee", { feeUnknown: true }, pay()],
        ["a balance that can't pay", {}, pay({ method: "insufficient" })],
    ])("is disabled for %s", (_name, props, outcome) => {
        payment.current = outcome;
        renderReview(props);
        expect(screen.getByRole("button", { name: "Create token" })).toBeDisabled();
    });

    it("an unknown fee says so instead of the rows", () => {
        renderReview({ feeUnknown: true });
        expect(screen.getByText("Could not load the current fee from the chain. Please refresh and try again.")).toBeInTheDocument();
        expect(screen.queryByText("Factory fee")).not.toBeInTheDocument();
    });

    it("a blocker replaces the final button", () => {
        renderReview({ blocker: <p>Nobody is staking any more.</p> });
        expect(screen.getByText("Nobody is staking any more.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Create token" })).not.toBeInTheDocument();
    });

    it("is a quiet row until the earlier steps are done", () => {
        renderReview({ state: "todo" });
        expect(screen.getByRole("region", { name: "Review" })).toHaveAttribute("data-state", "todo");
        expect(screen.queryByRole("button", { name: "Create token" })).not.toBeInTheDocument();
    });
});
