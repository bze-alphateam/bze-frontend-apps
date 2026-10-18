import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, fees, balances, the fee engine and
// the tx hook. The asset picker becomes a plain button per denom; PayPanel has its own coverage.
const { queryParams, wallet, feeState, balances, payment, navigateMock, txMock } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    feeState: { fee: { denom: "ubze", amount: "25000000" } as { denom: string; amount: string } | undefined },
    balances: { current: {} as Record<string, string> },
    payment: { paysWithAlt: false },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        paysWithAlt: payment.paysWithAlt,
        isLoading: false,
        gasFee: { denom: "ubze", amount: new BigNumber(0) },
    }),
}));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows }: { rows: { label: string; coin?: { denom: string; amount: string } }[] }) => (
        <div data-testid="pay-panel">{rows.map(r => `${r.label}: ${r.coin?.amount} ${r.coin?.denom}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, includeLP, onSelect }: { label: string; includeLP?: boolean; onSelect: (a: { denom: string }) => void }) => (
        <div>
            <span>{label}</span>
            {["utok", "ubze", ...(includeLP ? ["ulp/abc"] : [])].map(d => (
                <button key={d} onClick={() => onSelect({ denom: d })}>{label}: {d}</button>
            ))}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        "ulp/abc": { denom: "ulp/abc", ticker: "TOK/BZE LP", decimals: 12, logo: "" },
    };
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: new BN(balances.current[denom] ?? "0") }, isLoading: false }),
        useCreationFees: () => ({ fees: { createStakingRewardFee: feeState.fee }, isLoading: false }),
        getStakingApp: () => ({ href: "https://staking.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import RewardNewPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<RewardNewPage />, { wrapper });
const startButton = () => screen.getByRole("button", { name: "Start the program" });
const question = (title: string) => screen.getByRole("region", { name: title });
const STAKE = "What do people stake?";
const PRIZE = "What do they earn, and for how long?";
const RULES = "Rules for stakers";

const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));

async function answerStake(denom = "ulp/abc") {
    await userEvent.click(within(question(STAKE)).getByText(`Token people stake: ${denom}`));
    await continueIn(STAKE);
}

async function answerPrize(prize: string, days: string, denom = "utok") {
    const q = question(PRIZE);
    await userEvent.click(within(q).getByText(`Prize (paid from your wallet): ${denom}`));
    await userEvent.type(within(q).getByLabelText(/Prize per day/), prize);
    await userEvent.type(within(q).getByLabelText(/For how many days/), days);
}

async function answerRules(lock: string, minStake: string) {
    const q = question(RULES);
    const lockInput = within(q).getByLabelText(/Lock period/);
    await userEvent.clear(lockInput);
    await userEvent.type(lockInput, lock);
    if (minStake) await userEvent.type(within(q).getByLabelText(/Minimum stake/), minStake);
    await continueIn(RULES);
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    feeState.fee = { denom: "ubze", amount: "25000000" };
    balances.current = { utok: "1000000000", ubze: "1000000000" };
    payment.paysWithAlt = false;
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: unknown) => void }) => {
        opts.onSuccess({
            txhash: "HASH1",
            events: [{ type: "bze.rewards.StakingRewardCreateEvent", attributes: [{ key: "reward_id", value: "\"0000000000000007\"" }] }],
        });
    });
});

describe("Run a campaign with an end date (/reward/new)", { timeout: 20_000 }, () => {
    it("asks the three questions in order and signs the msg in base units", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Run a campaign with an end date/ })).toBeInTheDocument();
        expect(screen.getByText("rewards · staking reward")).toBeInTheDocument();
        expect(question(STAKE)).toHaveAttribute("data-state", "active");
        expect(question(PRIZE)).toHaveAttribute("data-state", "todo");
        expect(question(RULES)).toHaveAttribute("data-state", "todo");
        // Stakers may pick LP tokens; the prize picker has none.
        expect(screen.getByText("Token people stake: ulp/abc")).toBeInTheDocument();

        await answerStake();
        expect(question(STAKE)).toHaveTextContent("TOK/BZE LP");
        expect(screen.queryByText("Prize (paid from your wallet): ulp/abc")).not.toBeInTheDocument();

        await answerPrize("1.5", "30");
        expect(within(question(PRIZE)).getByText("45 TOK")).toBeInTheDocument();
        await continueIn(PRIZE);
        expect(question(PRIZE)).toHaveTextContent("1.5 TOK a day for 30 days");

        await answerRules("7", "2.5");
        expect(question(RULES)).toHaveTextContent("lock 7 days · minimum 2.5 TOK/BZE LP");

        const outcome = screen.getByRole("region", { name: "What will happen" });
        expect(outcome).toHaveTextContent(
            "45 TOK leaves your wallet now and is paid out as 1.5 TOK a day for 30 days to everyone staking TOK/BZE LP. It can't be withdrawn. Anyone can add more days later.",
        );
        expect(screen.getByTestId("pay-panel")).toHaveTextContent(
            "Locked upfront for prizes: 45000000 utok, Staking program fee: 25000000 ubze",
        );

        await userEvent.click(startButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateStakingReward");
        expect(msgs[0].value).toMatchObject({
            creator: "bze1me",
            prizeAmount: "1500000",
            prizeDenom: "utok",
            stakingDenom: "ulp/abc",
            duration: "30",
            // LP tokens have 12 decimals.
            minStake: "2500000000000",
            lock: "7",
        });
    });

    it("sends minStake '0' for an empty or zero minimum", async () => {
        renderPage();
        await answerStake("utok");
        await answerPrize("1", "10", "ubze");
        await continueIn(PRIZE);
        await answerRules("0", "0");
        expect(question(RULES)).toHaveTextContent("lock 0 days · minimum none");

        await userEvent.click(startButton());
        expect(txMock.mock.calls[0][0][0].value).toMatchObject({ minStake: "0", lock: "0", prizeDenom: "ubze" });
    });

    it("pre-answers question 1 from ?staking= and shows errors after blur", async () => {
        queryParams.current = new URLSearchParams({ staking: "ulp/abc" });
        renderPage();
        expect(question(STAKE)).toHaveAttribute("data-state", "done");
        expect(question(STAKE)).toHaveTextContent("TOK/BZE LP");
        expect(question(PRIZE)).toHaveAttribute("data-state", "active");

        const q = question(PRIZE);
        await userEvent.click(within(q).getByText("Prize (paid from your wallet): utok"));
        const days = within(q).getByLabelText(/For how many days/);
        await userEvent.type(days, "36501");
        expect(within(q).queryByText("Must be between 1 and 36,500 days.")).not.toBeInTheDocument();
        await userEvent.tab();
        expect(within(q).getByText("Must be between 1 and 36,500 days.")).toBeInTheDocument();
        expect(within(q).getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("says when the prize balance is short of the escrow", async () => {
        balances.current = { utok: "10000000", ubze: "1000000000" };
        renderPage();
        await answerStake();
        await answerPrize("1", "30");
        expect(screen.getByRole("alert")).toHaveTextContent("Not enough TOK — you have 10.");
        await continueIn(PRIZE);
        await answerRules("0", "");
        expect(startButton()).toBeDisabled();
    });

    it("counts escrow + fee together when the prize is the fee denom, unless the fee goes in the alternate token", async () => {
        // 30 BZE escrow + 25 BZE fee, 40 BZE in the wallet.
        balances.current = { utok: "0", ubze: "40000000" };
        const { unmount } = renderPage();
        await answerStake("utok");
        await answerPrize("1", "30", "ubze");
        await continueIn(PRIZE);
        await answerRules("0", "");
        expect(startButton()).toBeDisabled();
        expect(screen.getByText("Not enough balance to cover the creation fee on top of the escrowed prize.")).toBeInTheDocument();
        unmount();

        payment.paysWithAlt = true;
        renderPage();
        await answerStake("utok");
        await answerPrize("1", "30", "ubze");
        await continueIn(PRIZE);
        await answerRules("0", "");
        expect(startButton()).toBeEnabled();
    });

    it("asks for a wallet", () => {
        wallet.address = undefined;
        renderPage();
        expect(screen.getByText("Connect your wallet to create this reward.")).toBeInTheDocument();
        expect(startButton()).toBeDisabled();
    });

    it("opens the reward guide from ⓘ", async () => {
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "Which reward fits?" }));
        expect(await screen.findByRole("dialog", { name: "Which reward fits?" })).toBeInTheDocument();
    });

    it("shows the program id and links on success, and starts another from scratch", async () => {
        renderPage();
        await answerStake();
        await answerPrize("2", "5");
        await continueIn(PRIZE);
        await answerRules("3", "");
        await userEvent.click(startButton());

        expect(screen.getByRole("heading", { name: "Your staking program is live!" })).toBeInTheDocument();
        expect(screen.getByText(/10 TOK was locked for prizes/)).toBeInTheDocument();
        expect(screen.getByText("0000000000000007")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Staking" })).toHaveAttribute("href", "https://staking.test");
        expect(screen.getByRole("link", { name: "Staking" })).toHaveAttribute("data-app", "staking");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");

        await userEvent.click(screen.getByRole("button", { name: "Back to the Factory" }));
        expect(navigateMock).toHaveBeenCalledWith("/");

        await userEvent.click(screen.getByRole("button", { name: "Start another program" }));
        expect(question(STAKE)).toHaveAttribute("data-state", "active");
        expect(question(RULES)).toHaveAttribute("data-state", "todo");
        await answerStake();
        await answerPrize("1", "1");
        await continueIn(PRIZE);
        expect(within(question(RULES)).getByLabelText(/Lock period/)).toHaveValue("0");
    });
});
