import {describe, it, expect, vi, beforeEach} from "vitest";
import type {ReactNode} from "react";
import {act, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import {
    type Asset,
    DEFAULT_SETTINGS,
    getChainNativeAssetDenom,
    getSettings,
    setInLocalStorage,
    setSettings,
    SettingsProvider,
    TTL_NO_EXPIRY,
} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

// The URL is a tiny external store: history.replaceState writes it and useSearchParams
// re-renders, as Next syncs the native History API into its router.
const nav = vi.hoisted(() => {
    let search = "";
    const listeners = new Set<() => void>();
    return {
        get: () => search,
        set: (value: string) => {
            search = value;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
});

vi.mock("next/navigation", async () => {
    const {useMemo, useSyncExternalStore} = await import("react");
    return {
        usePathname: () => "/",
        useSearchParams: () => {
            const search = useSyncExternalStore(nav.subscribe, nav.get);
            return useMemo(() => new URLSearchParams(search), [search]);
        },
    };
});

const useCommunitiesContext = vi.fn();
vi.mock("@/hooks/useCommunitiesContext", () => ({
    useCommunitiesContext: () => useCommunitiesContext(),
}));

const useDirectoryData = vi.fn();
vi.mock("@/hooks/useDirectoryData", () => ({
    useDirectoryData: () => useDirectoryData(),
}));

// The shared BeeZee top bar (wallet + settings sidebars) is ui-kit chrome, unchanged by the directory.
vi.mock("@/components/ui/navigation/navbar", () => ({
    TopNavBar: () => <nav aria-label="BeeZee top bar"/>,
}));

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "light", setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import Home from "./page";

forbidNetwork();

function makeAsset(ticker: string, denom: string, extra: Partial<Asset> = {}): Asset {
    return {
        type: "factory", denom, decimals: 6, name: `${ticker} Token`, ticker, logo: "", stable: false,
        verified: false, supply: 1_000_000n, ...extra,
    };
}

const denomOf = (ticker: string) => `factory/bze1owner/u${ticker.toLowerCase()}`;

function factoryAssets(count: number): Map<string, Asset> {
    const map = new Map<string, Asset>();
    for (let i = 0; i < count; i++) {
        // Zero-padded so ticker order matches creation order (TKN000, TKN001…).
        const ticker = `TKN${String(i).padStart(3, "0")}`;
        map.set(denomOf(ticker), makeAsset(ticker, denomOf(ticker)));
    }
    return map;
}

function context(assetsMap: Map<string, Asset>, extra: Record<string, unknown> = {}) {
    return {
        assetsMap,
        isLoading: false,
        poolsMap: new Map(),
        poolsDataMap: new Map(),
        usdPricesMap: new Map(),
        marketsDataMap: new Map(),
        ...extra,
    };
}

function renderHome(search = "") {
    nav.set(search);
    return render(<Home/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <SettingsProvider><ChakraProvider value={defaultSystem}>{children}</ChakraProvider></SettingsProvider>
        ),
    });
}

const tickers = () => screen.getAllByTestId("directory-card").map((card) => within(card).getByText(/^TKN\d+$/).textContent);

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.history, "replaceState").mockImplementation((_data, _unused, url) => {
        nav.set(String(url ?? "").split("?")[1] ?? "");
    });
    useCommunitiesContext.mockReset();
    useDirectoryData.mockReset();
    useDirectoryData.mockReturnValue({kits: new Map(), denomRewards: [], stakingRewards: [], isLoading: false});
});

describe("Communities token directory page", () => {
    it("is a BeeZee app page with the shared top bar", () => {
        useCommunitiesContext.mockReturnValue(context(factoryAssets(1)));
        renderHome();

        expect(screen.getByRole("navigation", {name: "BeeZee top bar"})).toBeInTheDocument();
    });

    it("shows the heading and a skeleton while loading, without empty or list content", () => {
        useCommunitiesContext.mockReturnValue(context(new Map(), {isLoading: true}));
        renderHome();

        expect(screen.getByRole("heading", {level: 1, name: "Every token has a home"})).toBeInTheDocument();
        expect(screen.getByText("BeeZee Communities · Token directory")).toBeInTheDocument();
        expect(screen.queryByText("No tokens yet")).not.toBeInTheDocument();
        expect(screen.queryByTestId("directory-card")).not.toBeInTheDocument();
    });

    it("shows the empty state when there are no factory tokens", () => {
        // A non-factory denom is still filtered out, leaving an empty list.
        useCommunitiesContext.mockReturnValue(context(new Map([["ubze", makeAsset("BZE", "ubze")]])));
        renderHome();

        expect(screen.getByText("No tokens yet")).toBeInTheDocument();
    });

    it("renders a card per factory token, the count line, and no pager for a single page", () => {
        useCommunitiesContext.mockReturnValue(context(factoryAssets(3)));
        renderHome();

        expect(tickers()).toEqual(["TKN000", "TKN001", "TKN002"]);
        expect(screen.getByTestId("directory-count")).toHaveTextContent("Showing 1–3 of 3 tokens");
        expect(screen.queryByRole("navigation", {name: "Pagination"})).not.toBeInTheDocument();
    });

    it("links each card to the token page with the denom URL-encoded", () => {
        useCommunitiesContext.mockReturnValue(context(factoryAssets(1)));
        renderHome();

        expect(screen.getByRole("link", {name: /TKN000/})).toHaveAttribute("href", "/token?denom=factory%2Fbze1owner%2Futkn000");
    });

    it("searches as you type, writes q to the URL and resets the page", async () => {
        const user = userEvent.setup();
        useCommunitiesContext.mockReturnValue(context(factoryAssets(25)));
        renderHome("page=2");

        await user.type(screen.getByRole("searchbox", {name: "Search tokens"}), "tkn02");

        expect(tickers()).toEqual(["TKN020", "TKN021", "TKN022", "TKN023", "TKN024"]);
        expect(nav.get()).toBe("q=tkn02");
    }, 15_000); // five keystrokes, each re-rendering a 25-card grid: slow on CI runners

    it("shows the empty-search state and Clear search restores the list", async () => {
        const user = userEvent.setup();
        useCommunitiesContext.mockReturnValue(context(factoryAssets(3)));
        renderHome("q=zzz");

        expect(screen.getByText("No tokens match “zzz”")).toBeInTheDocument();
        expect(screen.getByTestId("directory-count")).toHaveTextContent("0 tokens");

        await user.click(screen.getByRole("button", {name: "Clear search"}));

        expect(nav.get()).toBe("");
        expect(screen.getByRole("searchbox", {name: "Search tokens"})).toHaveValue("");
        expect(tickers()).toHaveLength(3);
    });

    it("loads a filter and sort from the URL pre-applied", () => {
        const assets = factoryAssets(3);
        const [a, b, c] = [...assets.keys()];
        useCommunitiesContext.mockReturnValue(context(assets, {
            poolsMap: new Map([["p1", {base: a, quote: "ubze"}], ["p2", {base: c, quote: "ubze"}]]),
            usdPricesMap: new Map([[a, new BigNumber(1)], [c, new BigNumber(2)], [b, new BigNumber(9)]]),
        }));
        renderHome("filter=tradable&sort=cap");

        expect(tickers()).toEqual(["TKN002", "TKN000"]);
        expect(screen.getByRole("button", {name: "Tradable"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("combobox", {name: "Sort tokens"})).toHaveValue("cap");
    });

    it("writes filter and sort to the URL and back to page 1", async () => {
        const user = userEvent.setup();
        useCommunitiesContext.mockReturnValue(context(factoryAssets(25)));
        renderHome("page=2");

        await user.selectOptions(screen.getByRole("combobox", {name: "Sort tokens"}), "vol");
        expect(nav.get()).toBe("sort=vol");

        await user.click(screen.getByRole("button", {name: "Verified"}));
        expect(nav.get()).toBe("filter=verified&sort=vol");
        expect(screen.getByText("No tokens match this filter")).toBeInTheDocument();
    });

    it("pages 20 at a time with numbered pages and writes page to the URL", async () => {
        const user = userEvent.setup();
        useCommunitiesContext.mockReturnValue(context(factoryAssets(25)));
        renderHome();

        expect(screen.getAllByText("Page 1 of 2").length).toBeGreaterThan(0);
        expect(tickers()).toHaveLength(20);

        await user.click(screen.getByRole("button", {name: "Page 2"}));

        expect(nav.get()).toBe("page=2");
        expect(tickers()).toEqual(["TKN020", "TKN021", "TKN022", "TKN023", "TKN024"]);
        expect(screen.getByTestId("directory-count")).toHaveTextContent("Showing 21–25 of 25 tokens");

        await user.click(screen.getByRole("button", {name: "Previous"}));
        expect(nav.get()).toBe("");
    });

    it("clamps a page past the end and puts the clamped page in the URL", async () => {
        useCommunitiesContext.mockReturnValue(context(factoryAssets(25)));
        await act(async () => { renderHome("page=9&sort=vol"); });

        expect(tickers()[0]).toBe("TKN020");
        expect(nav.get()).toBe("sort=vol&page=2");
    });

    it("badges holders pools, reward programs and untraded tokens", () => {
        const assets = factoryAssets(2);
        const [a, b] = [...assets.keys()];
        useCommunitiesContext.mockReturnValue(context(assets, {poolsMap: new Map([["p", {base: b, quote: "ubze"}]])}));
        useDirectoryData.mockReturnValue({
            kits: new Map(),
            denomRewards: [{staking_denom: a}],
            stakingRewards: [{staking_denom: b, payouts: 0, duration: 5}],
            isLoading: false,
        });
        renderHome();

        const [first, second] = screen.getAllByTestId("directory-card");
        expect(first).toHaveTextContent("Holders pool");
        expect(first).toHaveTextContent("Not traded yet");
        expect(second).toHaveTextContent("Reward programs");
        expect(second).not.toHaveTextContent("Not traded yet");
    });

    describe("network fee denom left behind by a token page", () => {
        const T = denomOf("PAGE");
        const storePreferred = (denom: string) => setSettings({...DEFAULT_SETTINGS, preferredFeeDenom: denom});

        it("is reset to BZE when the browser was closed on the token page (marker left)", () => {
            storePreferred(T);
            setInLocalStorage("communities:feeDenomSetByTokenPage", T, TTL_NO_EXPIRY);
            useCommunitiesContext.mockReturnValue(context(factoryAssets(1)));

            renderHome();

            expect(getSettings().preferredFeeDenom).toBe(getChainNativeAssetDenom());
        });

        it("is kept when the viewer chose it in the directory's settings (no marker)", () => {
            storePreferred(T);
            useCommunitiesContext.mockReturnValue(context(factoryAssets(1)));

            renderHome();

            expect(getSettings().preferredFeeDenom).toBe(T);
        });
    });
});
