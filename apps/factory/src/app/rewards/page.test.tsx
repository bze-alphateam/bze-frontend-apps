import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

// The directory against mocked chain queries: the DR list plus per-DR prize and schedule lists, and
// the simple rewards hook, grouped one row per staked token (canvas C-2). Order assertions wait for
// the rows to settle (BFE-253).
const m = vi.hoisted(() => ({
    getAll: vi.fn(),
    getPrizes: vi.fn(),
    getSchedules: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    tx: vi.fn(),
    query: "",
    address: undefined as string | undefined,
    prices: new Map<string, unknown>(),
    simple: { rewards: [] as unknown[], isLoading: false, hasError: false },
}));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: vi.fn(), replace: m.replace }),
    useNavigationWithParams: () => ({
        navigate: vi.fn(),
        replace: m.replace,
        getQueryParam: (k: string) => new URLSearchParams(m.query).get(k),
        denomParam: null,
    }),
}));
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => ({ ...m.simple, refresh: m.refresh }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" },
        [TOK]: { denom: TOK, ticker: "TOK", name: "Token", decimals: 6, logo: "" },
        [MINE]: { denom: MINE, ticker: "MINE", name: "Mine", decimals: 6, logo: "" },
        [LP]: { denom: LP, ticker: "TOK/BZE LP", name: "TOK/BZE pool shares", decimals: 12, logo: "" },
    };
    return {
        ...actual,
        useAssets: () => ({ getAsset: (d: string) => assets[d], denomTicker: (d: string) => assets[d]?.ticker ?? d }),
        useAssetsContext: () => ({ usdPricesMap: m.prices }),
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useLiquidityPools: () => ({ pools: [], getPoolByLpDenom: () => undefined }),
        getDexApp: () => ({ href: "https://dex.example" }),
        getAllDenomRewards: () => m.getAll(),
        getDenomRewardPrizes: (denom: string) => m.getPrizes(denom),
        getDenomRewardSchedules: (denom: string) => m.getSchedules(denom),
    };
});

const { TOK, MINE, LP } = vi.hoisted(() => ({
    TOK: "factory/bze1owner/utok",
    MINE: "factory/bze1me/umine",
    LP: "ulp_factory/bze1owner/utok_ubze",
}));

import RewardsPage from "./page";

const DRS = [
    { staking_denom: "ubze", lock: 7, min_stake: "0", staked_amount: "1500000000" },
    { staking_denom: TOK, lock: 1, min_stake: "0", staked_amount: "0" },
];
const MINE_DR = { staking_denom: MINE, lock: 3, min_stake: "0", staked_amount: "50000000" };

const reward = (id: string, over: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "2000000",
    prize_denom: "ubze",
    staking_denom: TOK,
    duration: 30,
    payouts: 10,
    min_stake: 0n,
    lock: 0,
    staked_amount: "5000000",
    distributed_stake: "0",
    ...over,
});

const prizes = (...denoms: string[]) => denoms.map(prize_denom => ({ prize_denom, staking_denom: "", distributed_stake: "0", last_distribution_epoch: "9" }));
const schedule = (id: string, prize_denom: string, daily_amount: string, duration: number, payouts: number) =>
    ({ schedule_id: id, staking_denom: "", prize_denom, daily_amount, duration, payouts });

function renderPage() {
    return render(<RewardsPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const groups = () => screen.queryAllByTestId("reward-group");
const tickers = () => groups().map(g => within(g).getByTestId("reward-group-ticker").textContent);
const group = (ticker: string) => groups().find(g => within(g).getByTestId("reward-group-ticker").textContent === ticker)!;
const header = (ticker: string) => within(group(ticker)).getAllByRole("button")[0];
const toggle = (ticker: string) => userEvent.click(header(ticker));
const dex = (id: string) => `https://dex.example/staking/details?id=${encodeURIComponent(id)}`;

beforeEach(() => {
    m.getAll.mockReset();
    m.getPrizes.mockReset().mockResolvedValue([]);
    m.getSchedules.mockReset().mockResolvedValue([]);
    m.replace.mockReset();
    m.refresh.mockReset();
    m.tx.mockReset().mockResolvedValue(true);
    m.query = "";
    m.address = undefined;
    m.prices = new Map();
    m.simple = { rewards: [], isLoading: false, hasError: false };
});

describe("rewards directory: one row per staked token", () => {
    it("lists every staked token once, closed, with what it earns, the total staked and its reward count", async () => {
        const { default: BigNumber } = await import("bignumber.js");
        m.getAll.mockResolvedValue(DRS);
        m.getSchedules.mockImplementation(async (d: string) => (d === "ubze" ? [schedule("1", "ubze", "1000000", 10, 1), schedule("2", TOK, "1000000", 10, 1)] : []));
        m.simple.rewards = [reward("1"), reward("2", { staking_denom: "ubze", prize_denom: TOK })];
        m.prices = new Map([["ubze", new BigNumber("0.01")]]);
        renderPage();

        await waitFor(() => expect(within(group("BZE")).getByText("+ 1 token")).toBeInTheDocument());
        expect(tickers()).toEqual(["BZE", "TOK"]);
        expect(screen.getByTestId("rewards-count")).toHaveTextContent("2 tokens · 4 rewards");

        const bze = within(group("BZE"));
        expect(bze.getByTestId("reward-group-count")).toHaveTextContent("2 rewards");
        // 1,500 in the compounded reward + 5 in simple #2, at $0.01.
        expect(bze.getByTestId("reward-group-staked")).toHaveTextContent("Total staked1.505K≈ $15.05");
        expect(header("BZE")).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByTestId("reward-group-body")).not.toBeInTheDocument();
        // "Last paid" is gone, and no staker counts: the chain doesn't store them.
        expect(screen.getByRole("region", { name: "Rewards by staked token" })).not.toHaveTextContent(/Last paid|stakers/);
    });

    it("opens and closes a row; a list of one row starts open", async () => {
        m.getAll.mockResolvedValue(DRS);
        const view = renderPage();
        await waitFor(() => expect(groups()).toHaveLength(2));

        await toggle("TOK");
        expect(header("TOK")).toHaveAttribute("aria-expanded", "true");
        expect(within(group("TOK")).getByTestId("compounded-item")).toBeInTheDocument();
        await toggle("TOK");
        expect(within(group("TOK")).queryByTestId("compounded-item")).not.toBeInTheDocument();
        view.unmount();

        m.getAll.mockResolvedValue([DRS[0]]);
        renderPage();
        await waitFor(() => expect(header("BZE")).toHaveAttribute("aria-expanded", "true"));
    });

    it("links Create a reward to the reward kinds", () => {
        m.getAll.mockResolvedValue([]);
        renderPage();

        expect(screen.getByRole("heading", { level: 1, name: "Rewards" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create a reward" })).toHaveAttribute("href", "/create/rewards");
    });
});

describe("rewards directory: a token's rewards", () => {
    it("compounded: the DEX spec line, each daily prize with its days and Extend, Add daily prize, Airdrop and DEX", async () => {
        m.getAll.mockResolvedValue([DRS[0]]);
        m.getPrizes.mockResolvedValue(prizes("ubze", TOK));
        m.getSchedules.mockResolvedValue([schedule("3", "ubze", "50000000", 10, 6), schedule("4", TOK, "1000000", 30, 2)]);
        renderPage();

        const item = within(await screen.findByTestId("compounded-item"));
        await waitFor(() => expect(item.getAllByTestId("daily-prize-line")).toHaveLength(2));
        expect(item.getByText("Compounded")).toBeInTheDocument();
        expect(item.getByTestId("reward-spec")).toHaveTextContent("Unlock 7d · Paying daily");
        expect(item.getAllByTestId("daily-prize-line").map(l => l.textContent)).toEqual(["50 BZE / day · 6 / 10 days" + "Extend", "1 TOK / day · 2 / 30 days" + "Extend"]);
        expect(item.getAllByRole("link", { name: "Extend" }).map(l => l.getAttribute("href")))
            .toEqual(["/denom-reward/schedule?denom=ubze&schedule=3", "/denom-reward/schedule?denom=ubze&schedule=4"]);
        expect(item.getByRole("link", { name: "Add daily prize" })).toHaveAttribute("href", "/denom-reward/schedule?denom=ubze");
        expect(item.getByRole("link", { name: "Airdrop" })).toHaveAttribute("href", "/airdrop?to=stakers&denom=ubze");
        const link = item.getByRole("link", { name: /DEX/ });
        expect(link).toHaveAttribute("href", dex("compounded:ubze"));
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        // Its token page isn't a button any more, and no prize says when it last paid.
        expect(item.queryByRole("link", { name: "Open token" })).not.toBeInTheDocument();
        expect(group("BZE")).not.toHaveTextContent("Last paid");
    });

    it("compounded: Nothing scheduled, Airdrops only, and Airdrop disabled while nothing is staked", async () => {
        m.getAll.mockResolvedValue([DRS[1]]);
        renderPage();

        const item = within(await screen.findByTestId("compounded-item"));
        await waitFor(() => expect(item.getByText("Nothing scheduled")).toBeInTheDocument());
        expect(item.getByTestId("reward-spec")).toHaveTextContent("Unlock 1d · Airdrops only");
        const airdrop = item.getByRole("button", { name: "Airdrop" });
        expect(airdrop).toBeDisabled();
        expect(airdrop).toHaveAttribute("title", "Nothing staked yet");
    });

    it("compounded: a failed prize query isn't 'nothing scheduled'", async () => {
        m.getAll.mockResolvedValue([DRS[0]]);
        m.getPrizes.mockRejectedValue(new Error("boom"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        expect(await screen.findByText("Couldn't load its daily prizes.")).toBeInTheDocument();
        expect(screen.queryByText("Nothing scheduled")).not.toBeInTheDocument();
        expect(screen.getByTestId("reward-spec")).toHaveTextContent(/^Unlock 7d$/);
    });

    it("simple: #id, the DEX spec line, what it pays a day and its days, Extend, Airdrop once staked, DEX", async () => {
        m.getAll.mockResolvedValue([]);
        m.simple.rewards = [
            reward("000000000005", { duration: 30, payouts: 26, lock: 3, min_stake: 1000000000n }),
            reward("000000000006", { staked_amount: "0" }),
            reward("000000000007", { payouts: 30, staked_amount: "1" }),
        ];
        renderPage();

        const [running, waiting, finished] = await screen.findAllByTestId("simple-reward-row");
        expect(within(running).getByText("#000000000005")).toBeInTheDocument();
        expect(within(running).getByTestId("reward-spec")).toHaveTextContent("Unlock 3d · Min 1K TOK · Running");
        expect(within(running).getByTestId("simple-reward-facts")).toHaveTextContent("2 BZE / day · 26 / 30 days");
        expect(within(running).getByRole("link", { name: "Extend" })).toHaveAttribute("href", "/reward/extend?id=000000000005");
        expect(within(running).getByRole("link", { name: "Airdrop" })).toHaveAttribute("href", `/airdrop?to=stakers&denom=${encodeURIComponent(TOK)}&id=000000000005`);
        expect(within(running).getByRole("link", { name: /DEX/ })).toHaveAttribute("href", dex("simple:000000000005"));

        expect(within(waiting).getByTestId("reward-spec")).toHaveTextContent("Unlock instant · Waiting for stakers");
        expect(within(waiting).queryByRole("link", { name: "Airdrop" })).not.toBeInTheDocument();
        expect(within(finished).getByTestId("reward-spec")).toHaveTextContent("Finished");
        // A finished reward can still be extended.
        expect(within(finished).getByRole("link", { name: "Extend" })).toBeInTheDocument();
    });

    it("Delete shows only once a finished reward has nobody staked, and deletes it", async () => {
        m.getAll.mockResolvedValue([]);
        m.address = "bze1someone";
        m.simple.rewards = [
            reward("1"),
            reward("2", { payouts: 30, staked_amount: "37000000" }),
            reward("3", { payouts: 30, staked_amount: "0" }),
        ];
        renderPage();

        const [running, staked, empty] = await screen.findAllByTestId("simple-reward-row");
        expect(within(running).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
        expect(within(staked).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

        await userEvent.click(within(empty).getByRole("button", { name: "Delete" }));
        await userEvent.click(within(empty).getByRole("button", { name: "Delete reward #3" }));
        expect(m.tx).toHaveBeenCalledTimes(1);
        const [[msgs, opts]] = m.tx.mock.calls;
        expect(msgs[0].value).toEqual({ creator: "bze1someone", rewardId: "3" });
        opts.onSuccess();
        expect(m.refresh).toHaveBeenCalled();
    });

    it("a token without a compounded reward offers Make X stakable; an LP token doesn't", async () => {
        m.getAll.mockResolvedValue([DRS[0]]);
        m.simple.rewards = [reward("1"), reward("2", { staking_denom: LP })];
        renderPage();

        await waitFor(() => expect(groups()).toHaveLength(3));
        await toggle("TOK");
        expect(within(group("TOK")).getByTestId("stakable-offer")).toHaveTextContent("No compounded reward yet.");
        expect(within(group("TOK")).getByRole("link", { name: "Make TOK stakable" })).toHaveAttribute("href", `/denom-reward/new?denom=${encodeURIComponent(TOK)}`);
        await toggle("TOK/BZE LP");
        expect(within(group("TOK/BZE LP")).queryByTestId("stakable-offer")).not.toBeInTheDocument();
    });
});

describe("rewards directory: kind, filter and URL", () => {
    it("one kind keeps its rewards only; an old tab= maps to its kind", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.simple.rewards = [reward("1")];

        m.query = "kind=compounded";
        let view = renderPage();
        await waitFor(() => expect(screen.getByTestId("rewards-count")).toHaveTextContent("2 tokens · 2 rewards"));
        view.unmount();

        m.query = "tab=programs";
        view = renderPage();
        await waitFor(() => expect(tickers()).toEqual(["TOK"]));
        expect(screen.getAllByTestId("simple-reward-row")).toHaveLength(1);
        expect(screen.queryByTestId("compounded-item")).not.toBeInTheDocument();
        // Only every kind together offers Make X stakable.
        expect(screen.queryByTestId("stakable-offer")).not.toBeInTheDocument();
        view.unmount();

        m.query = "tab=holder";
        renderPage();
        await waitFor(() => expect(screen.getByTestId("rewards-count")).toHaveTextContent("2 tokens · 2 rewards"));
    });

    it("writes kind, filter and sort to the URL, keeping the rest", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.query = "sort=name&q=tok";
        renderPage();
        await waitFor(() => expect(groups()).toHaveLength(1));

        await userEvent.click(within(screen.getByRole("group", { name: "Kind" })).getByRole("button", { name: "Simple" }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=simple&filter=all&sort=name&q=tok");
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filter" }), "finished");
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=finished&sort=name&q=tok");
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "prizes");
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=all&sort=prizes&q=tok");
        expect(within(screen.getByRole("combobox", { name: "Filter" })).getAllByRole("option").map(o => o.textContent))
            .toEqual(["Any", "Has stakers", "Paying daily", "Yours", "Running", "Finished"]);
    });

    it("filters: Has stakers, Paying daily, Yours with its tag, Finished", async () => {
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getSchedules.mockImplementation(async (d: string) => (d === "ubze" ? [schedule("1", "ubze", "1", 5, 1)] : []));
        m.address = "bze1me";
        m.simple.rewards = [reward("1"), reward("2", { payouts: 30 }), reward("3", { staking_denom: MINE })];

        m.query = "filter=stakers";
        let view = renderPage();
        await waitFor(() => expect(tickers()).toEqual(["BZE", "MINE", "TOK"]));
        // TOK's compounded reward has nobody staked: only its two simple rewards stay.
        expect(within(group("TOK")).getByTestId("reward-group-count")).toHaveTextContent("2 rewards");
        view.unmount();

        m.query = "filter=paying";
        view = renderPage();
        await waitFor(() => expect(within(group("BZE")).getByTestId("reward-group-count")).toHaveTextContent("1 reward"));
        await waitFor(() => expect(tickers()).toEqual(["BZE", "TOK", "MINE"]));
        expect(within(group("TOK")).getByTestId("reward-group-count")).toHaveTextContent("1 reward");
        view.unmount();

        m.query = "filter=mine";
        view = renderPage();
        await waitFor(() => expect(tickers()).toEqual(["MINE"]));
        expect(within(group("MINE")).getByText("Yours")).toBeInTheDocument();
        expect(within(group("MINE")).getByTestId("reward-group-count")).toHaveTextContent("2 rewards");
        view.unmount();

        m.query = "status=finished";
        renderPage();
        await waitFor(() => expect(tickers()).toEqual(["TOK"]));
        expect(screen.getAllByTestId("simple-reward-row").map(r => within(r).getByText(/^#/).textContent)).toEqual(["#2"]);
    });

    it("says so when nothing matches", async () => {
        m.getAll.mockResolvedValue([DRS[1]]);
        m.simple.rewards = [reward("1", { payouts: 30 })];
        m.query = "filter=paying";
        renderPage();

        await waitFor(() => expect(screen.getByTestId("rewards-no-match")).toHaveTextContent("Nothing matches these filters."));
    });
});

describe("rewards directory: search", () => {
    it("searches by staked token and writes the search to the URL", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.simple.rewards = [reward("1"), reward("2", { staking_denom: "ubze", prize_denom: TOK })];
        renderPage();
        await waitFor(() => expect(groups()).toHaveLength(2));

        await userEvent.type(screen.getByRole("textbox", { name: "Search by staked token" }), "token");
        await waitFor(() => expect(tickers()).toEqual(["TOK"]));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=all&sort=staked&q=token");

        await userEvent.clear(screen.getByRole("textbox", { name: "Search by staked token" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Search by staked token" }), "zzz");
        expect(screen.getByTestId("rewards-no-match")).toHaveTextContent("No reward stakes a token matching 'zzz'.");
    });

    it("?denom= prefills the search with that token, matches it exactly, opens its row and scrolls to it", async () => {
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        m.getAll.mockResolvedValue([...DRS, { staking_denom: LP, lock: 1, min_stake: "0", staked_amount: "1" }]);
        m.query = "denom=ubze";
        renderPage();

        expect(screen.getByRole("textbox", { name: "Search by staked token" })).toHaveValue("ubze");
        // The LP share's denom ends in ubze too, but the deep link asked for ubze itself.
        await waitFor(() => expect(tickers()).toEqual(["BZE"]));
        expect(header("BZE")).toHaveAttribute("aria-expanded", "true");
        await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
        expect(scroll.mock.contexts[0]).toBe(group("BZE"));
    });
});

describe("rewards directory: sorts", () => {
    it("most staked by USD when priced, else the display amount; most prize tokens; A–Z", async () => {
        const { default: BigNumber } = await import("bignumber.js");
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getSchedules.mockImplementation(async (d: string) =>
            Array.from({ length: d === MINE ? 3 : d === "ubze" ? 2 : 0 }, (_, i) => schedule(`${i}`, `p${i}`, "1", 10, 1)));

        // 1,500 BZE at $0.01 = $15 < 50 MINE at $1 = $50.
        m.prices = new Map([["ubze", new BigNumber("0.01")], [MINE, new BigNumber(1)], [TOK, new BigNumber(1)]]);
        let view = renderPage();
        await waitFor(() => expect(tickers()).toEqual(["MINE", "BZE", "TOK"]));
        view.unmount();

        m.prices = new Map();
        view = renderPage();
        await waitFor(() => expect(tickers()).toEqual(["BZE", "MINE", "TOK"]));
        view.unmount();

        m.query = "sort=prizes";
        view = renderPage();
        await waitFor(() => expect(within(group("MINE")).getByText("+ 2 tokens")).toBeInTheDocument());
        await waitFor(() => expect(tickers()).toEqual(["MINE", "BZE", "TOK"]));
        view.unmount();

        m.query = "sort=name";
        renderPage();
        await waitFor(() => expect(tickers()).toEqual(["BZE", "MINE", "TOK"]));
    });
});

describe("rewards directory: loading, errors and empty", () => {
    it("shows shimmers while loading", () => {
        m.getAll.mockReturnValue(new Promise(() => {}));
        m.simple = { rewards: [], isLoading: true, hasError: false };
        renderPage();

        expect(screen.getByTestId("rewards-loading")).toBeInTheDocument();
    });

    it("an error is never 'no rewards': it says so, retries, and lists what did load", async () => {
        m.getAll.mockRejectedValueOnce(new Error("501")).mockResolvedValueOnce([DRS[0]]);
        m.simple = { rewards: [], isLoading: false, hasError: true };
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        expect(await screen.findByText("Couldn't load the compounded rewards.")).toBeInTheDocument();
        expect(screen.getByText("Couldn't load the simple rewards.")).toBeInTheDocument();
        expect(screen.queryByText("No staking rewards yet.")).not.toBeInTheDocument();

        const [retryCompounded, retrySimple] = screen.getAllByRole("button", { name: /Retry/ });
        await userEvent.click(retrySimple);
        expect(m.refresh).toHaveBeenCalledTimes(1);
        await userEvent.click(retryCompounded);
        await waitFor(() => expect(groups()).toHaveLength(1));
        expect(m.getAll).toHaveBeenCalledTimes(2);
    });

    it("the empty state offers to make a token stakable", async () => {
        m.getAll.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByText("No staking rewards yet.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Make a token stakable" })).toHaveAttribute("href", "/denom-reward/new");
    });
});
