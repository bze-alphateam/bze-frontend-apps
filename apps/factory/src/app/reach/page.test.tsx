import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// "Reach another community" off mocked hooks: every compounded reward on the chain, the picked one's
// prizes, chain params, wallet and the affordability engine. The gift picker becomes a plain
// button per denom; PayPanel has its own coverage and prints its rows here.
const { AAA, MINE, GIFT, COLD, m, navigateMock, txMock, affordMock } = vi.hoisted(() => ({
    AAA: "factory/bze1other/aaa",
    MINE: "factory/bze1me/mine",
    GIFT: "factory/bze1me/gift",
    COLD: "factory/bze1other/cold",
    m: {
        params: new URLSearchParams(),
        address: "bze1me" as string | undefined,
        list: undefined as unknown[] | undefined,
        isLoading: false,
        prizes: {} as Record<string, unknown[]>,
    },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    affordMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => m.params }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: m.params.get("denom"),
        getQueryParam: (p: string) => m.params.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useAllDenomRewards", () => ({
    useAllDenomRewards: () => ({ list: m.list, isLoading: m.isLoading, hasError: false, retry: vi.fn() }),
}));
vi.mock("@/hooks/useDenomReward", () => ({
    useDenomReward: (denom: string) => {
        const dr = (m.list ?? []).find(d => (d as { staking_denom: string }).staking_denom === denom);
        return { denomReward: dr, schedules: [], prizes: m.prizes[denom] ?? [], isLoading: false, hasError: false, refresh: vi.fn() };
    },
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: (fee?: { denom: string; amount: string }) => ({
        canPayFee: Boolean(fee),
        estimate: { resolvedFee: fee },
    }),
}));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, moduleFee, txKind }: {
        rows: { label: string; coin?: { denom: string; amount: string }; text?: string; info?: ReactNode }[];
        moduleFee?: { amount: string };
        txKind?: string;
    }) => (
        <div data-testid="pay-panel">
            {rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}
            {moduleFee && ` | module ${moduleFee.amount}`}
            {` | ${txKind}`}
            {rows.map(r => r.info && <p key={r.label}>{r.info}</p>)}
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <div>
            <button onClick={() => onSelect({ denom: "ubze" })}>give BZE</button>
            <button onClick={() => onSelect({ denom: "uatom" })}>give ATOM</button>
            <button onClick={() => onSelect({ denom: GIFT })}>give GIFT</button>
            <button onClick={() => onSelect({ denom: MINE })}>give MINE</button>
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        [AAA]: { denom: AAA, ticker: "AAA", name: "Triple A", decimals: 6, logo: "" },
        [MINE]: { denom: MINE, ticker: "MINE", name: "My token", decimals: 6, logo: "" },
        [GIFT]: { denom: GIFT, ticker: "GIFT", name: "Gift token", decimals: 6, logo: "" },
        [COLD]: { denom: COLD, ticker: "COLD", name: "Nobody stakes", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uatom: { denom: "uatom", ticker: "ATOM", decimals: 6, logo: "" },
    };
    const fee = { denom: "ubze", amount: "25000000000" };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssets: () => ({ getAsset: (denom: string) => assets[denom] }),
        useAssetsContext: () => ({ usdPricesMap: new Map() }),
        useMaxSpendable: () => ({ amount: new BigNumber(10_000_000), inputValue: "10", balance: new BigNumber(10_000_000) }),
        useCanAffordTx: (input: unknown) => affordMock(input),
        useCreationFees: () => ({
            fees: { addDenomRewardScheduleFee: fee, createDenomRewardPrizeFee: fee },
            denomRewardLimits: { maxPrizeDenomsPerDr: 2 },
            isLoading: false,
        }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        getCommunitiesApp: () => ({ href: "https://communities.test" }),
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import ReachPage from "./page";

const dr = (denom: string, staked: string) => ({ staking_denom: denom, lock: 7, min_stake: "0", staked_amount: staked });
const prize = (stake: string, denom: string) => ({ staking_denom: stake, prize_denom: denom, distributed_stake: "0", last_distribution_epoch: "0" });

function renderPage() {
    return render(<ReachPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    m.params = new URLSearchParams();
    m.address = "bze1me";
    m.list = [dr(AAA, "100000000"), dr(COLD, "0"), dr(MINE, "500000000")];
    m.isLoading = false;
    m.prizes = { [AAA]: [prize(AAA, "ubze")], [MINE]: [] };
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: unknown) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
    affordMock.mockReset().mockReturnValue({ canAfford: true, isLoading: false, message: "", shortfalls: [] });
});

const question = (title: string) => screen.getByRole("region", { name: title });
const payPanel = () => screen.getByTestId("pay-panel");
const COMMUNITY = "Which community?";
const GIVE = "What do you give them?";
const MODE = "All at once, or a little every day?";
const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));

async function pickCommunity(ticker = "AAA") {
    await userEvent.click(screen.getByRole("radio", { name: ticker }));
    await continueIn(COMMUNITY);
}

async function giveAmount(gift: "BZE" | "ATOM" | "GIFT" | "MINE", amount: string) {
    await userEvent.click(screen.getByText(`give ${gift}`));
    await userEvent.type(screen.getByLabelText(/Amount|Per day/), amount);
    await continueIn(GIVE);
}

describe("Reach another community", { timeout: 20_000 }, () => {
    it("lists only the tokens with stakers, most staked first, with your own marked Yours", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Reach another community" })).toBeInTheDocument();

        const options = screen.getAllByTestId("community-option");
        expect(options.map(o => o.getAttribute("aria-label"))).toEqual(["MINE", "AAA"]);
        expect(options[0]).toHaveTextContent("Yours");
        expect(options[0]).toHaveTextContent("500 MINE staked");
        expect(options[1]).not.toHaveTextContent("Yours");
        expect(options[1]).toHaveTextContent("Triple A");
    });

    it("searches the communities", async () => {
        renderPage();
        await userEvent.type(screen.getByLabelText("Search communities"), "triple");
        expect(screen.getAllByTestId("community-option").map(o => o.getAttribute("aria-label"))).toEqual(["AAA"]);
    });

    it("with nobody staking anywhere, points to multi-send", async () => {
        m.list = [dr(COLD, "0")];
        renderPage();
        expect(screen.getByTestId("reach-empty")).toHaveTextContent("No token has stakers yet, so there is nobody to reach this way.");
        await userEvent.click(screen.getByRole("button", { name: "Send to a list of wallets" }));
        expect(navigateMock).toHaveBeenCalledWith("/multisend");
    });

    it("all at once: airdrops the gift on the community, with the 1% example", async () => {
        renderPage();
        await pickCommunity();
        expect(within(question(COMMUNITY)).getByText("AAA stakers · 100 AAA staked")).toBeInTheDocument();

        await userEvent.click(screen.getByText("give BZE"));
        await userEvent.type(screen.getByLabelText(/Amount/), "200");
        expect(screen.getByTestId("reach-example")).toHaveTextContent("Split by stake: someone with 1% of the staked AAA gets 2 BZE.");
        await continueIn(GIVE);
        await continueIn(MODE);

        expect(screen.getByTestId("reach-outcome")).toHaveTextContent(
            "200 BZE leaves your wallet now and is split between everyone staking AAA, based on how much each one stakes. It can't be taken back. You don't need to own AAA or ask its creator.",
        );
        expect(screen.getByText("Compounded reward · airdrop on AAA")).toBeInTheDocument();
        expect(payPanel()).toHaveTextContent("The gift: 200000000 ubze, Prize fee: None | distribute-denom-rewards");

        await userEvent.click(screen.getByRole("button", { name: "Send the gift" }));
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgDistributeDenomRewards");
        expect(msgs[0].value).toEqual({ creator: "bze1me", denom: AAA, prizeDenom: "ubze", amount: "200000000" });

        expect(screen.getByText("Your gift is on its way to AAA stakers")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("data-app", "communities");
        await userEvent.click(screen.getByRole("button", { name: "Reach another community" }));
        expect(screen.getByRole("heading", { name: "Reach another community" })).toBeInTheDocument();
    });

    it("every day: starts a daily prize on the community for N days", async () => {
        renderPage();
        await pickCommunity();
        await giveAmount("BZE", "2");
        await userEvent.click(screen.getByRole("radio", { name: /Every day for 30 days/ }));
        const days = screen.getByLabelText("Days");
        await userEvent.clear(days);
        await userEvent.type(days, "10");
        await continueIn(MODE);

        expect(within(question(MODE)).getByText("Every day for 10 days")).toBeInTheDocument();
        expect(within(question(GIVE)).getByText("2 BZE a day")).toBeInTheDocument();
        expect(screen.getByTestId("reach-outcome")).toHaveTextContent(
            "20 BZE leaves your wallet now and is paid as 2 BZE a day for 10 payout days to everyone staking AAA. It can't be cancelled.",
        );
        expect(screen.getByText("Compounded reward · daily prize on AAA")).toBeInTheDocument();
        expect(payPanel()).toHaveTextContent("Locked for prizes: 20000000 ubze, Daily prize fee: 25000000000 ubze | module 25000000000 | create-denom-reward-schedule");

        await userEvent.click(screen.getByRole("button", { name: "Start the daily gift" }));
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomRewardSchedule");
        expect(msgs[0].value).toEqual({ creator: "bze1me", denom: AAA, prizeDenom: "ubze", dailyAmount: "2000000", duration: "10" });
    });

    it("charges the new prize fee, with the slot text, when the gift is new to the community", async () => {
        renderPage();
        await pickCommunity();
        await giveAmount("ATOM", "5");
        await continueIn(MODE);

        expect(payPanel()).toHaveTextContent("The gift: 5000000 uatom, New prize fee: 25000000000 ubze | module 25000000000");
        expect(within(payPanel()).getByText(
            "The first time a token becomes a prize on AAA it takes one of AAA's 2 prize slots (2 of 2 after this), for good. Gifting ATOM to AAA again is free.",
        )).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Send the gift" })).toBeEnabled();
    });

    it("blocks a new gift once the community's prize slots are full", async () => {
        m.prizes[AAA] = [prize(AAA, "ubze"), prize(AAA, "ufoo")];
        renderPage();
        await pickCommunity();
        await userEvent.click(screen.getByText("give ATOM"));

        expect(screen.getByTestId("reach-blocker")).toHaveTextContent(/maximum number of prize tokens/);
        expect(within(question(GIVE)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Send the gift" })).toBeDisabled();
    });

    it("tips to make your own gift stakable only when it has no compounded reward", async () => {
        renderPage();
        await pickCommunity();

        await userEvent.click(screen.getByText("give BZE"));
        expect(screen.queryByTestId("reach-stakable-tip")).not.toBeInTheDocument();
        await userEvent.click(screen.getByText("give MINE"));
        expect(screen.queryByTestId("reach-stakable-tip")).not.toBeInTheDocument();

        await userEvent.click(screen.getByText("give GIFT"));
        expect(screen.getByTestId("reach-stakable-tip")).toHaveTextContent(
            "Make GIFT stakable before you do this, so the people who receive it have a reason to keep it.",
        );
        await userEvent.click(screen.getByRole("button", { name: "Make GIFT stakable" }));
        expect(navigateMock).toHaveBeenCalledWith(`/denom-reward/token?denom=${encodeURIComponent(GIFT)}`);
    });

    it("preselects ?community= and ?gift=", () => {
        m.params = new URLSearchParams({ community: AAA, gift: "uatom" });
        renderPage();

        expect(question(COMMUNITY)).toHaveAttribute("data-state", "done");
        expect(within(question(COMMUNITY)).getByText("AAA stakers · 100 AAA staked")).toBeInTheDocument();
        expect(question(GIVE)).toHaveAttribute("data-state", "active");
        expect(screen.getByLabelText(/Amount \(ATOM\)/)).toBeInTheDocument();
    });

    it("asks a wallet-less visitor to connect", async () => {
        m.address = undefined;
        renderPage();
        await pickCommunity();

        expect(screen.getByText("Connect your wallet to send the gift.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Send the gift" })).toBeDisabled();
    });

    it("blocks when the wallet can't cover the gift + fees + gas", async () => {
        affordMock.mockReturnValue({ canAfford: false, isLoading: false, message: "Not enough BZE", shortfalls: [] });
        renderPage();
        await pickCommunity();
        await giveAmount("BZE", "1");
        await continueIn(MODE);

        expect(screen.getByRole("alert")).toHaveTextContent("Not enough BZE");
        expect(screen.getByRole("button", { name: "Send the gift" })).toBeDisabled();
    });
});
