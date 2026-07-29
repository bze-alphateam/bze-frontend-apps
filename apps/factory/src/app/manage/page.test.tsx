import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { MyToken } from "@/lib/my-tokens";

// Drive the manage page off useMyTokens; stub navigation, the sibling
// market/pool/rewards sections (they pull in chain hooks) and useToast (used by
// the inline TokenRow). No wallet/chain providers.
const { useMyTokensMock, navigateMock } = vi.hoisted(() => ({
    useMyTokensMock: vi.fn(),
    navigateMock: vi.fn(),
}));

vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => useMyTokensMock() }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
}));
vi.mock("@/components/manage/my-markets", () => ({ MyMarkets: () => null }));
vi.mock("@/components/manage/my-pools", () => ({ MyPools: () => null }));
vi.mock("@/components/manage/staking-rewards", () => ({ StakingRewards: () => null }));
// The badge legend repeats the words "Mintable" / "Fixed supply" in prose; stub
// it so those assertions match only the actual TrustBadge on each token row.
vi.mock("@/components/ui/info-box", () => ({ InfoBox: () => null }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
    };
});

import ManagePage from "./page";

function token(ticker: string, admin = ""): MyToken {
    const denom = `factory/bze1owner/u${ticker.toLowerCase()}`;
    return {
        admin,
        asset: {
            denom,
            ticker,
            name: `${ticker} Token`,
            type: "factory",
            decimals: 6,
            logo: "",
            stable: false,
            verified: false,
            supply: 1000000n,
        },
    } as MyToken;
}

function renderPage() {
    return render(<ManagePage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useMyTokensMock.mockReset();
    navigateMock.mockReset();
});

describe("Manage page", () => {
    it("shows the header and no empty/loaded content while loading", () => {
        useMyTokensMock.mockReturnValue({ tokens: [], isLoading: true });
        renderPage();

        expect(screen.getByText("My Creations")).toBeInTheDocument();
        expect(screen.queryByText("No tokens yet")).not.toBeInTheDocument();
    });

    it("shows the empty state when the address owns no tokens", () => {
        useMyTokensMock.mockReturnValue({ tokens: [], isLoading: false });
        renderPage();

        expect(screen.getByText("No tokens yet")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /Create your first token/ }),
        ).toBeInTheDocument();
    });

    it("lists a row per owned token once loaded, with the right trust badge", () => {
        useMyTokensMock.mockReturnValue({
            tokens: [token("HONEY", "bze1admin"), token("MILK", "")],
            isLoading: false,
        });
        renderPage();

        expect(screen.getByText("HONEY Token")).toBeInTheDocument();
        expect(screen.getByText("MILK Token")).toBeInTheDocument();
        expect(screen.queryByText("No tokens yet")).not.toBeInTheDocument();
        // Active admin -> Mintable; renounced admin ('') -> Fixed supply.
        expect(screen.getByText("Mintable")).toBeInTheDocument();
        expect(screen.getByText("Fixed supply")).toBeInTheDocument();
    });

    it("navigates to the token wizard from the New token button", async () => {
        const user = userEvent.setup();
        useMyTokensMock.mockReturnValue({ tokens: [], isLoading: false });
        renderPage();

        await user.click(screen.getByRole("button", { name: /New token/ }));
        expect(navigateMock).toHaveBeenCalledWith("/token/new");
    });
});
