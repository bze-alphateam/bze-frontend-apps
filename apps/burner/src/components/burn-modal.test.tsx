import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

const ASSETS: Record<string, { denom: string; ticker: string; name: string; decimals: number }> = {
    ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6 },
    "ibc/ABC": { denom: "ibc/ABC", ticker: "ATOM", name: "Atom", decimals: 6 },
};

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1me" }) }));
vi.mock("@/components/ui/asset_logo", () => ({ AssetLogo: () => null }));
vi.mock("@/components/ui/burner/dialog", () => ({
    BurnerDialog: ({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) => <div><h2>{title}</h2>{children}{footer}</div>,
    CoinRow: () => null,
    InsetRow: () => null,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ getAsset: (d: string) => ASSETS[d], denomDecimals: () => 6 }),
        useBalances: () => ({ assetsBalances: Object.values(ASSETS).map(a => ({ ...a, amount: new BigNumber(5_000_000) })) }),
        useBalance: () => ({ balance: { amount: new BigNumber(5_000_000) } }),
        useMaxSpendable: () => ({ inputValue: "5" }),
        useCanAffordTx: () => ({ canAfford: true }),
        useToast: () => ({ toast: { error: vi.fn() } }),
        useBZETx: () => ({ tx: vi.fn() }),
    };
});

import { BurnModal } from "./burn-modal";

const renderModal = (preselectedCoin?: string) =>
    render(<BurnModal isOpen onClose={vi.fn()} preselectedCoin={preselectedCoin}/>, {
        wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });

beforeEach(() => {
    // jsdom lacks what Chakra's Select (zag) touches when it opens.
    Element.prototype.scrollTo = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("BurnModal wording", () => {
    it("uses Lock wording for a preselected IBC coin", () => {
        renderModal("ibc/ABC");

        expect(screen.getByRole("heading", { name: "Lock ATOM" })).toBeInTheDocument();
        expect(screen.getByText("Amount of ATOM to Lock")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Lock it!/ })).toBeInTheDocument();
        expect(screen.getByText("Warning: locked forever")).toBeInTheDocument();
        expect(screen.queryByText(/Burn it!/)).not.toBeInTheDocument();
    });

    it("keeps Burn wording for a preselected native coin", () => {
        renderModal("ubze");

        expect(screen.getByRole("heading", { name: "Burn BZE" })).toBeInTheDocument();
        expect(screen.getByText("Amount of BZE to Burn")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Burn it!/ })).toBeInTheDocument();
        expect(screen.getByText("Warning: No Take-Backs!")).toBeInTheDocument();
    });

    it("starts with Burn wording and switches to Lock wording when an IBC coin is picked", async () => {
        const { default: userEvent } = await import("@testing-library/user-event");
        const user = userEvent.setup();
        renderModal();

        expect(screen.getByRole("heading", { name: "Burn your tokens" })).toBeInTheDocument();
        expect(screen.getByText("Select Token to Burn")).toBeInTheDocument();

        await user.click(screen.getByRole("combobox"));
        await user.click(await screen.findByText(/ATOM - /));

        expect(screen.getByRole("heading", { name: "Lock your tokens" })).toBeInTheDocument();
        expect(screen.getByText("Select Token to Lock")).toBeInTheDocument();
        expect(screen.getByText("Amount of ATOM to Lock")).toBeInTheDocument();
    });
});
