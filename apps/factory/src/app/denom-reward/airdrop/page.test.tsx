import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The airdrop form off mocked hooks: query params, the DR state, chain params, wallet and the
// affordability engine. The asset picker becomes a plain button per prize denom; PayPanel has
// its own coverage and prints its rows here.
const { STAKING, queryParams, wallet, maxSpendable, useDenomRewardMock, navigateMock, txMock, affordMock } = vi.hoisted(() => ({
    STAKING: "factory/bze1owner/utok",
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1funder" as string | undefined },
    maxSpendable: { input: "41.5", balance: "42000000" },
    useDenomRewardMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    affordMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: queryParams.current.get("denom"),
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useDenomReward", () => ({ useDenomReward: () => useDenomRewardMock() }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: (fee?: { denom: string; amount: string }) => ({
        canPayFee: Boolean(fee),
        estimate: { resolvedFee: fee },
    }),
}));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, moduleFee, txKind, feeUnknown }: {
        rows: { label: string; coin?: { denom: string; amount: string }; text?: string; info?: ReactNode }[];
        moduleFee?: { amount: string };
        txKind?: string;
        feeUnknown?: boolean;
    }) => (
        <div data-testid="pay-panel">
            {feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}
            {moduleFee && ` | module ${moduleFee.amount}`}
            {` | ${txKind}`}
            {rows.map(r => r.info && <p key={r.label}>{r.info}</p>)}
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <div>
            <button onClick={() => onSelect({ denom: "ubze" })}>pick BZE</button>
            <button onClick={() => onSelect({ denom: "uatom" })}>pick ATOM</button>
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        [STAKING]: { denom: STAKING, ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uatom: { denom: "uatom", ticker: "ATOM", decimals: 6, logo: "" },
    };
    const fee = { denom: "ubze", amount: "25000000000" };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: () => ({ balance: { denom: "", amount: actual.toBigNumber(0) }, isLoading: false }),
        useMaxSpendable: () => ({
            amount: new BigNumber(maxSpendable.input).multipliedBy(1_000_000),
            inputValue: maxSpendable.input,
            balance: new BigNumber(maxSpendable.balance),
        }),
        useCanAffordTx: (input: unknown) => affordMock(input),
        useCreationFees: () => ({
            fees: { addDenomRewardScheduleFee: fee, createDenomRewardPrizeFee: fee },
            denomRewardLimits: { maxPrizeDenomsPerDr: 2 },
            isLoading: false,
        }),
        getChainExplorerURL: () => "https://explorer.test",
        getCommunitiesApp: () => ({ href: "https://communities.test" }),
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import DenomRewardAirdropPage from "./page";

const DR = { staking_denom: STAKING, lock: 7, min_stake: "0", staked_amount: "500000000" };
const BZE_PRIZE = { staking_denom: STAKING, prize_denom: "ubze", distributed_stake: "0.5", last_distribution_epoch: "10" };
const HOLDER_REWARDS = `/denom-reward/token?denom=${encodeURIComponent(STAKING)}`;

function renderPage() {
    return render(<DenomRewardAirdropPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const drState = (overrides: Record<string, unknown> = {}) => ({
    denomReward: DR,
    schedules: [],
    prizes: [BZE_PRIZE],
    isLoading: false,
    hasError: false,
    refresh: vi.fn(),
    ...overrides,
});

const setParams = (params: Record<string, string>) => {
    queryParams.current = new URLSearchParams({ denom: STAKING, ...params });
};

beforeEach(() => {
    setParams({});
    wallet.address = "bze1funder";
    maxSpendable.input = "41.5";
    maxSpendable.balance = "42000000";
    useDenomRewardMock.mockReset().mockReturnValue(drState());
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: unknown) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
    affordMock.mockReset().mockReturnValue({ canAfford: true, isLoading: false, message: "", shortfalls: [] });
});

const submitButton = () => screen.getByRole("button", { name: /Airdrop now/ });
const question = (title: string) => screen.getByRole("region", { name: title });
const payPanel = () => screen.getByTestId("pay-panel");
const GIVE = "What do you give?";
const HOW_MUCH = "How much?";
const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));

async function answerAll(prize: "BZE" | "ATOM", amount: string) {
    await userEvent.click(screen.getByText(`pick ${prize}`));
    await continueIn(GIVE);
    await userEvent.type(screen.getByLabelText(/Amount/), amount);
    await continueIn(HOW_MUCH);
}

describe("Gift stakers, once", { timeout: 20_000 }, () => {
    it("shows the goal title, the tech tag and the back link to the holder rewards", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Gift TOK stakers, once/ })).toBeInTheDocument();
        expect(screen.getByText("Split an amount between everyone staking TOK right now.")).toBeInTheDocument();
        expect(screen.getByText("rewards · distribute denom rewards")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Back to TOK's holder rewards" }));
        expect(navigateMock).toHaveBeenCalledWith(HOLDER_REWARDS);
    });

    it("discloses the irreversible split, charges no prize fee for a prize the DR already pays and signs MsgDistributeDenomRewards", async () => {
        renderPage();
        await answerAll("BZE", "12.5");

        expect(within(question(GIVE)).getByText("BZE")).toBeInTheDocument();
        expect(within(question(HOW_MUCH)).getByText("12.5 BZE")).toBeInTheDocument();
        expect(screen.getByTestId("airdrop-outcome")).toHaveTextContent(
            "12.5 BZE leaves your wallet now and is split between everyone staking TOK, based on how much each one stakes. It can't be taken back, and it doesn't start a daily prize. You don't need to own TOK or ask its creator.",
        );
        expect(payPanel()).toHaveTextContent("The gift: 12500000 ubze, Prize fee: None | distribute-denom-rewards");
        expect(payPanel()).not.toHaveTextContent("module");
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spec: "distribute-denom-rewards",
            spend: [{ denom: "ubze", amount: "12500000" }],
            moduleFee: undefined,
        }));

        await userEvent.click(submitButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgDistributeDenomRewards");
        expect(msgs[0].value).toEqual({ creator: "bze1funder", denom: STAKING, prizeDenom: "ubze", amount: "12500000" });
    });

    it("charges the one-time prize fee for a prize token new to the DR, counted in the balance check", async () => {
        renderPage();
        await answerAll("ATOM", "3");

        expect(payPanel()).toHaveTextContent("The gift: 3000000 uatom, New prize fee: 25000000000 ubze | module 25000000000");
        expect(within(payPanel()).getByText(
            "The first time a token becomes a prize on TOK it takes one of TOK's 2 prize slots (2 of 2 after this), for good. Gifting ATOM to TOK again is free.",
        )).toBeInTheDocument();
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spend: [{ denom: "uatom", amount: "3000000" }],
            moduleFee: { denom: "ubze", amount: "25000000000" },
        }));
        expect(submitButton()).toBeEnabled();
    });

    it("shows what someone with 1% of the stake gets", async () => {
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await continueIn(GIVE);
        await userEvent.type(screen.getByLabelText(/Amount/), "250");

        expect(screen.getByTestId("airdrop-example")).toHaveTextContent(
            "Split by stake: someone with 1% of the staked TOK gets 2.5 BZE.",
        );
    });

    it("Max fills the spendable balance, shown as \"of <balance>\"", async () => {
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await continueIn(GIVE);

        expect(screen.getByTestId("airdrop-balance")).toHaveTextContent("of 42 BZE");
        await userEvent.click(screen.getByRole("button", { name: "Max" }));
        expect(screen.getByLabelText(/Amount/)).toHaveValue("41.5");
    });

    it("refuses a DR nobody is staking, with the chain's reason", async () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: { ...DR, staked_amount: "0" } }));
        renderPage();
        expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent(/no one to pay/);

        await answerAll("BZE", "1");
        expect(submitButton()).toBeDisabled();
        await userEvent.click(submitButton());
        expect(txMock).not.toHaveBeenCalled();
    });

    it("blocks a new prize token once the cap is reached, with no fee row", async () => {
        useDenomRewardMock.mockReturnValue(drState({
            prizes: [BZE_PRIZE, { ...BZE_PRIZE, prize_denom: "ufoo" }],
        }));
        renderPage();
        await userEvent.click(screen.getByText("pick ATOM"));

        expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent(/maximum number of prize tokens/);
        expect(within(question(GIVE)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(payPanel()).not.toHaveTextContent("prize fee");
        expect(submitButton()).toBeDisabled();
    });

    it("blocks when the wallet can't cover amount + fee + gas", async () => {
        affordMock.mockReturnValue({ canAfford: false, isLoading: false, message: "Not enough BZE", shortfalls: [] });
        renderPage();
        await answerAll("BZE", "1");

        expect(screen.getByRole("alert")).toHaveTextContent("Not enough BZE");
        expect(submitButton()).toBeDisabled();
    });

    it("asks a wallet-less visitor to connect", async () => {
        wallet.address = undefined;
        renderPage();
        await answerAll("BZE", "1");

        expect(screen.getByText("Connect your wallet to airdrop.")).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
    });

    it("explains a token without a denom reward", () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: undefined, prizes: [] }));
        renderPage();

        expect(screen.getByText("No holder rewards yet")).toBeInTheDocument();
    });

    it("on success says what was sent, links the tx and the Communities page, and ends on the holder rewards", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        renderPage();
        await answerAll("BZE", "12.5");
        await userEvent.click(submitButton());

        expect(screen.getByText("12.5 BZE sent to TOK stakers")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /View transaction/ }));
        expect(open).toHaveBeenCalledWith("https://explorer.test/tx/HASH1", "_blank", "noopener,noreferrer");
        await userEvent.click(screen.getByRole("button", { name: /See it on TOK's Communities page/ }));
        expect(open).toHaveBeenLastCalledWith(`https://communities.test/token?denom=${encodeURIComponent(STAKING)}`, "_blank", "noopener,noreferrer");
        open.mockRestore();

        await userEvent.click(screen.getByRole("button", { name: "Back to TOK's holder rewards" }));
        expect(navigateMock).toHaveBeenCalledWith(HOLDER_REWARDS);
    });

    it("Airdrop again starts a fresh form", async () => {
        renderPage();
        await answerAll("BZE", "12.5");
        await userEvent.click(submitButton());
        await userEvent.click(screen.getByRole("button", { name: "Airdrop again" }));

        expect(screen.getByRole("heading", { name: /Gift TOK stakers, once/ })).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
    });

    it("on success the primary button goes to the return path when one is given", async () => {
        setParams({ return: "/manage/token?denom=x&tab=rewards", returnLabel: "the token" });
        renderPage();
        expect(screen.getByRole("button", { name: "Back to the token" })).toBeInTheDocument();

        await answerAll("BZE", "1");
        await userEvent.click(submitButton());

        await userEvent.click(screen.getByRole("button", { name: "Back to the token" }));
        expect(navigateMock).toHaveBeenCalledWith("/manage/token?denom=x&tab=rewards");
    });
});
