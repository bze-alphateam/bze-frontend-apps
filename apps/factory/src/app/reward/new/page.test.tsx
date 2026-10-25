import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, fees, balances, the fee engine and the
// wallet side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store, the Review step
// and the Done screen are real. The asset picker becomes a plain button per denom; PayPanel has
// its own coverage.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};
const { queryParams, wallet, feeState, balances, payment, navigateMock, txMock, restTx } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    feeState: { fee: { denom: "ubze", amount: "25000000" } as { denom: string; amount: string } | undefined },
    balances: { current: {} as Record<string, string> },
    payment: { paysWithAlt: false, canPayFee: true },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    restTx: { events: [] as unknown[] },
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/reward/new",
    useSearchParams: () => queryParams.current,
}));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        paysWithAlt: payment.paysWithAlt,
        canPayFee: payment.canPayFee,
        isLoading: false,
        method: payment.canPayFee ? "native" : "insufficient",
        gasFee: { denom: "ubze", amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isLoading: false },
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { denom: string; amount: string } }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin?.amount} ${r.coin?.denom}`).join(", ")}</div>
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
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        useCreationFees: () => ({ fees: { createStakingRewardFee: feeState.fee }, isLoading: false }),
        getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import RewardNewPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<RewardNewPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const createButton = () => button(step("Review"), "Create simple reward");
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

async function answerStake(denom = "ulp/abc") {
    await userEvent.click(within(step("Stake")).getByText(`Token: ${denom}`));
    await userEvent.click(button(step("Stake"), "Continue"));
}

async function fillBudget(perDay: string, days: string, denom = "utok") {
    const q = step("Reward");
    await userEvent.click(within(q).getByText(`Reward token: ${denom}`));
    await userEvent.type(within(q).getByLabelText(/Daily reward/), perDay);
    await userEvent.type(within(q).getByLabelText("Days"), days);
}

async function answerBudget(perDay: string, days: string, denom = "utok") {
    await fillBudget(perDay, days, denom);
    await userEvent.click(button(step("Reward"), "Continue"));
}

async function answerRules(lock: string, minStake: string) {
    const q = step("Rules");
    const lockInput = within(q).getByLabelText(/Unstaking lock/);
    await userEvent.clear(lockInput);
    await userEvent.type(lockInput, lock);
    if (minStake) await userEvent.type(within(q).getByLabelText(/Minimum stake/), minStake);
    await userEvent.click(button(q, "Review reward"));
}

/** The wallet signs and the chain includes the tx. */
function txSucceeds() {
    txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    feeState.fee = { denom: "ubze", amount: "25000000" };
    // 1,000,000 TOK and 1,000 BZE.
    balances.current = { utok: "1000000000000", ubze: "1000000000" };
    payment.paysWithAlt = false;
    payment.canPayFee = true;
    navigateMock.mockReset();
    txMock.mockReset();
    txSucceeds();
    restTx.events = [{ type: "bze.rewards.StakingRewardCreateEvent", attributes: [{ key: "reward_id", value: "\"0000000000000007\"" }] }];
    // The Done screen reads the reward id back from the tx on the chain's REST.
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url.startsWith("https://rest.test/cosmos/tx/v1beta1/txs/HASH1")) {
            return { ok: true, status: 200, json: async () => ({ tx_response: { txhash: "HASH1", code: 0, height: "1234", events: restTx.events } }) };
        }
        throw new Error("offline");
    }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Create a simple reward (/reward/new)", { timeout: 20_000 }, () => {
    it("shows the four steps with Stake open", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Create a simple reward/ })).toBeInTheDocument();
        expect(screen.getByText("rewards · staking reward")).toBeInTheDocument();
        expect(step("Stake")).toHaveAttribute("data-state", "active");
        expect(within(step("Stake")).getByText("Step 1 of 4 ·", { exact: false })).toBeInTheDocument();
        expect(within(step("Stake")).getByRole("heading", { name: "Which token?" })).toBeInTheDocument();
        expect(screen.queryByText("Any token, LP shares included. It doesn't have to be yours.")).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "What will happen" })).not.toBeInTheDocument();
        expect(step("Reward")).toHaveAttribute("data-state", "todo");
        expect(step("Rules")).toHaveAttribute("data-state", "todo");
        expect(step("Review")).toHaveAttribute("data-state", "todo");
        expect(screen.getByRole("link", { name: "Compare the kinds of reward" })).toHaveAttribute("href", "/create/rewards");
    });

    describe("Stake", () => {
        it("offers LP shares to stake and summarises the pick", async () => {
            renderPage();
            expect(screen.getByText("Token: ulp/abc")).toBeInTheDocument();
            await answerStake();
            expect(step("Stake")).toHaveAttribute("data-state", "done");
            expect(step("Stake")).toHaveTextContent("Stake TOK/BZE LP");
            // The reward token picker has no LP shares.
            expect(screen.queryByText("Reward token: ulp/abc")).not.toBeInTheDocument();
        });

        it("is pre-answered by ?staking=", () => {
            queryParams.current = new URLSearchParams({ staking: "ulp/abc" });
            renderPage();
            expect(step("Stake")).toHaveAttribute("data-state", "done");
            expect(step("Stake")).toHaveTextContent("Stake TOK/BZE LP");
            expect(step("Reward")).toHaveAttribute("data-state", "active");
        });
    });

    describe("Reward", () => {
        it("shows the balance and the committed rewards in the pay panel, then summarises the budget", async () => {
            renderPage();
            await answerStake();
            await fillBudget("100", "30");
            const q = step("Reward");
            expect(within(q).getByText("You hold 1,000,000 TOK")).toBeInTheDocument();
            expect(within(q).getByText("Min 1 · Max 36500 days")).toBeInTheDocument();
            expect(within(q).queryByText("Anyone can add more days later, at the same daily amount.")).not.toBeInTheDocument();
            expect(screen.queryByTestId("budget")).not.toBeInTheDocument();
            expect(screen.queryByTestId("budget-line")).not.toBeInTheDocument();
            expect(screen.queryByTestId("outcome")).not.toBeInTheDocument();
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("Rewards: 3000000000 utok, Creation fee: 25000000 ubze");

            await userEvent.click(button(step("Reward"), "Continue"));
            expect(step("Reward")).toHaveTextContent("100 TOK a day for 30 days");
            expect(step("Rules")).toHaveAttribute("data-state", "active");
        });

        it("fills the days from a quick answer", async () => {
            renderPage();
            await answerStake();
            await userEvent.click(within(step("Reward")).getByText("Reward token: utok"));
            await userEvent.type(within(step("Reward")).getByLabelText(/Daily reward/), "2");
            await userEvent.click(button(step("Reward"), "90 days"));
            expect(within(step("Reward")).getByLabelText("Days")).toHaveValue("90");
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("Rewards: 180000000 utok");
        });

        it("stops at the budget when the wallet holds too little of the reward token", async () => {
            balances.current = { utok: "10000000", ubze: "1000000000" };
            renderPage();
            await answerStake();
            await fillBudget("1", "30");
            expect(screen.getByRole("alert")).toHaveTextContent("Not enough TOK: you hold 10 TOK.");
            expect(button(step("Reward"), "Continue")).toBeDisabled();
        });

        it("shows the day limits after blur", async () => {
            renderPage();
            await answerStake();
            const q = step("Reward");
            await userEvent.click(within(q).getByText("Reward token: utok"));
            await userEvent.type(within(q).getByLabelText("Days"), "36501");
            expect(within(q).queryByText("Min 1 · Max 36500 days.")).not.toBeInTheDocument();
            await userEvent.tab();
            expect(within(q).getByText("Min 1 · Max 36500 days.")).toBeInTheDocument();
            expect(button(q, "Continue")).toBeDisabled();
        });
    });

    describe("Rules", () => {
        it("defaults to no lock and no minimum", async () => {
            renderPage();
            await answerStake();
            await answerBudget("1", "10");
            expect(within(step("Rules")).getByText("Min 0 · Max 3650 days")).toBeInTheDocument();
            expect(within(step("Rules")).queryByText(/Stakers can leave any time\./)).not.toBeInTheDocument();
            expect(within(step("Rules")).getByLabelText(/Minimum stake/)).toHaveAttribute("placeholder", "None");
            await userEvent.click(button(step("Rules"), "Review reward"));
            expect(step("Rules")).toHaveTextContent("No lock · no minimum");
        });

        it("summarises a lock and a minimum stake", async () => {
            renderPage();
            await answerStake();
            await answerBudget("1", "10");
            await answerRules("7", "2.5");
            expect(step("Rules")).toHaveTextContent("7-day lock · min 2.5 TOK/BZE LP");
        });

        it("refuses a lock over 3,650 days", async () => {
            renderPage();
            await answerStake();
            await answerBudget("1", "10");
            const lockInput = within(step("Rules")).getByLabelText(/Unstaking lock/);
            await userEvent.clear(lockInput);
            await userEvent.type(lockInput, "3651");
            expect(button(step("Rules"), "Review reward")).toBeDisabled();
        });
    });

    describe("Review", () => {
        it("lists the committed rewards and the fee, what you get, the days and what is permanent, then signs the msg in base units", async () => {
            renderPage();
            await answerStake();
            await answerBudget("1.5", "30");
            await answerRules("7", "2.5");

            const review = step("Review");
            const leaves = within(review).getByRole("region", { name: "Leaves your wallet" });
            // The same rows, in the same order, as the pay panel.
            expect(leaves).toHaveTextContent(/Rewards\s*TOK\s*45 TOK.*Creation fee\s*BZE\s*25 BZE/);
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("Stake TOK/BZE LP · earn 1.5 TOK a day");
            expect(review).toHaveTextContent("Days30 days");
            expect(review).not.toHaveTextContent("Budget");
            const permanent = within(review).getByRole("region", { name: "Permanent" });
            expect(permanent).toHaveTextContent("Daily reward and rules");
            expect(permanent).toHaveTextContent("Rewards are committed to stakers");

            await userEvent.click(createButton());
            expect(sentMsgs()).toEqual([{
                typeUrl: "/bze.rewards.MsgCreateStakingReward",
                value: {
                    creator: "bze1me",
                    prizeAmount: "1500000",
                    prizeDenom: "utok",
                    stakingDenom: "ulp/abc",
                    duration: "30",
                    // LP shares have 12 decimals.
                    minStake: "2500000000000",
                    lock: "7",
                },
            }]);
        });

        it("sends minStake '0' for an empty or zero minimum", async () => {
            renderPage();
            await answerStake("utok");
            await answerBudget("1", "10", "ubze");
            await answerRules("0", "0");
            expect(step("Rules")).toHaveTextContent("No lock · no minimum");
            await userEvent.click(createButton());
            expect(sentMsgs()[0].value).toMatchObject({ minStake: "0", lock: "0", prizeDenom: "ubze" });
        });

        it("counts the rewards and the fee together when the reward token is the fee token, unless the fee goes in the alternate token", async () => {
            // 30 BZE of rewards + 25 BZE fee, 40 BZE in the wallet: the budget step passes, Review blocks.
            balances.current = { utok: "0", ubze: "40000000" };
            const { unmount } = renderPage();
            await answerStake("utok");
            await answerBudget("1", "30", "ubze");
            await answerRules("0", "");
            expect(createButton()).toBeDisabled();
            expect(screen.getByText("Not enough BZE: you hold 40 BZE.")).toBeInTheDocument();
            unmount();

            payment.paysWithAlt = true;
            renderPage();
            await answerStake("utok");
            await answerBudget("1", "30", "ubze");
            await answerRules("0", "");
            expect(createButton()).toBeEnabled();
        });

        it("can be walked without a wallet, which it then asks for", async () => {
            wallet.address = undefined;
            renderPage();
            await answerStake();
            await answerBudget("1", "10");
            await answerRules("0", "");
            expect(step("Review")).toHaveAttribute("data-state", "active");
            expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
            expect(createButton()).toBeDisabled();
        });

        it("blocks when the fee could not be loaded", async () => {
            feeState.fee = undefined;
            renderPage();
            await answerStake();
            await answerBudget("1", "10");
            await answerRules("0", "");
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("fee unknown");
            expect(within(step("Review")).getByText("Could not load the current fee from the chain. Please refresh and try again.")).toBeInTheDocument();
            expect(createButton()).toBeDisabled();
        });
    });

    describe("Done", () => {
        async function createReward() {
            queryParams.current = new URLSearchParams({ staking: "ulp/abc" });
            renderPage();
            await answerBudget("100", "30");
            await answerRules("0", "");
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        }

        it("shows the live reward with its id from the tx event, the links, and only Stake on DEX next", async () => {
            await createReward();

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your simple reward is live.");
            expect(screen.getByText("People can stake TOK/BZE LP and share 100 TOK a day.")).toBeInTheDocument();
            expect(await screen.findByText("0000000000000007")).toBeInTheDocument();

            expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
            const stakingUrl = `https://dex.test/staking?search=${encodeURIComponent("TOK/BZE LP")}`;
            const recommended = screen.getByTestId("done-recommended");
            const dexLink = within(recommended).getByRole("link", { name: /Stake on DEX/ });
            expect(dexLink).toHaveAttribute("href", stakingUrl);
            expect(dexLink).toHaveAttribute("data-app", "dex");
            expect(screen.queryByTestId("done-more")).not.toBeInTheDocument();
        });

        it("keeps the id a skeleton when the tx can't be read back", async () => {
            restTx.events = [];
            await createReward();
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your simple reward is live.");
            expect(screen.queryByText("0000000000000007")).not.toBeInTheDocument();
        });
    });
});
