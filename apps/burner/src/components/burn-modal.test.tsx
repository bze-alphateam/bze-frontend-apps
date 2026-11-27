import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The modal reads the wallet, assets, balances and affordability from hooks; they are fed
// directly. The paused list is what is under test: the real notice and button stay.
const { pausedMock } = vi.hoisted(() => ({ pausedMock: { urls: [] as string[] } }));

const BZE = { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" };

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1user" }) }));
vi.mock("@/components/ui/asset_logo", () => ({ AssetLogo: () => null }));
vi.mock("@/components/ui/burner/dialog", async () => {
    const actual = await vi.importActual<typeof import("@/components/ui/burner/dialog")>("@/components/ui/burner/dialog");
    return {
        ...actual,
        BurnerDialog: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div>{children}{footer}</div>,
    };
});
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        getChainName: () => "beezee",
        useToast: () => ({ toast: { error: vi.fn() } }),
        useBZETx: () => ({ tx: vi.fn() }),
        useAssets: () => ({ getAsset: () => BZE, denomDecimals: () => 6 }),
        useBalances: () => ({ assetsBalances: [] }),
        useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber(100_000_000) } }),
        useMaxSpendable: () => ({ inputValue: "100" }),
        useCanAffordTx: () => ({ canAfford: true, message: "" }),
        usePausedMessages: (urls: string[]) => {
            const paused = urls.filter(u => pausedMock.urls.includes(u));
            return { paused, isPaused: paused.length > 0 };
        },
    };
});

import { BurnModal } from "./burn-modal";

const NOTICE = "This action is paused on BeeZee for now.";

function renderAndFill() {
    render(<BurnModal isOpen onClose={vi.fn()} preselectedCoin="ubze" />, {
        wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
    fireEvent.change(screen.getByPlaceholderText("0.00 BZE"), { target: { value: "5" } });
}

describe("BurnModal with the burn message paused", () => {
    beforeEach(() => {
        pausedMock.urls = [];
    });

    it("shows the notice and disables Burn it! when MsgFundBurner is on the disable list", () => {
        pausedMock.urls = ["/bze.burner.MsgFundBurner"];
        renderAndFill();

        expect(screen.getByText(NOTICE)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Burn it!/ }).hasAttribute("disabled")).toBe(true);
    });

    it("is unchanged when another message type is paused", () => {
        pausedMock.urls = ["/bze.burner.MsgJoinRaffle"];
        renderAndFill();

        expect(screen.queryByText(NOTICE)).toBeNull();
        expect(screen.getByRole("button", { name: /Burn it!/ }).hasAttribute("disabled")).toBe(false);
    });

    it("is unchanged when nothing is paused", () => {
        renderAndFill();

        expect(screen.queryByText(NOTICE)).toBeNull();
        expect(screen.getByRole("button", { name: /Burn it!/ }).hasAttribute("disabled")).toBe(false);
    });
});
