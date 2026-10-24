import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The Airdrop coins page: step 1 when the link names no target, else the target's flow (stubbed
// here; each flow has its own tests). The target lives in the URL.
const m = vi.hoisted(() => ({ query: new URLSearchParams(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => m.query, usePathname: () => "/airdrop" }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: vi.fn() }),
    useNavigationWithParams: () => ({ getQueryParam: (p: string) => m.query.get(p), replace: m.replace, navigate: vi.fn() }),
}));
vi.mock("@/components/airdrop/list-flow", () => ({
    ListAirdrop: ({ initialDenom }: { initialDenom?: string }) => <div data-testid="list-flow">{initialDenom}</div>,
}));
vi.mock("@/components/airdrop/stakers-flow", () => ({
    StakersAirdrop: ({ target, initialDenom, initialRewardId, initialPrize }: Record<string, string | undefined>) => (
        <div data-testid="stakers-flow">{[target, initialDenom, initialRewardId, initialPrize].join("|")}</div>
    ),
}));

import AirdropPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

beforeEach(() => {
    m.query = new URLSearchParams();
    m.replace.mockReset();
});

describe("Airdrop coins (/airdrop)", () => {
    it("asks who gets the coins, and puts the answer in the URL with the coin kept", async () => {
        m.query = new URLSearchParams({ prize: "uhoney" });
        render(<AirdropPage />, { wrapper });
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Airdrop coins");
        expect(screen.getAllByRole("radio").map(r => r.textContent)).toEqual([
            expect.stringContaining("A list of wallets"),
            expect.stringContaining("Stakers of a token"),
            expect.stringContaining("Liquidity providers"),
        ]);
        await userEvent.click(screen.getByRole("radio", { name: /Stakers of a token/ }));
        expect(m.replace).toHaveBeenCalledWith("/airdrop?to=stakers&prize=uhoney");
    });

    it("?to=list opens the list flow with the token from ?denom= or ?prize=", () => {
        m.query = new URLSearchParams({ to: "list", prize: "uhoney" });
        render(<AirdropPage />, { wrapper });
        expect(screen.getByTestId("list-flow")).toHaveTextContent("uhoney");
    });

    it("an old link's names reach the stakers flow: ?staking=, ?id=, ?gift=", () => {
        m.query = new URLSearchParams({ staking: "uhoney", id: "7", gift: "ubze" });
        render(<AirdropPage />, { wrapper });
        expect(screen.getByTestId("stakers-flow")).toHaveTextContent("stakers|uhoney|7|ubze");
    });

    it("a pool share's link opens the LP providers flow", () => {
        m.query = new URLSearchParams({ denom: "ulp_a_b" });
        render(<AirdropPage />, { wrapper });
        expect(screen.getByTestId("stakers-flow")).toHaveTextContent("lp|ulp_a_b");
    });
});
