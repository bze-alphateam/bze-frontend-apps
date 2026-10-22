import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// "Reach another community" on mocked hooks: every compounded reward on the chain, the picked one's
// prizes (with its refresh, the pre-sign read), chain params, the wallet, the affordability and fee
// engines and the wallet side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store,
// the Review step and the Done screen are real. The staked-token picker becomes a button per token
// showing the page's row state; the gift picker a button per denom.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
};
const { AAA, MINE, GIFT, COLD, m, navigateMock, txMock, affordMock, refreshMock } = vi.hoisted(() => ({
    AAA: "factory/bze1other/aaa",
    MINE: "factory/bze1me/mine",
    GIFT: "factory/bze1me/gift",
    COLD: "factory/bze1other/cold",
    m: {
        params: new URLSearchParams(),
        address: "bze1me" as string | undefined,
        list: [] as { staking_denom: string; staked_amount: string }[],
        prizes: {} as Record<string, unknown[]>,
        hasCompounded: false,
    },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    affordMock: vi.fn(),
    refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/reach", useSearchParams: () => m.params }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: m.params.get("denom"),
        getQueryParam: (p: string) => m.params.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useAllDenomRewards", () => ({
    useAllDenomRewards: () => ({ list: m.list, isLoading: false, hasError: false, retry: vi.fn() }),
}));
vi.mock("@/hooks/useDenomReward", () => ({
    useDenomReward: (denom: string) => ({
        denomReward: m.list.find(d => d.staking_denom === denom),
        schedules: [],
        prizes: m.prizes[denom] ?? [],
        isLoading: false,
        hasError: false,
        refresh: refreshMock,
    }),
}));
vi.mock("@/hooks/useTokenSetup", () => ({
    useTokenSetup: () => ({
        isLoading: false,
        items: [],
        pools: [],
        hasMarket: false,
        denomReward: m.hasCompounded ? {} : undefined,
        hasStakers: false,
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
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
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
vi.mock("@/components/pickers/staked-token-picker", () => ({
    StakedTokenPicker: ({ mode, onChange, stateOf }: {
        mode: string;
        onChange: (a: { denom: string }) => void;
        stateOf: (a: unknown, dr?: unknown) => { text: string; disabled?: boolean } | undefined;
    }) => (
        <div data-testid="staked-picker" data-mode={mode}>
            {[AAA, COLD, MINE].map(d => {
                const state = stateOf({ denom: d, decimals: 6 }, m.list.find(x => x.staking_denom === d));
                return (
                    <button key={d} disabled={state?.disabled} onClick={() => onChange({ denom: d })}>
                        {`Stake ${d}${state ? ` · ${state.text}` : ""}`}
                    </button>
                );
            })}
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
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useMaxSpendable: () => ({ amount: new BN(10_000_000), inputValue: "10", balance: new BN(10_000_000) }),
        useCanAffordTx: (input: unknown) => affordMock(input),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        useCreationFees: () => ({
            fees: { addDenomRewardScheduleFee: fee, createDenomRewardPrizeFee: fee },
            denomRewardLimits: { maxPrizeDenomsPerDr: 2 },
            isLoading: false,
        }),
        getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getFactoryApp: () => ({ href: "https://factory.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        getCommunitiesApp: () => ({ href: "https://communities.test" }),
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import ReachPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const dr = (denom: string, staked: string) => ({ staking_denom: denom, lock: 7, min_stake: "0", staked_amount: staked });
const prize = (stake: string, denom: string) => ({ staking_denom: stake, prize_denom: denom, distributed_stake: "0", last_distribution_epoch: "0" });

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<ReachPage />, { wrapper });
};

beforeEach(() => {
    m.params = new URLSearchParams();
    m.address = "bze1me";
    m.list = [dr(AAA, "100000000"), dr(COLD, "0"), dr(MINE, "500000000")];
    m.prizes = { [AAA]: [prize(AAA, "ubze")], [MINE]: [] };
    m.hasCompounded = false;
    navigateMock.mockReset();
    refreshMock.mockReset().mockImplementation(async () => ({ denomReward: dr(AAA, "100000000"), schedules: [], prizes: m.prizes[AAA], hasError: false }));
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 12, code: 0 });
        return true;
    });
    affordMock.mockReset().mockReturnValue({ canAfford: true, isLoading: false, message: "", shortfalls: [] });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const payPanel = () => screen.getByTestId("pay-panel");
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

async function pickCommunity(denom = AAA) {
    await userEvent.click(within(step("Community")).getByText(new RegExp(`^Stake ${denom}`)));
    await userEvent.click(button(step("Community"), "Continue"));
}

async function giveAmount(gift: "BZE" | "ATOM" | "GIFT" | "MINE", amount: string) {
    await userEvent.click(screen.getByText(`give ${gift}`));
    await userEvent.type(within(step("Gift")).getByLabelText(/Amount/), amount);
    await userEvent.click(button(step("Gift"), "Continue"));
}

describe("Reach another community", { timeout: 20_000 }, () => {
    describe("Community", () => {
        it("the staked-token picker in hasCompounded mode; rows nobody stakes are disabled", () => {
            renderPage();
            expect(step("Community")).toHaveAttribute("data-state", "active");
            expect(screen.getByText("Whose stakers do you want to reach?")).toBeInTheDocument();
            expect(screen.getByTestId("staked-picker")).toHaveAttribute("data-mode", "hasCompounded");
            expect(screen.getByText(`Stake ${AAA} · 100 staked`)).toBeEnabled();
            expect(screen.getByText(`Stake ${COLD} · Nothing staked · airdrop waits`)).toBeDisabled();
        });

        it("summarises the stakers", async () => {
            renderPage();
            await pickCommunity();
            expect(step("Community")).toHaveTextContent("AAA stakers · 100 staked");
            expect(step("Gift")).toHaveAttribute("data-state", "active");
        });

        it("opened for a community nobody stakes (?community=): the reason, and no way on", () => {
            m.params = new URLSearchParams({ community: COLD });
            renderPage();
            expect(step("Community")).toHaveAttribute("data-state", "active");
            expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent("Nobody is staking COLD yet");
            expect(button(step("Community"), "Continue")).toBeDisabled();
        });

        it("preselects ?community= and ?gift=", () => {
            m.params = new URLSearchParams({ community: AAA, gift: "uatom" });
            renderPage();
            expect(step("Community")).toHaveAttribute("data-state", "done");
            expect(step("Community")).toHaveTextContent("AAA stakers · 100 staked");
            expect(step("Gift")).toHaveAttribute("data-state", "active");
            expect(screen.getByLabelText(/Amount \(ATOM\)/)).toBeInTheDocument();
        });
    });

    describe("Gift", () => {
        it("a new prize token's fee and slot", async () => {
            renderPage();
            await pickCommunity();
            await userEvent.click(screen.getByText("give ATOM"));
            expect(screen.getByTestId("prize-slot-note")).toHaveTextContent("ATOM is a new prize token here: +25,000 BZE, uses 1 of the remaining 1 prize slots.");
        });

        it("blocks a new gift once the community's prize slots are full", async () => {
            m.prizes[AAA] = [prize(AAA, "ubze"), prize(AAA, "ufoo")];
            renderPage();
            await pickCommunity();
            await userEvent.click(screen.getByText("give ATOM"));
            expect(within(step("Gift")).getByText(/already uses 2 prize tokens, the maximum of 2/)).toBeInTheDocument();
            expect(button(step("Gift"), "Continue")).toBeDisabled();
        });

        it("warns when your own gift isn't stakable yet, with a link to make it stakable", async () => {
            renderPage();
            await pickCommunity();

            await userEvent.click(screen.getByText("give BZE"));
            expect(screen.queryByTestId("reach-stakable-tip")).not.toBeInTheDocument();
            await userEvent.click(screen.getByText("give MINE"));
            expect(screen.queryByTestId("reach-stakable-tip")).not.toBeInTheDocument();

            await userEvent.click(screen.getByText("give GIFT"));
            expect(screen.getByTestId("reach-stakable-tip")).toHaveTextContent("People who get GIFT can't stake it yet. Make GIFT stakable so they stay.");
            expect(within(screen.getByTestId("reach-stakable-tip")).getByRole("link", { name: "Make GIFT stakable" }))
                .toHaveAttribute("href", `/denom-reward/new?denom=${encodeURIComponent(GIFT)}`);
        });
    });

    describe("How", () => {
        it("once: the sentence, then Review signs MsgDistributeDenomRewards after rechecking the stake", async () => {
            renderPage();
            await pickCommunity();
            await giveAmount("BZE", "200");
            expect(screen.getByTestId("reach-sentence")).toHaveTextContent("200 BZE is split right now between everyone staking AAA, by how much each stakes.");
            await userEvent.click(button(step("How"), "Continue"));
            expect(step("How")).toHaveTextContent("Once, right now");

            expect(screen.getByTestId("reach-outcome")).toHaveTextContent(
                "200 BZE leaves your wallet now and is split between everyone staking AAA, based on how much each one stakes.",
            );
            expect(payPanel()).toHaveTextContent("The gift: 200000000 ubze, Prize fee: None | distribute-denom-rewards");
            const review = step("Review");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("AAA stakers receive BZE");
            expect(within(review).getByRole("region", { name: "Permanent" })).toHaveTextContent("Gifts can't be taken back");
            expect(screen.getByTestId("reach-owner-note")).toHaveTextContent("This adds a prize to AAA's compounded reward. It doesn't make you its owner.");

            await userEvent.click(button(review, "Send gift"));
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            expect(refreshMock).toHaveBeenCalledOnce();
            expect(sentMsgs().map(x => x.typeUrl)).toEqual(["/bze.rewards.MsgDistributeDenomRewards"]);
            expect(sentMsgs()[0].value).toEqual({ creator: "bze1me", denom: AAA, prizeDenom: "ubze", amount: "200000000" });
        });

        it("every day: the sentence, the fee note, and MsgCreateDenomRewardSchedule for N days", async () => {
            renderPage();
            await pickCommunity();
            await giveAmount("BZE", "2");
            await userEvent.click(within(step("How")).getByRole("button", { name: /Every day for 30 days/ }));
            const days = within(step("How")).getByLabelText("Days");
            await userEvent.clear(days);
            await userEvent.type(days, "10");
            expect(screen.getByTestId("reach-sentence")).toHaveTextContent(
                "2 BZE a day for 10 days (20 BZE in all), shared by everyone staking AAA that day. Days with nobody staking are skipped.",
            );
            expect(screen.getByTestId("reach-schedule-fee")).toBeInTheDocument();
            await userEvent.click(button(step("How"), "Continue"));
            expect(step("How")).toHaveTextContent("Every day for 10 days");

            expect(payPanel()).toHaveTextContent("Locked for prizes: 20000000 ubze, Daily prize fee: 25000000000 ubze | module 25000000000 | create-denom-reward-schedule");
            await userEvent.click(button(step("Review"), "Start daily gift"));
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            expect(refreshMock).not.toHaveBeenCalled();
            expect(sentMsgs()[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomRewardSchedule");
            expect(sentMsgs()[0].value).toEqual({ creator: "bze1me", denom: AAA, prizeDenom: "ubze", dailyAmount: "2000000", duration: "10" });
        });

        it("days out of range keep How open", async () => {
            renderPage();
            await pickCommunity();
            await giveAmount("BZE", "2");
            await userEvent.click(within(step("How")).getByRole("button", { name: /Every day/ }));
            const days = within(step("How")).getByLabelText("Days");
            await userEvent.clear(days);
            await userEvent.type(days, "0");
            expect(button(step("How"), "Continue")).toBeDisabled();
        });
    });

    describe("Review", () => {
        async function toReview(gift: "BZE" | "ATOM" = "BZE") {
            await pickCommunity();
            await giveAmount(gift, "5");
            await userEvent.click(button(step("How"), "Continue"));
        }

        it("charges the new prize fee, with the slot text, when the gift is new to the community", async () => {
            renderPage();
            await toReview("ATOM");
            expect(payPanel()).toHaveTextContent("The gift: 5000000 uatom, New prize fee: 25000000000 ubze | module 25000000000");
            expect(within(step("Review")).getByRole("region", { name: "Leaves your wallet" })).toHaveTextContent("New prize fee");
            expect(button(step("Review"), "Send gift")).toBeEnabled();
        });

        it("if the stake dropped to 0 right before an airdrop: the blocker instead of the button, nothing signed", async () => {
            refreshMock.mockImplementation(async () => ({ denomReward: dr(AAA, "0"), schedules: [], prizes: [], hasError: false }));
            renderPage();
            await toReview();
            await userEvent.click(button(step("Review"), "Send gift"));
            expect(await screen.findByTestId("presign-blocker")).toHaveTextContent("Nobody is staking AAA yet");
            expect(txMock).not.toHaveBeenCalled();
        });

        it("asks a wallet-less visitor to connect", async () => {
            m.address = undefined;
            renderPage();
            await toReview();
            expect(screen.getByText("Connect your wallet to send the gift.")).toBeInTheDocument();
            expect(button(step("Review"), "Send gift")).toBeDisabled();
        });

        it("blocks when the wallet can't cover the gift + fees + gas", async () => {
            affordMock.mockReturnValue({ canAfford: false, isLoading: false, message: "Not enough BZE", shortfalls: [] });
            renderPage();
            await toReview();
            expect(screen.getByText("Not enough BZE")).toBeInTheDocument();
            expect(button(step("Review"), "Send gift")).toBeDisabled();
        });
    });

    describe("Done", () => {
        async function send(gift: "BZE" | "GIFT" = "GIFT") {
            await pickCommunity();
            await giveAmount(gift, "5");
            await userEvent.click(button(step("How"), "Continue"));
            await userEvent.click(button(step("Review"), "Send gift"));
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        }

        it("the gift is on its way, with Make your token stakable recommended", async () => {
            renderPage();
            await send();
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("GIFT is on its way to AAA stakers.");
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Make GIFT stakable");
            expect(screen.getAllByRole("link", { name: /Communities/ })[0]).toHaveAttribute("href", `https://communities.test/token?denom=${encodeURIComponent(AAA)}`);
        });

        it("skips Make stakable when the gift already is", async () => {
            m.hasCompounded = true;
            renderPage();
            await send();
            expect(screen.queryByText("Make GIFT stakable")).not.toBeInTheDocument();
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Let people buy GIFT");
        });
    });
});
