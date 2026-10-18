import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// The directory against mocked chain queries: the DR list plus per-DR prize and schedule lists.
// Both layouts render in jsdom (no media queries); the assertions read the wide-screen table rows.
const m = vi.hoisted(() => ({
    getAll: vi.fn(),
    getPrizes: vi.fn(),
    getSchedules: vi.fn(),
    navigate: vi.fn(),
    replace: vi.fn(),
    query: "",
    tokens: [] as { asset: Partial<Asset>; admin?: string }[],
    prices: new Map<string, unknown>(),
    programs: { rewards: [] as { payouts: number; duration: number }[], isLoading: false, hasError: false, refresh: () => {} },
}));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate, replace: m.replace }),
    useNavigationWithParams: () => ({
        navigate: m.navigate,
        replace: m.replace,
        getQueryParam: (k: string) => new URLSearchParams(m.query).get(k),
        denomParam: null,
    }),
}));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => ({ tokens: m.tokens, isLoading: false }) }));
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => m.programs }));
vi.mock("@/components/rewards/staking-programs-list", () => ({
    StakingProgramsList: (p: { pinMine?: boolean; status?: string; onStatus?: (s: string) => void; programs?: unknown }) => (
        <div data-testid="staking-programs" data-pin-mine={String(p.pinMine)} data-status={p.status}>
            {p.programs === m.programs && "staking programs list"}
            <button onClick={() => p.onStatus?.("finished")}>show finished</button>
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <button onClick={() => onSelect({ denom: "uatom" })}>pick ATOM</button>
    ),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" },
        "factory/bze1owner/utok": { denom: "factory/bze1owner/utok", ticker: "TOK", name: "Token", decimals: 6, logo: "" },
        "factory/bze1me/umine": MINE,
        "factory/bze1me/unew": NEW,
    };
    return {
        ...actual,
        useAssets: () => ({ getAsset: (d: string) => assets[d], denomTicker: (d: string) => assets[d]?.ticker ?? d }),
        useAssetsContext: () => ({ usdPricesMap: m.prices }),
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        getAllDenomRewards: () => m.getAll(),
        getDenomRewardPrizes: (denom: string) => m.getPrizes(denom),
        getDenomRewardSchedules: (denom: string) => m.getSchedules(denom),
    };
});

const { MINE, NEW } = vi.hoisted(() => ({
    MINE: { denom: "factory/bze1me/umine", ticker: "MINE", name: "Mine", decimals: 6, logo: "" },
    NEW: { denom: "factory/bze1me/unew", ticker: "NEW", name: "Newish", decimals: 6, logo: "" },
}));

import RewardsPage from "./page";

const DRS = [
    { staking_denom: "ubze", lock: 7, min_stake: "0", staked_amount: "1500000000" },
    { staking_denom: "factory/bze1owner/utok", lock: 1, min_stake: "0", staked_amount: "0" },
];
const MINE_DR = { staking_denom: MINE.denom, lock: 3, min_stake: "0", staked_amount: "50000000" };

const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
const schedules = (...prizeDenoms: string[]) => prizeDenoms.map(prize_denom => ({ prize_denom }));

function renderPage() {
    return render(<RewardsPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const tableRows = async () => within(await screen.findByRole("table", { name: "Holder rewards" })).findAllByTestId("denom-reward-row");
const rowTickers = async () => (await tableRows()).map(r => within(r).getAllByText(/^[A-Z]+$/)[0].textContent);

beforeEach(async () => {
    m.getAll.mockReset();
    m.getPrizes.mockReset();
    m.getSchedules.mockReset();
    m.navigate.mockReset();
    m.replace.mockReset();
    m.query = "";
    m.tokens = [];
    m.prices = new Map();
    m.programs = { rewards: [], isLoading: false, hasError: false, refresh: () => {} };
    m.getPrizes.mockResolvedValue([]);
    m.getSchedules.mockResolvedValue([]);
});

describe("rewards directory", () => {
    it("lists every DR with staked, prize tokens, paying and the unstaking wait", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.getPrizes.mockImplementation(async (d: string) => (d === "ubze" ? list(3) : list(0)));
        m.getSchedules.mockImplementation(async (d: string) => (d === "ubze" ? schedules("ubze", "ubze") : []));
        renderPage();

        const rows = await tableRows();
        expect(rows).toHaveLength(2);

        const bze = within(rows[0]);
        expect(bze.getByText("BZE")).toBeInTheDocument();
        expect(bze.getByText("1,500 BZE")).toBeInTheDocument();
        expect(bze.getByText("7 days")).toBeInTheDocument();
        await waitFor(() => expect(bze.getByText("3")).toBeInTheDocument());
        expect(bze.getByText("2 daily prizes")).toBeInTheDocument();

        const tok = within(rows[1]);
        expect(tok.getByText("0 TOK")).toBeInTheDocument();
        expect(tok.getByText("1 day")).toBeInTheDocument();
        await waitFor(() => expect(tok.getByText("No")).toBeInTheDocument());
        expect(tok.getByText("0")).toBeInTheDocument();

        // The tab shows the count, and both layouts carry the rows.
        expect(screen.getByRole("tab", { name: /Holder rewards/ })).toHaveTextContent("2");
        expect(screen.getAllByTestId("denom-reward-card")).toHaveLength(2);
    });

    it("opens the public denom reward page of a row, slash denoms encoded", async () => {
        m.getAll.mockResolvedValue(DRS);
        renderPage();

        const rows = await tableRows();
        await userEvent.click(within(rows[1]).getByText("TOK"));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/token?denom=factory%2Fbze1owner%2Futok");
    });

    it("Airdrop and Add prize open their forms; Airdrop is disabled with the reason when nobody stakes", async () => {
        m.getAll.mockResolvedValue(DRS);
        renderPage();

        const [bze, tok] = await tableRows();
        await userEvent.click(within(bze).getByRole("button", { name: /Airdrop/ }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/airdrop?denom=ubze");
        await userEvent.click(within(tok).getByRole("button", { name: /Add prize/ }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/schedule?denom=factory%2Fbze1owner%2Futok");
        // The buttons don't open the row as well.
        expect(m.navigate).toHaveBeenCalledTimes(2);

        expect(within(tok).getByRole("button", { name: /Airdrop/ })).toBeDisabled();
        expect(within(tok).getByText("No stakers, nobody to airdrop to")).toBeInTheDocument();
        expect(within(bze).queryByText("No stakers, nobody to airdrop to")).not.toBeInTheDocument();
    });

    it("opens any token picked in the search, also one without a DR yet", async () => {
        m.getAll.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByTestId("denom-reward-empty")).toHaveTextContent("No token has holder rewards yet. Pick a token above to make it stakable.");
        await userEvent.click(screen.getByRole("button", { name: "pick ATOM" }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/token?denom=uatom");
    });

    it("shows a dash for the counts of a DR whose queries fail", async () => {
        m.getAll.mockResolvedValue([DRS[0]]);
        m.getPrizes.mockRejectedValue(new Error("boom"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        const [row] = await tableRows();
        await waitFor(() => expect(within(row).getAllByText("—")).toHaveLength(2));
    });

    it("reports a failed list query and retries it", async () => {
        m.getAll.mockRejectedValueOnce(new Error("501")).mockResolvedValueOnce([DRS[0]]);
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        expect(await screen.findByText("Couldn't load the holder rewards")).toBeInTheDocument();
        expect(screen.getByText(/node may be down, or not run chain v8.2.0 yet/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(await tableRows()).toHaveLength(1);
        expect(m.getAll).toHaveBeenCalledTimes(2);
    });

    it("pins the wallet's tokens: with a DR its summary and actions, without one a way to make it stakable", async () => {
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getSchedules.mockImplementation(async (d: string) => (d === MINE.denom ? schedules("ubze", MINE.denom, "ubze") : []));
        m.tokens = [{ asset: MINE }, { asset: NEW }];
        renderPage();

        const yours = within(await screen.findByRole("region", { name: "Your tokens" }));
        const [mine, fresh] = yours.getAllByTestId("your-token");

        await waitFor(() => expect(within(mine).getByText("50 MINE staked · 2 prizes paying · BZE, MINE")).toBeInTheDocument());
        await userEvent.click(within(mine).getByRole("button", { name: /Airdrop/ }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/airdrop?denom=factory%2Fbze1me%2Fumine");
        await userEvent.click(within(mine).getByRole("button", { name: /Add daily prize/ }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/schedule?denom=factory%2Fbze1me%2Fumine");
        await userEvent.click(within(mine).getByRole("button", { name: /Open/ }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/token?denom=factory%2Fbze1me%2Fumine");

        expect(within(fresh).getByText("Not stakable yet. Holders have no reason to stake it.")).toBeInTheDocument();
        await userEvent.click(within(fresh).getByRole("button", { name: "Make NEW stakable" }));
        expect(m.navigate).toHaveBeenLastCalledWith("/denom-reward/token?denom=factory%2Fbze1me%2Funew");

        // Pinned above the directory, which still lists every DR.
        const every = screen.getByRole("region", { name: "Every token" });
        expect(screen.getByRole("region", { name: "Your tokens" }).compareDocumentPosition(every) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(await tableRows()).toHaveLength(3);
    });

    it("hides Your tokens without factory tokens", async () => {
        m.getAll.mockResolvedValue(DRS);
        renderPage();

        await tableRows();
        expect(screen.queryByRole("region", { name: "Your tokens" })).not.toBeInTheDocument();
    });

    it("filters by the URL: Has stakers, Paying now, and the filtered-empty state", async () => {
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getSchedules.mockImplementation(async (d: string) => (d === "ubze" ? schedules("ubze") : []));

        m.query = "filter=stakers";
        const { unmount } = renderPage();
        expect(await rowTickers()).toEqual(["BZE", "MINE"]);
        unmount();

        m.query = "filter=paying";
        renderPage();
        await waitFor(async () => expect(await rowTickers()).toEqual(["BZE"]));
    });

    it("says so when nothing matches the filter", async () => {
        m.getAll.mockResolvedValue([DRS[1]]);
        m.query = "filter=stakers";
        renderPage();

        expect(await screen.findByTestId("denom-reward-filtered-empty")).toHaveTextContent("Nothing matches this filter.");
    });

    it("sorts: most staked by USD value, most prize tokens, name A–Z", async () => {
        const { default: BigNumber } = await import("bignumber.js");
        m.getAll.mockResolvedValue([...DRS, MINE_DR]);
        m.getPrizes.mockImplementation(async (d: string) => list(d === MINE.denom ? 5 : d === "ubze" ? 3 : 0));

        // 1,500 BZE at $0.01 = $15 < 50 MINE at $1 = $50.
        m.prices = new Map([["ubze", new BigNumber("0.01")], [MINE.denom, new BigNumber(1)], ["factory/bze1owner/utok", new BigNumber(1)]]);
        let view = renderPage();
        expect(await rowTickers()).toEqual(["MINE", "BZE", "TOK"]);
        view.unmount();

        // Without prices the display amounts decide.
        m.prices = new Map();
        view = renderPage();
        expect(await rowTickers()).toEqual(["BZE", "MINE", "TOK"]);
        view.unmount();

        m.query = "sort=prizes";
        view = renderPage();
        await waitFor(async () => expect(await rowTickers()).toEqual(["MINE", "BZE", "TOK"]));
        view.unmount();

        m.query = "sort=name";
        renderPage();
        expect(await rowTickers()).toEqual(["BZE", "MINE", "TOK"].sort());
    });

    it("writes filter, sort and tab changes to the URL, keeping the rest", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.query = "sort=name";
        renderPage();
        await tableRows();

        await userEvent.click(screen.getByRole("button", { name: "Has stakers" }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?tab=holder&filter=stakers&sort=name&status=all");

        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "prizes");
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?tab=holder&filter=all&sort=prizes&status=all");

        await userEvent.click(screen.getByRole("tab", { name: /Staking programs/ }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?tab=programs&filter=all&sort=name&status=all");
    });

    it("opens the Staking programs tab from the URL: the page's list, yours pinned, status in the URL", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.query = "tab=programs&status=running";
        renderPage();

        const list = await screen.findByTestId("staking-programs");
        expect(list).toHaveTextContent("staking programs list");
        expect(list).toHaveAttribute("data-pin-mine", "true");
        expect(list).toHaveAttribute("data-status", "running");
        expect(screen.queryByRole("table", { name: "Holder rewards" })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "show finished" }));
        expect(m.replace).toHaveBeenLastCalledWith("/rewards?tab=programs&filter=all&sort=staked&status=finished");
    });

    it("counts the running staking programs on the tab once they load", async () => {
        m.getAll.mockResolvedValue(DRS);
        m.programs = { ...m.programs, rewards: [{ payouts: 1, duration: 10 }, { payouts: 10, duration: 10 }, { payouts: 0, duration: 5 }] };
        const { unmount } = renderPage();
        expect(screen.getByRole("tab", { name: /Staking programs/ })).toHaveTextContent("Staking programs2 running");
        unmount();

        m.programs = { ...m.programs, isLoading: true };
        renderPage();
        expect(screen.getByRole("tab", { name: /Staking programs/ })).not.toHaveTextContent("running");
    });

    it("opens Which reward fits? from the header", async () => {
        m.getAll.mockResolvedValue([]);
        renderPage();

        await userEvent.click(screen.getByRole("button", { name: "Which reward fits?" }));
        expect(await screen.findByRole("dialog", { name: "Which reward fits?" })).toBeInTheDocument();
    });
});
