import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset, DenomReward } from "@bze/bze-ui-kit";

// The Airdrop to stakers wizard on mocked hooks: query params, wallet, fees, the spendable balance,
// the fee engine, each token's compounded reward (with its refresh, the pre-sign read) and the wallet
// side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store, the Review step and the
// Done screen are real. The staked-token picker becomes a button per token showing the page's row
// state; the asset picker a button per prize denom.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
};
type DrState = { denomReward?: DenomReward; prizes?: unknown[]; hasError?: boolean; isLoading?: boolean };
const { ASSETS, queryParams, wallet, feeState, spendable, afford, drState, refreshMock, navigateMock, txMock } = vi.hoisted(() => ({
    ASSETS: {
        uhoney: { denom: "uhoney", ticker: "HONEY", name: "Honey", decimals: 6, logo: "" },
        upage: { denom: "upage", ticker: "PAGE", name: "Page", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" },
        ubee: { denom: "ubee", ticker: "BEE", name: "Bee", decimals: 6, logo: "" },
    } as Record<string, { denom: string; ticker: string; name: string; decimals: number; logo: string }>,
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    feeState: { fees: {} as Record<string, { denom: string; amount: string } | undefined>, limits: {} as Record<string, unknown> },
    spendable: { input: "50000", balance: "50000000000" },
    afford: { canAfford: true, message: "" },
    drState: { current: {} as Record<string, DrState> },
    refreshMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/denom-reward/airdrop",
    useSearchParams: () => queryParams.current,
}));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: queryParams.current.get("denom"),
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: (fee?: { denom: string; amount: string }) => ({
        canPayFee: true,
        isLoading: false,
        method: "native",
        estimate: { resolvedFee: fee },
        gasFee: { denom: "ubze", amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isLoading: false },
    }),
}));
vi.mock("@/hooks/useDenomReward", () => ({
    useDenomReward: (denom: string) => ({
        denomReward: undefined,
        schedules: [],
        prizes: [],
        hasError: false,
        isLoading: false,
        refresh: refreshMock,
        ...drState.current[denom],
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { denom: string; amount: string }; text?: string }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/pickers/staked-token-picker", () => ({
    StakedTokenPicker: ({ mode, onChange, stateOf }: {
        mode: string;
        onChange: (a: { denom: string }) => void;
        stateOf: (a: unknown, dr?: unknown) => { text: string; disabled?: boolean } | undefined;
    }) => (
        <div data-testid="staked-picker" data-mode={mode}>
            {["uhoney", "upage"].map(d => {
                const state = stateOf(ASSETS[d], drState.current[d]?.denomReward)
                return (
                    <button key={d} disabled={state?.disabled} onClick={() => onChange({ denom: d })}>
                        {`Stake ${d}${state ? ` · ${state.text}` : ""}`}
                    </button>
                )
            })}
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <div>{["ubze", "ubee"].map(d => <button key={d} onClick={() => onSelect({ denom: d })}>{`Prize ${d}`}</button>)}</div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: ASSETS[denom] as Partial<Asset> | undefined, isLoading: false }),
        useMaxSpendable: () => ({
            amount: new BN(spendable.input).multipliedBy(1_000_000),
            inputValue: spendable.input,
            balance: new BN(spendable.balance),
        }),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        useCanAffordTx: () => ({ ...afford, isLoading: false, shortfalls: [] }),
        useCreationFees: () => ({ fees: feeState.fees, denomRewardLimits: feeState.limits, isLoading: false }),
        getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getFactoryApp: () => ({ href: "https://factory.test" }),
        getCommunitiesApp: () => ({ href: "https://communities.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import DenomRewardAirdropPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<DenomRewardAirdropPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
const FEE = { denom: "ubze", amount: "25000000000" };
const HONEY_DR: DenomReward = { staking_denom: "uhoney", lock: 7, min_stake: "0", staked_amount: "1250000000" };
const BZE_PRIZE = { staking_denom: "uhoney", prize_denom: "ubze", distributed_stake: "0", last_distribution_epoch: "0" };

async function pickToken(denom = "uhoney") {
    await userEvent.click(within(step("Staked token")).getByText(new RegExp(`^Stake ${denom}`)));
    await userEvent.click(button(step("Staked token"), "Continue"));
}

async function fillGift(amount: string, denom = "ubee") {
    const q = step("Prize & amount");
    await userEvent.click(within(q).getByText(`Prize ${denom}`));
    await userEvent.type(within(q).getByRole("textbox"), amount);
}

async function toReview(amount = "10000", denom = "ubee") {
    await pickToken();
    await fillGift(amount, denom);
    await userEvent.click(button(step("Prize & amount"), "Continue"));
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    feeState.fees = { createDenomRewardPrizeFee: FEE };
    feeState.limits = { maxPrizeDenomsPerDr: 3 };
    spendable.input = "50000";
    spendable.balance = "50000000000";
    afford.canAfford = true;
    afford.message = "";
    drState.current = {
        uhoney: { denomReward: HONEY_DR, prizes: [BZE_PRIZE] },
        upage: { denomReward: { staking_denom: "upage", lock: 7, min_stake: "0", staked_amount: "0" } },
    };
    refreshMock.mockReset().mockImplementation(async () => ({ denomReward: HONEY_DR, schedules: [], prizes: [BZE_PRIZE], hasError: false }));
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Airdrop to stakers (/denom-reward/airdrop)", { timeout: 20_000 }, () => {
    it("asks which token's stakers first, with the picker in hasCompounded mode", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Airdrop to stakers/ })).toBeInTheDocument();
        expect(screen.getByText("rewards · distribute denom rewards")).toBeInTheDocument();
        expect(step("Staked token")).toHaveAttribute("data-state", "active");
        expect(screen.getByTestId("staked-picker")).toHaveAttribute("data-mode", "hasCompounded");
        expect(step("Prize & amount")).toHaveAttribute("data-state", "todo");
        expect(step("Review")).toHaveAttribute("data-state", "todo");
    });

    it("a token nobody stakes is amber and can't be picked", () => {
        renderPage();
        expect(screen.getByText("Stake uhoney · 1,250 staked")).toBeEnabled();
        expect(screen.getByText("Stake upage · Nothing staked · airdrop waits")).toBeDisabled();
    });

    it("opened for a token nobody stakes (?denom=): the reason, and no way on (5018)", () => {
        queryParams.current = new URLSearchParams({ denom: "upage" });
        renderPage();
        expect(step("Staked token")).toHaveAttribute("data-state", "active");
        expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent("Nobody is staking PAGE yet");
        expect(button(step("Staked token"), "Continue")).toBeDisabled();
    });

    it("is pre-answered by ?denom=", () => {
        queryParams.current = new URLSearchParams({ denom: "uhoney" });
        renderPage();
        expect(step("Staked token")).toHaveAttribute("data-state", "done");
        expect(step("Staked token")).toHaveTextContent("HONEY stakers");
        expect(step("Prize & amount")).toHaveAttribute("data-state", "active");
    });

    it("a token without a compounded reward points to making it stakable", () => {
        queryParams.current = new URLSearchParams({ denom: "uhoney" });
        drState.current = {};
        renderPage();
        expect(screen.getByTestId("no-compounded")).toHaveTextContent("HONEY has no compounded reward yet.");
        expect(button(step("Staked token"), "Continue")).toBeDisabled();
    });

    it("a load error is never 'no reward'", () => {
        queryParams.current = new URLSearchParams({ denom: "uhoney" });
        drState.current = { uhoney: { hasError: true } };
        renderPage();
        expect(screen.getByText("Couldn't load HONEY's compounded reward. The node may be down.")).toBeInTheDocument();
        expect(screen.queryByTestId("no-compounded")).not.toBeInTheDocument();
        expect(button(step("Staked token"), "Continue")).toBeDisabled();
    });

    describe("Prize & amount", () => {
        it("the live sentence, and a new prize token's fee and slot", async () => {
            renderPage();
            await pickToken();
            await fillGift("10000");
            const q = step("Prize & amount");
            expect(within(q).getByTestId("prize-slot-note")).toHaveTextContent("BEE is a new prize token here: +25,000 BZE, uses 1 of the remaining 2 prize slots.");
            expect(within(q).getByTestId("airdrop-sentence")).toHaveTextContent("10,000 BEE is split right now between everyone staking HONEY (1,250 HONEY staked), pro rata.");
            await userEvent.click(button(q, "Continue"));
            expect(step("Prize & amount")).toHaveTextContent("10,000 BEE");
        });

        it("a prize the reward already pays has no prize fee", async () => {
            renderPage();
            await pickToken();
            await fillGift("100", "ubze");
            expect(screen.getByTestId("prize-slot-note")).toHaveTextContent("No prize fee: HONEY already pays BZE.");
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("The gift: 100000000 ubze, Prize fee: None");
        });

        it("a new prize token past the cap is blocked (5017)", async () => {
            feeState.limits = { maxPrizeDenomsPerDr: 1 };
            renderPage();
            await pickToken();
            await fillGift("100");
            expect(within(step("Prize & amount")).getByText(/already uses 1 prize tokens, the maximum of 1/)).toBeInTheDocument();
            expect(button(step("Prize & amount"), "Continue")).toBeDisabled();
        });

        it("checks the balance", async () => {
            spendable.balance = "5000000";
            renderPage();
            await pickToken();
            await fillGift("10000");
            expect(within(step("Prize & amount")).getByRole("alert")).toHaveTextContent("Not enough BEE: you hold 5 BEE.");
            expect(button(step("Prize & amount"), "Continue")).toBeDisabled();
        });

        it("Max fills the spendable balance", async () => {
            renderPage();
            await pickToken();
            await userEvent.click(within(step("Prize & amount")).getByText("Prize ubee"));
            await userEvent.click(button(step("Prize & amount"), "Max"));
            expect(within(step("Prize & amount")).getByRole("textbox")).toHaveValue("50000");
        });
    });

    describe("Review", () => {
        it("what leaves, what you get, what is permanent; rechecks the stake and signs MsgDistributeDenomRewards", async () => {
            renderPage();
            await toReview();
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("The gift: 10000000000 ubee, New prize fee: 25000000000 ubze");
            const review = step("Review");
            expect(within(review).getByRole("region", { name: "Leaves your wallet" })).toHaveTextContent("New prize fee");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("HONEY stakers can claim it right away");
            expect(review).toHaveTextContent("An airdrop can't be undone");

            await userEvent.click(button(review, "Airdrop now"));
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            expect(refreshMock).toHaveBeenCalledOnce();
            expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgDistributeDenomRewards"]);
            expect(sentMsgs()[0].value).toMatchObject({ creator: "bze1me", denom: "uhoney", prizeDenom: "ubee", amount: "10000000000" });
        });

        it("if the stake dropped to 0 right before signing: the blocker instead of the button, nothing signed", async () => {
            refreshMock.mockImplementation(async () => ({
                denomReward: { ...HONEY_DR, staked_amount: "0" }, schedules: [], prizes: [BZE_PRIZE], hasError: false,
            }));
            renderPage();
            await toReview();
            await userEvent.click(button(step("Review"), "Airdrop now"));
            expect(await screen.findByTestId("presign-blocker")).toHaveTextContent("We check before you sign.");
            expect(txMock).not.toHaveBeenCalled();
            expect(screen.getByTestId("presign-blocker")).toHaveTextContent("Nobody is staking HONEY yet");
            expect(within(step("Review")).queryByRole("button", { name: "Airdrop now" })).not.toBeInTheDocument();
        });

        it("if the recheck fails: says so, signs nothing, and lets you try again", async () => {
            refreshMock.mockImplementation(async () => ({ schedules: [], prizes: [], hasError: true }));
            renderPage();
            await toReview();
            await userEvent.click(button(step("Review"), "Airdrop now"));
            expect(await screen.findByText("Couldn't check HONEY's stakers right before signing. Please try again.")).toBeInTheDocument();
            expect(txMock).not.toHaveBeenCalled();
            expect(screen.getByText("Couldn't check HONEY's stakers right before signing. Please try again.")).toBeInTheDocument();
            expect(button(step("Review"), "Airdrop now")).toBeEnabled();
        });

        it("an unknown new prize fee blocks it", async () => {
            feeState.fees = {};
            renderPage();
            await pickToken();
            await fillGift("100");
            expect(button(step("Prize & amount"), "Continue")).toBeEnabled();
            await userEvent.click(button(step("Prize & amount"), "Continue"));
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("fee unknown");
            expect(button(step("Review"), "Airdrop now")).toBeDisabled();
        });

        it("without a wallet, asks to connect", async () => {
            wallet.address = undefined;
            renderPage();
            await toReview();
            expect(button(step("Review"), "Airdrop now")).toBeDisabled();
            expect(screen.getByText("Connect your wallet to airdrop.")).toBeInTheDocument();
        });

        it("says what the wallet is short of", async () => {
            afford.canAfford = false;
            afford.message = "Insufficient BZE balance (5 BZE short)";
            renderPage();
            await toReview();
            expect(button(step("Review"), "Airdrop now")).toBeDisabled();
            expect(screen.getByText("Insufficient BZE balance (5 BZE short)")).toBeInTheDocument();
        });
    });

    describe("Done", () => {
        async function airdrop() {
            await toReview();
            await userEvent.click(button(step("Review"), "Airdrop now"));
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        }

        it("the title, Tell your stakers, no Extend, and the Communities link", async () => {
            renderPage();
            await airdrop();
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("10,000 BEE sent to HONEY stakers.");
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Tell your stakers");
            expect(screen.queryByText("Extend before it ends")).not.toBeInTheDocument();
            expect(screen.getAllByRole("link", { name: /Communities/ })[0]).toHaveAttribute("href", "https://communities.test/token?denom=uhoney");
        });

        it("with a return path: Back to <TICKER>", async () => {
            queryParams.current = new URLSearchParams({ return: "/tokens/token?denom=uhoney", returnLabel: "HONEY" });
            renderPage();
            await airdrop();
            await userEvent.click(screen.getByRole("button", { name: /Back to HONEY/ }));
            expect(navigateMock).toHaveBeenCalledWith("/tokens/token?denom=uhoney");
        });
    });
});
