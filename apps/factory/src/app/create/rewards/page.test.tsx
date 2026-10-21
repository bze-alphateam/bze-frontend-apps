import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// Choose staking rewards (BFE-260): simple vs compounded with their fees, the three ways to add
// to an existing reward, and the staked token handed on.
const m = vi.hoisted(() => ({
    query: new URLSearchParams(),
    fees: {} as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/create/rewards",
    useSearchParams: () => m.query,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useCreationFees: () => ({ fees: m.fees, isLoading: false }),
    useAsset: (denom: string) => ({ asset: denom === "ubze" ? { denom, ticker: "BZE", decimals: 6 } : undefined, isLoading: false }),
}));

import ChooseRewardsPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<ChooseRewardsPage />, { wrapper });
const card = (name: string) => within(screen.getByRole("region", { name }));
const existing = () => within(screen.getByRole("region", { name: "Add to a reward that already exists" }));

const HONEY = "factory/bze1x/uhoney";
const ENC = encodeURIComponent(HONEY);

beforeEach(() => {
    m.query = new URLSearchParams();
    m.fees = {
        createStakingRewardFee: { denom: "ubze", amount: "5000000000" },
        createDenomRewardFee: { denom: "ubze", amount: "25000000000" },
    };
});

describe("Choose staking rewards", () => {
    it("asks which kind of reward, under Create / Staking rewards", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Which kind of reward?");
        expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Staking rewards")).toBeInTheDocument();
    });

    it("compares the simple and the compounded reward, each with its own fee", () => {
        renderPage();
        const simple = card("Simple reward");
        expect(simple.getByText("One reward token, a fixed daily budget, a set number of days.")).toBeInTheDocument();
        expect(simple.getByText("Everything up front: daily budget × days")).toBeInTheDocument();
        expect(simple.getByTestId("fee-line")).toHaveTextContent("Creation fee 5,000 BZE + network fee");
        expect(simple.getByRole("link", { name: /Create simple reward/ })).toHaveAttribute("href", "/reward/new");

        const compounded = card("Compounded reward");
        expect(compounded.getByText("Only one. If it exists, you add prizes to it")).toBeInTheDocument();
        expect(compounded.getByTestId("fee-line")).toHaveTextContent("Creation fee 25,000 BZE + network fee");
        expect(compounded.getByRole("link", { name: /Create compounded reward/ })).toHaveAttribute("href", "/denom-reward/new");
    });

    it("says Fee unavailable for a fee the chain didn't give", () => {
        m.fees = { createStakingRewardFee: { denom: "ubze", amount: "5000000000" } };
        renderPage();
        expect(card("Simple reward").getByTestId("fee-line")).toHaveTextContent("5,000 BZE");
        expect(card("Compounded reward").getByTestId("fee-line")).toHaveTextContent("Fee unavailable");
    });

    it("lists the three ways to add to any existing reward", () => {
        renderPage();
        expect(existing().getByText("Anyone can do these on any reward. Funding one doesn't make you its owner.")).toBeInTheDocument();
        expect(existing().getByRole("link", { name: /Extend a simple reward/ })).toHaveAttribute("href", "/reward/extend");
        expect(existing().getByRole("link", { name: /Add a daily prize/ })).toHaveAttribute("href", "/denom-reward/schedule");
        expect(existing().getByRole("link", { name: /Airdrop to stakers, once/ })).toHaveAttribute("href", "/denom-reward/airdrop");
    });

    it.each([["denom"], ["staking"]])("hands ?%s= on to every form, in the name each form reads", (param) => {
        m.query = new URLSearchParams({ [param]: HONEY });
        renderPage();
        expect(card("Simple reward").getByRole("link", { name: /Create simple reward/ })).toHaveAttribute("href", `/reward/new?staking=${ENC}`);
        expect(card("Compounded reward").getByRole("link", { name: /Create compounded reward/ })).toHaveAttribute("href", `/denom-reward/new?denom=${ENC}`);
        expect(existing().getByRole("link", { name: /Add a daily prize/ })).toHaveAttribute("href", `/denom-reward/schedule?denom=${ENC}`);
        expect(existing().getByRole("link", { name: /Airdrop to stakers, once/ })).toHaveAttribute("href", `/denom-reward/airdrop?denom=${ENC}`);
    });
});
