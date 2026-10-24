import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset, DenomReward } from "@bze/bze-ui-kit";

// Airdrop coins to stakers on mocked hooks: wallet, fees, the spendable balance, the fee engine, each
// token's compounded reward (with its refresh, the pre-sign read), the simple rewards and the wallet
// side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store, the Review step and the
// Done screens are real. The staked-token picker becomes a button per token and shows its props; the
// asset picker a button per coin.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
};
type DrState = { denomReward?: DenomReward; prizes?: unknown[]; hasError?: boolean; isLoading?: boolean };
const { ASSETS, queryParams, wallet, feeState, spendable, afford, drState, simpleState, refreshMock, navigateMock, txMock } = vi.hoisted(() => ({
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
    simpleState: { rewards: [] as Record<string, unknown>[], isLoading: false, hasError: false },
    refreshMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/airdrop",
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
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => ({ ...simpleState, refresh: vi.fn() }) }));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { denom: string; amount: string }; text?: string }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/pickers/staked-token-picker", () => ({
    StakedTokenPicker: ({ mode, only, stakable, onChange }: {
        mode: string;
        only?: string;
        stakable?: Set<string>;
        onChange: (a: { denom: string }) => void;
    }) => (
        <div data-testid="staked-picker" data-mode={mode} data-only={only} data-stakable={[...(stakable ?? [])].join(",")}>
            {["uhoney", "upage"].map(d => <button key={d} onClick={() => onChange({ denom: d })}>{`Stake ${d}`}</button>)}
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

import { StakersAirdrop } from "./stakers-flow";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const onTarget = vi.fn();
const renderFlow = (props: Partial<React.ComponentProps<typeof StakersAirdrop>> = {}) => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<StakersAirdrop target="stakers" onTarget={onTarget} {...props} />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
const FEE = { denom: "ubze", amount: "25000000000" };
const HONEY_DR: DenomReward = { staking_denom: "uhoney", lock: 7, min_stake: "0", staked_amount: "1250000000" };
const BZE_PRIZE = { staking_denom: "uhoney", prize_denom: "ubze", distributed_stake: "0", last_distribution_epoch: "0" };
const HONEY_SR = { reward_id: "000000000007", staking_denom: "uhoney", prize_denom: "ubze", prize_amount: "1000000", staked_amount: "300000000", duration: 30, payouts: 5 };

async function pickToken(denom = "uhoney") {
    await userEvent.click(within(step("Token")).getByText(`Stake ${denom}`));
    await userEvent.click(button(step("Token"), "Continue"));
}

async function signAndContinue() {
    await userEvent.click(button(step("Review"), "Airdrop now"));
    expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
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
    simpleState.rewards = [];
    simpleState.isLoading = false;
    simpleState.hasError = false;
    onTarget.mockReset();
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

describe("Airdrop coins to stakers", { timeout: 20_000 }, () => {
    it("Who is answered; the token picker lists tokens with any reward, pool shares left out", () => {
        simpleState.rewards = [{ ...HONEY_SR, staking_denom: "ubee" }];
        renderFlow();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Airdrop coins");
        expect(step("Who")).toHaveAttribute("data-state", "done");
        expect(step("Who")).toHaveTextContent("Stakers of a token");
        expect(step("Token")).toHaveAttribute("data-state", "active");
        const picker = screen.getByTestId("staked-picker");
        expect(picker).toHaveAttribute("data-mode", "hasRewards");
        expect(picker).toHaveAttribute("data-only", "tokens");
        expect(picker).toHaveAttribute("data-stakable", "ubee");
    });

    it("LP providers: the picker shows only pool shares", () => {
        renderFlow({ target: "lp" });
        expect(step("Who")).toHaveTextContent("Liquidity providers");
        expect(screen.getByTestId("staked-picker")).toHaveAttribute("data-only", "lp");
    });

    it("Who's Edit hands another target to the page", async () => {
        renderFlow();
        await userEvent.click(button(step("Who"), /Edit/));
        await userEvent.click(screen.getByRole("radio", { name: /Liquidity providers/ }));
        expect(onTarget).toHaveBeenCalledWith("lp");
    });

    it("a token nobody stakes: the reason, and no way on", async () => {
        renderFlow();
        await userEvent.click(within(step("Token")).getByText("Stake upage"));
        expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent("Nobody is staking PAGE yet");
        expect(button(step("Token"), "Continue")).toBeDisabled();
    });

    it("a token with no reward at all points to creating one", async () => {
        drState.current = {};
        renderFlow();
        await userEvent.click(within(step("Token")).getByText("Stake uhoney"));
        expect(within(step("Token")).getByRole("link", { name: "Create a staking reward" })).toHaveAttribute("href", "/create/rewards?denom=uhoney");
        expect(button(step("Token"), "Continue")).toBeDisabled();
    });

    it("only a compounded reward: the Reward step answers itself, any coin goes, and it sends MsgDistributeDenomRewards", async () => {
        renderFlow();
        await pickToken();
        expect(step("Reward")).toHaveAttribute("data-state", "done");
        expect(step("Reward")).toHaveTextContent("Compounded reward · 1,250 HONEY staked");
        const amount = step("Amount");
        await userEvent.click(within(amount).getByText("Prize ubze"));
        await userEvent.type(within(amount).getByRole("textbox"), "100");
        expect(screen.getByTestId("airdrop-sentence")).toHaveTextContent("100 BZE is split right now between all HONEY stakers (1,250 HONEY staked), by how much each stakes.");
        await userEvent.click(button(amount, "Review"));
        await signAndContinue();

        expect(refreshMock).toHaveBeenCalled();
        expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgDistributeDenomRewards"]);
        expect(sentMsgs()[0].value).toMatchObject({ creator: "bze1me", denom: "uhoney", prizeDenom: "ubze", amount: "100000000" });
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("100 BZE sent to HONEY stakers.");
        expect(screen.getByTestId("done-recommended")).toHaveTextContent("Stake on DEX");
    });

    it("a compounded and a simple reward: asks which one, with what is staked in each", async () => {
        simpleState.rewards = [HONEY_SR];
        renderFlow();
        await pickToken();
        expect(step("Reward")).toHaveAttribute("data-state", "active");
        const options = within(step("Reward")).getAllByTestId("airdrop-reward");
        expect(options.map(o => o.textContent)).toEqual([
            "Compounded reward · any coin1,250 HONEY staked",
            "Simple reward #000000000007 · paid in BZE300 HONEY staked",
        ]);
    });

    it("through a simple reward: only its prize coin, and it sends MsgDistributeStakingRewards", async () => {
        simpleState.rewards = [HONEY_SR];
        renderFlow();
        await pickToken();
        await userEvent.click(within(step("Reward")).getByText(/Simple reward #000000000007/));
        const amount = step("Amount");
        expect(within(amount).queryByText("Prize ubze")).not.toBeInTheDocument();
        expect(amount).toHaveTextContent("A simple reward pays only in its own coin: BZE.");
        await userEvent.type(within(amount).getByRole("textbox"), "25");
        await userEvent.click(button(amount, "Review"));
        await signAndContinue();

        expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgDistributeStakingRewards"]);
        expect(sentMsgs()[0].value).toMatchObject({ creator: "bze1me", rewardId: "000000000007", amount: "25000000" });
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("25 BZE sent to HONEY stakers.");
        expect(screen.queryByTestId("done-more")).not.toBeInTheDocument();
    });

    it("a link to one simple reward (?id=) finds its token and picks it", () => {
        drState.current = {};
        simpleState.rewards = [HONEY_SR];
        renderFlow({ initialRewardId: "000000000007" });
        expect(step("Token")).toHaveAttribute("data-state", "done");
        expect(step("Token")).toHaveTextContent("HONEY stakers");
        expect(step("Reward")).toHaveTextContent("Simple reward #000000000007 · 300 HONEY staked");
        expect(step("Amount")).toHaveAttribute("data-state", "active");
    });

    it("the stake gone right before signing: we check, and say why", async () => {
        refreshMock.mockImplementation(async () => ({ denomReward: { ...HONEY_DR, staked_amount: "0" }, schedules: [], prizes: [BZE_PRIZE], hasError: false }));
        renderFlow({ initialDenom: "uhoney", initialPrize: "ubze" });
        await userEvent.type(within(step("Amount")).getByRole("textbox"), "100");
        await userEvent.click(button(step("Amount"), "Review"));
        await userEvent.click(button(step("Review"), "Airdrop now"));
        expect(txMock).not.toHaveBeenCalled();
        expect(await screen.findByTestId("presign-blocker")).toBeInTheDocument();
    });
});
