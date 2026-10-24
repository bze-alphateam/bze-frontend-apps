import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// Choose staking rewards (BFE-260): simple vs compounded with their fees (in USD when BZE has a
// price), the compounded reward's prize cap from the chain, and the staked token handed on.
const m = vi.hoisted(() => ({
    query: new URLSearchParams(),
    fees: {} as Record<string, unknown>,
    bzeUsd: 0,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/create/rewards",
    useSearchParams: () => m.query,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useCreationFees: () => ({ fees: m.fees, denomRewardLimits: { maxPrizeDenomsPerDr: 40 }, isLoading: false }),
    useAsset: (denom: string) => ({ asset: denom === "ubze" ? { denom, ticker: "BZE", decimals: 6 } : undefined, isLoading: false }),
    useAssetPrice: () => ({
        hasPrice: m.bzeUsd > 0,
        uAmountUsdValue: (amount: BigNumber, decimals: number) => amount.shiftedBy(-decimals).multipliedBy(m.bzeUsd),
    }),
}));

import ChooseRewardsPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<ChooseRewardsPage />, { wrapper });
const card = (name: string) => within(screen.getByRole("region", { name }));

const HONEY = "factory/bze1x/uhoney";
const ENC = encodeURIComponent(HONEY);

beforeEach(() => {
    m.query = new URLSearchParams();
    m.bzeUsd = 0;
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

    it("has no intro sentence under the question", () => {
        renderPage();
        expect(screen.queryByText(/Both pay people who stake a token/)).not.toBeInTheDocument();
    });

    it("describes each reward in one line, with no example or facts", () => {
        renderPage();
        const simple = card("Simple reward");
        expect(simple.getByText("Pays stakers a fixed amount in one coin every day, for as many days as you choose. You can extend it as often as you like.")).toBeInTheDocument();
        expect(simple.getByRole("link", { name: /Create simple reward/ })).toHaveAttribute("href", "/reward/new");

        const compounded = card("Compounded reward");
        expect(compounded.getByText("Pays stakers every day in up to 40 coins. Anyone can add more daily prizes or airdrop to its stakers.")).toBeInTheDocument();
        expect(compounded.getByRole("link", { name: "Make a token stakable" })).toHaveAttribute("href", "/denom-reward/new");

        expect(screen.queryByRole("term")).not.toBeInTheDocument();
        expect(screen.queryByText("Reward tokens")).not.toBeInTheDocument();
        expect(screen.queryByText(/Stake HONEY/)).not.toBeInTheDocument();
    });

    it("shows each fee without USD when the token has no price", () => {
        renderPage();
        expect(card("Simple reward").getByTestId("fee-line")).toHaveTextContent(/^Creation fee 5,000 BZE · \+ network fee$/);
        expect(card("Compounded reward").getByTestId("fee-line")).toHaveTextContent(/^Creation fee 25,000 BZE · \+ network fee$/);
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it("shows each fee in USD when the token has a price", () => {
        m.bzeUsd = 0.002;
        renderPage();
        expect(card("Simple reward").getByTestId("fee-line")).toHaveTextContent("Creation fee 5,000 BZE · ≈ $10 · + network fee");
        expect(card("Compounded reward").getByTestId("fee-line")).toHaveTextContent("Creation fee 25,000 BZE · ≈ $50 · + network fee");
    });

    it("says Fee unavailable for a fee the chain didn't give", () => {
        m.fees = { createStakingRewardFee: { denom: "ubze", amount: "5000000000" } };
        renderPage();
        expect(card("Simple reward").getByTestId("fee-line")).toHaveTextContent("5,000 BZE");
        expect(card("Compounded reward").getByTestId("fee-line")).toHaveTextContent("Fee unavailable");
    });

    it("has nothing about rewards that already exist: picking one in the wizard continues it", () => {
        renderPage();
        expect(screen.queryByText("Already created a reward?")).not.toBeInTheDocument();
        expect(screen.getAllByTestId("option-card")).toHaveLength(2);
    });

    it.each([["denom"], ["staking"]])("hands ?%s= on to every form, in the name each form reads", (param) => {
        m.query = new URLSearchParams({ [param]: HONEY });
        renderPage();
        expect(card("Simple reward").getByRole("link", { name: /Create simple reward/ })).toHaveAttribute("href", `/reward/new?staking=${ENC}`);
        expect(card("Compounded reward").getByRole("link", { name: "Make a token stakable" })).toHaveAttribute("href", `/denom-reward/new?denom=${ENC}`);
    });
});
