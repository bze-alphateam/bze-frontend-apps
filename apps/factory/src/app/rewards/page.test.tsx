import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

// The directory against mocked chain queries: the DR list plus per-DR prize and schedule lists, and
// the simple rewards hook. Order assertions wait for the rows to settle (BFE-253).
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
        useEpochs: () => ({ dayEpochInfo: { current_epoch: "10" } }),
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

const cards = () => screen.queryAllByTestId("compounded-reward-card");
const cardTitles = () => cards().map(c => within(c).getByRole("heading").textContent);
const simpleTitles = () => screen.queryAllByTestId("simple-reward-row").map(r => within(r).getByRole("heading").textContent);
const card = (title: string) => cards().find(c => within(c).getByRole("heading").textContent === title)!;

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

describe("rewards directory: sections", () => {
    it("lists one card per compounded reward and one row per simple reward, with their counts", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.simple.rewards = [reward("1"), reward("2", { staking_denom: "ubze", prize_denom: TOK })];
        renderPage();

        await waitFor(() => expect(cardTitles()).toEqual(["Stake BZE", "Stake TOK"]));
        expect(simpleTitles()).toEqual(["Stake TOK · earn BZE", "Stake BZE · earn TOK"]);
        expect(screen.getByRole("heading", { level: 2, name: "Compounded · one per staked token · 2" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 2, name: "Simple · fixed budget, end date · 2" })).toBeInTheDocument();

        expect(within(card("Stake BZE")).getByTestId("compounded-meta")).toHaveTextContent("1,500 staked · unstaking takes 7 days");
        expect(within(card("Stake TOK")).getByTestId("compounded-meta")).toHaveTextContent("0 staked · unstaking takes 1 day");
        // No staker counts: the chain doesn't store them.
        cards().forEach(c => expect(c).not.toHaveTextContent(/stakers/));
    });

    it("shows the staked USD value when priced", async () => {
        const { default: BigNumber } = await import("bignumber.js");
        m.getAll.mockResolvedValue([DRS[0]]);
        m.prices = new Map([["ubze", new BigNumber("0.01")]]);
        renderPage();

        await waitFor(() => expect(screen.getByTestId("compounded-meta")).toHaveTextContent("1,500 staked · ≈$15 · unstaking takes 7 days"));
    });

    it("lists the running daily prizes with their end and the prize tokens with when they last paid", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 9, 22, 12));
        m.getAll.mockResolvedValue([DRS[0]]);
        m.getPrizes.mockResolvedValue(prizes("ubze", TOK));
        m.getSchedules.mockResolvedValue([schedule("7", "ubze", "50000000", 10, 6)]);
        renderPage();

        const line = await screen.findByTestId("daily-prize-line");
        expect(line).toHaveTextContent("50 BZE a day · ends 26 Oct");
        expect(screen.getAllByTestId("prize-token-line").map(l => l.textContent)).toEqual(["BZELast paid Yesterday", "TOKLast paid Yesterday"]);
        vi.useRealTimers();
    });

    it("says no daily prize is running, and that a failed prize query isn't 'no prizes'", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.getPrizes.mockImplementation(async (d: string) => {
            if (d === TOK) throw new Error("boom");
            return [];
        });
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        await waitFor(() => expect(within(card("Stake BZE")).getByText("No daily prize running.")).toBeInTheDocument());
        await waitFor(() => expect(within(card("Stake TOK")).getByText(/Couldn't load its prizes/)).toBeInTheDocument());
    });

    it("links Create a reward to the reward kinds", () => {
        m.getAll.mockResolvedValue([]);
        renderPage();

        expect(screen.getByRole("heading", { level: 1, name: "Rewards" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create a reward" })).toHaveAttribute("href", "/create/rewards");
    });
});

describe("rewards directory: actions", () => {
    it("compounded: Add daily prize, Airdrop once, Extend → per daily prize, Open token for Factory tokens only", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.getSchedules.mockImplementation(async (d: string) => (d === "ubze" ? [schedule("3", "ubze", "1000000", 10, 1), schedule("4", TOK, "1000000", 10, 1)] : []));
        renderPage();

        await waitFor(() => expect(within(card("Stake BZE")).getAllByRole("link", { name: "Extend →" })).toHaveLength(2));
        const bze = within(card("Stake BZE"));
        expect(bze.getByRole("link", { name: "Add daily prize" })).toHaveAttribute("href", "/denom-reward/schedule?denom=ubze");
        expect(bze.getByRole("link", { name: "Airdrop once" })).toHaveAttribute("href", "/denom-reward/airdrop?denom=ubze");
        expect(bze.getAllByRole("link", { name: "Extend →" }).map(l => l.getAttribute("href")))
            .toEqual(["/denom-reward/schedule?denom=ubze&schedule=3", "/denom-reward/schedule?denom=ubze&schedule=4"]);
        // ubze isn't a Factory token: it has no token page.
        expect(bze.queryByRole("link", { name: "Open token" })).not.toBeInTheDocument();

        const tok = within(card("Stake TOK"));
        expect(tok.getByRole("link", { name: "Open token" })).toHaveAttribute("href", `/tokens/token?denom=${encodeURIComponent(TOK)}`);
    });

    it("disables Airdrop once with the reason when nothing is staked", async () => {
        m.getAll.mockResolvedValue(DRS);
        renderPage();

        await waitFor(() => expect(cards()).toHaveLength(2));
        const tok = within(card("Stake TOK"));
        expect(tok.getByRole("button", { name: "Airdrop once" })).toBeDisabled();
        expect(tok.getByTestId("airdrop-disabled")).toHaveTextContent("Nothing staked yet");
        expect(within(card("Stake BZE")).queryByTestId("airdrop-disabled")).not.toBeInTheDocument();
    });

    it("simple: Extend links to its wizard; the end day, or finished", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 9, 22, 12));
        m.getAll.mockResolvedValue([]);
        m.simple.rewards = [reward("000000000005", { duration: 30, payouts: 26 }), reward("000000000006", { payouts: 30, staked_amount: "0" })];
        renderPage();

        const [running, finished] = screen.getAllByTestId("simple-reward-row");
        expect(within(running).getByRole("link", { name: "Extend" })).toHaveAttribute("href", "/reward/extend?id=000000000005");
        expect(within(running).getByTestId("simple-reward-facts")).toHaveTextContent("2 BZE a day");
        expect(within(running).getByTestId("simple-reward-facts")).toHaveTextContent("ends 26 Oct");
        expect(within(running).getByTestId("simple-reward-facts")).toHaveTextContent("5 TOK staked");
        expect(within(finished).getByTestId("simple-reward-facts")).toHaveTextContent("finished");
        vi.useRealTimers();
    });

    it("Delete shows only for finished rewards, and works only once nothing is staked", async () => {
        m.getAll.mockResolvedValue([]);
        m.address = "bze1someone";
        m.simple.rewards = [
            reward("1"),
            reward("2", { payouts: 30, staked_amount: "37000000" }),
            reward("3", { payouts: 30, staked_amount: "0" }),
        ];
        renderPage();

        const [running, staked, empty] = screen.getAllByTestId("simple-reward-row");
        expect(within(running).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
        expect(within(staked).getByRole("button", { name: "Delete" })).toBeDisabled();
        expect(within(staked).getByTestId("staking-reward-delete-blocker")).toHaveTextContent("37 TOK still staked — stakers must exit first before it can be deleted.");

        await userEvent.click(within(empty).getByRole("button", { name: "Delete" }));
        await userEvent.click(within(empty).getByRole("button", { name: "Delete reward #3" }));
        expect(m.tx).toHaveBeenCalledTimes(1);
        const [[msgs, opts]] = m.tx.mock.calls;
        expect(msgs[0].value).toEqual({ creator: "bze1someone", rewardId: "3" });
        opts.onSuccess();
        expect(m.refresh).toHaveBeenCalled();
    });
});

describe("rewards directory: kind, filters and URL", () => {
    it("one kind shows its section only; an old tab= maps to its kind", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.simple.rewards = [reward("1")];

        m.query = "kind=compounded";
        let view = renderPage();
        await waitFor(() => expect(cards()).toHaveLength(2));
        expect(screen.queryByRole("region", { name: "Simple rewards" })).not.toBeInTheDocument();
        view.unmount();

        m.query = "tab=programs";
        view = renderPage();
        expect(screen.getAllByTestId("simple-reward-row")).toHaveLength(1);
        expect(screen.queryByRole("region", { name: "Compounded rewards" })).not.toBeInTheDocument();
        // Paying now is about daily prizes: no chip for it here.
        expect(screen.queryByRole("button", { name: "Paying now" })).not.toBeInTheDocument();
        view.unmount();

        m.query = "tab=holder";
        renderPage();
        await waitFor(() => expect(cards()).toHaveLength(2));
        expect(screen.queryByRole("region", { name: "Simple rewards" })).not.toBeInTheDocument();
        // Status chips are for simple rewards only.
        expect(screen.queryByRole("group", { name: "Simple reward status" })).not.toBeInTheDocument();
    });

    it("writes kind, filter, status and sort to the URL, keeping the rest", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.query = "sort=name&q=tok";
        renderPage();
        await waitFor(() => expect(cards()).toHaveLength(1));

        await userEvent.click(within(screen.getByRole("group", { name: "Kind" })).getByRole("button", { name: "Simple" }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=simple&filter=all&sort=name&status=all&q=tok");
        await userEvent.click(screen.getByRole("button", { name: "Has stakers" }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=stakers&sort=name&status=all&q=tok");
        await userEvent.click(screen.getByRole("button", { name: "Finished" }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=all&sort=name&status=finished&q=tok");
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "prizes");
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=all&sort=prizes&status=all&q=tok");
    });

    it("filters: Has stakers, Paying now, Created by you with its tag, simple status", async () => {
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getSchedules.mockImplementation(async (d: string) => (d === "ubze" ? [schedule("1", "ubze", "1", 5, 1)] : []));
        m.address = "bze1me";
        m.simple.rewards = [reward("1"), reward("2", { payouts: 30 }), reward("3", { staking_denom: MINE })];

        m.query = "filter=stakers";
        let view = renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake BZE", "Stake MINE"]));
        view.unmount();

        m.query = "filter=paying";
        view = renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake BZE"]));
        view.unmount();

        m.query = "filter=mine";
        view = renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake MINE"]));
        expect(within(card("Stake MINE")).getByText("Created by you")).toBeInTheDocument();
        expect(simpleTitles()).toEqual(["Stake MINE · earn BZE"]);
        view.unmount();

        m.query = "status=finished";
        renderPage();
        await waitFor(() => expect(cards()).toHaveLength(3));
        expect(screen.getAllByTestId("simple-reward-row").map(r => within(r).getByText(/^#/).textContent)).toEqual(["#2"]);
    });

    it("says so when nothing matches", async () => {
        m.getAll.mockResolvedValue([DRS[1]]);
        m.simple.rewards = [reward("1", { payouts: 30 })];
        m.query = "filter=stakers&status=running";
        renderPage();

        expect(await screen.findByTestId("compounded-no-match")).toHaveTextContent("Nothing matches these filters.");
        expect(screen.getByTestId("simple-no-match")).toHaveTextContent("Nothing matches these filters.");
    });
});

describe("rewards directory: search", () => {
    it("searches both sections by staked token and writes the search to the URL", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.simple.rewards = [reward("1"), reward("2", { staking_denom: "ubze", prize_denom: TOK })];
        renderPage();
        await waitFor(() => expect(cards()).toHaveLength(2));

        await userEvent.type(screen.getByRole("textbox", { name: "Search by staked token" }), "token");
        await waitFor(() => expect(cardTitles()).toEqual(["Stake TOK"]));
        expect(simpleTitles()).toEqual(["Stake TOK · earn BZE"]);
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?kind=all&filter=all&sort=staked&status=all&q=token");

        await userEvent.clear(screen.getByRole("textbox", { name: "Search by staked token" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Search by staked token" }), "zzz");
        expect(screen.getByTestId("compounded-no-match")).toHaveTextContent("No reward stakes a token matching 'zzz'.");
    });

    it("?denom= prefills the search with that token, matches it exactly and scrolls to its card", async () => {
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        m.getAll.mockResolvedValue([...DRS, { staking_denom: LP, lock: 1, min_stake: "0", staked_amount: "1" }]);
        m.query = "denom=ubze";
        renderPage();

        expect(screen.getByRole("textbox", { name: "Search by staked token" })).toHaveValue("ubze");
        // The LP share's denom ends in ubze too, but the deep link asked for ubze itself.
        await waitFor(() => expect(cardTitles()).toEqual(["Stake BZE"]));
        await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
        expect(scroll.mock.contexts[0]).toBe(card("Stake BZE"));
    });
});

describe("rewards directory: sorts", () => {
    it("most staked by USD when priced, else the display amount; most prize tokens; A–Z", async () => {
        const { default: BigNumber } = await import("bignumber.js");
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getPrizes.mockImplementation(async (d: string) => prizes(...Array.from({ length: d === MINE ? 5 : d === "ubze" ? 3 : 0 }, (_, i) => `p${i}`)));

        // 1,500 BZE at $0.01 = $15 < 50 MINE at $1 = $50.
        m.prices = new Map([["ubze", new BigNumber("0.01")], [MINE, new BigNumber(1)], [TOK, new BigNumber(1)]]);
        let view = renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake MINE", "Stake BZE", "Stake TOK"]));
        view.unmount();

        m.prices = new Map();
        view = renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake BZE", "Stake MINE", "Stake TOK"]));
        view.unmount();

        m.query = "sort=prizes";
        view = renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake MINE", "Stake BZE", "Stake TOK"]));
        view.unmount();

        m.query = "sort=name";
        renderPage();
        await waitFor(() => expect(cardTitles()).toEqual(["Stake BZE", "Stake MINE", "Stake TOK"]));
    });

    it("sorts simple rewards too, running ones first", async () => {
        m.getAll.mockResolvedValue([]);
        m.simple.rewards = [
            reward("1", { staking_denom: "ubze", staked_amount: "1000000" }),
            reward("2", { staking_denom: MINE, staked_amount: "9000000", payouts: 30 }),
            reward("3", { staking_denom: TOK, staked_amount: "5000000" }),
        ];

        m.query = "sort=staked";
        const view = renderPage();
        await waitFor(() => expect(simpleTitles()).toEqual(["Stake TOK · earn BZE", "Stake BZE · earn BZE", "Stake MINE · earn BZE"]));
        view.unmount();

        m.query = "sort=name";
        renderPage();
        await waitFor(() => expect(simpleTitles()).toEqual(["Stake BZE · earn BZE", "Stake TOK · earn BZE", "Stake MINE · earn BZE"]));
    });
});

describe("rewards directory: loading, errors and empty", () => {
    it("shows shimmers while loading", () => {
        m.getAll.mockReturnValue(new Promise(() => {}));
        m.simple = { rewards: [], isLoading: true, hasError: false };
        renderPage();

        expect(screen.getByTestId("compounded-loading")).toBeInTheDocument();
        expect(screen.getByTestId("simple-loading")).toBeInTheDocument();
    });

    it("an error is never 'no rewards': it says so and retries", async () => {
        m.getAll.mockRejectedValueOnce(new Error("501")).mockResolvedValueOnce([DRS[0]]);
        m.simple = { rewards: [], isLoading: false, hasError: true };
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        expect(await screen.findByText("Couldn't load the compounded rewards.")).toBeInTheDocument();
        expect(screen.getByText("Couldn't load the simple rewards.")).toBeInTheDocument();
        expect(screen.queryByText("No compounded rewards yet.")).not.toBeInTheDocument();
        expect(screen.queryByText("No simple rewards yet.")).not.toBeInTheDocument();

        const [retryCompounded, retrySimple] = screen.getAllByRole("button", { name: /Retry/ });
        await userEvent.click(retrySimple);
        expect(m.refresh).toHaveBeenCalledTimes(1);
        await userEvent.click(retryCompounded);
        await waitFor(() => expect(cards()).toHaveLength(1));
        expect(m.getAll).toHaveBeenCalledTimes(2);
    });

    it("the empty states offer to create one", async () => {
        m.getAll.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByText("No compounded rewards yet.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Make a token stakable" })).toHaveAttribute("href", "/denom-reward/new");
        expect(screen.getByText("No simple rewards yet.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create a simple reward" })).toHaveAttribute("href", "/reward/new");
    });
});
