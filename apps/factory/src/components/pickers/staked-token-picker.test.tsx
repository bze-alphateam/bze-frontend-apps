import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset, DenomReward } from "@bze/bze-ui-kit";

// The picker runs on mocked data hooks: the asset list and prices, the wallet, your tokens with their
// admin, and the chain's list of compounded rewards.
const { data } = vi.hoisted(() => ({
    data: {
        address: "bze1me" as string | undefined,
        assets: [] as Asset[],
        prices: new Map<string, unknown>(),
        mine: [] as { asset: Asset; admin: string | undefined }[],
        drs: { list: [] as DenomReward[] | undefined, isLoading: false, hasError: false, retry: () => {} },
    },
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: data.address }) }));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => ({ tokens: data.address ? data.mine : [], isLoading: false }) }));
vi.mock("@/hooks/useAllDenomRewards", () => ({ useAllDenomRewards: () => data.drs }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ assets: data.assets, isLoading: false, nativeAsset: data.assets.find(a => a.denom === "ubze") }),
        useAssetsContext: () => ({ usdPricesMap: data.prices }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import { StakedTokenPicker, type StakedTokenPickerProps } from "./staked-token-picker";

function asset(ticker: string, denom: string, extra: Partial<Asset> = {}): Asset {
    return { denom, type: "Factory", ticker, name: `${ticker} Token`, decimals: 6, logo: "", stable: false, verified: false, supply: 1000n, ...extra };
}

const MINE = asset("HONEY", "factory/bze1me/uhoney");
const GIVEN_UP = asset("WAX", "factory/bze1me/uwax");
const HANDED = asset("JAR", "factory/bze1me/ujar");
const BZE = asset("BZE", "ubze", { name: "BeeZee", type: "Native" });
const PAGE = asset("PAGE", "factory/bze1other/upage");
const LP = asset("HONEY/BZE LP", "ulp_factory/bze1me/uhoney_ubze", { name: "HONEY/BZE pool shares", type: "LP" });
const HALTED = asset("STOP", "factory/bze1other/ustop", { halted: true });
const dr = (a: Asset, staked: string): DenomReward => ({ staking_denom: a.denom, lock: 7, min_stake: "0", staked_amount: staked });

const onChange = vi.fn();
const stateOf = (_a: Asset, d?: DenomReward) => d
    ? (d.staked_amount === "0" ? { text: "Nothing staked", tone: "warn" as const } : { text: "staked", tone: "good" as const })
    : { text: "Not stakable yet", tone: "muted" as const };

function renderPicker(props: Partial<StakedTokenPickerProps> = {}) {
    return render(<StakedTokenPicker mode="makeStakable" value="" onChange={onChange} stateOf={stateOf} {...props} />, {
        wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

const group = (name: string) => within(screen.getByRole("region", { name }));
const rowNames = (name: string) => group(name).getAllByRole("radio").map(r => r.getAttribute("aria-label"));

beforeEach(() => {
    data.address = "bze1me";
    data.assets = [MINE, GIVEN_UP, HANDED, BZE, PAGE, LP, HALTED];
    data.prices = new Map([["ubze", new BigNumber(1)], ["factory/bze1other/upage", new BigNumber(1)]]);
    data.mine = [{ asset: MINE, admin: "bze1me" }, { asset: GIVEN_UP, admin: "" }, { asset: HANDED, admin: "bze1someone" }];
    // BZE: $10 staked, PAGE: $100 staked, the LP: a reward with nothing staked and no price.
    data.drs = { list: [dr(BZE, "10000000"), dr(PAGE, "100000000"), dr(LP, "0")], isLoading: false, hasError: false, retry: vi.fn() };
    onChange.mockReset();
});

describe("StakedTokenPicker", () => {
    it("groups your tokens with their admin line, then every other token by staked value, then A–Z", () => {
        renderPicker();
        expect(rowNames("Created by you")).toEqual(["HONEY Token · HONEY", "JAR Token · JAR", "WAX Token · WAX"]);
        expect(group("Created by you").getByText("You are admin")).toBeInTheDocument();
        expect(group("Created by you").getByText("Admin given up · anyone can still make it stakable")).toBeInTheDocument();
        // Someone else is JAR's admin: no admin label, just its kind.
        expect(within(group("Created by you").getByRole("radio", { name: "JAR Token · JAR" })).getByText("Community token")).toBeInTheDocument();

        expect(rowNames("All tokens")).toEqual([
            "PAGE Token · PAGE",
            "BeeZee · BZE",
            "HONEY/BZE pool shares · HONEY/BZE LP",
            "STOP Token · STOP",
        ]);
        expect(within(group("All tokens").getByRole("radio", { name: "BeeZee · BZE" })).getByText("Native token")).toBeInTheDocument();
        expect(within(group("All tokens").getByRole("radio", { name: /pool shares/ })).getByText("LP shares")).toBeInTheDocument();
    });

    it("makeStakable marks the tokens that already have a compounded reward; the rest get the caller's state", () => {
        renderPicker();
        expect(within(group("All tokens").getByRole("radio", { name: "BeeZee · BZE" })).getByText("Stakable · add a prize")).toBeInTheDocument();
        expect(within(group("All tokens").getByRole("radio", { name: "STOP Token · STOP" })).getByText("Not stakable yet")).toBeInTheDocument();
    });

    it("hasRewards lists tokens with a compounded reward or a simple reward; only narrows to LP shares or tokens", () => {
        const { rerender } = renderPicker({ mode: "hasRewards", stakable: new Set([HALTED.denom]) });
        const names = () => screen.getAllByRole("radio").map(r => r.getAttribute("aria-label"));
        expect(names()).toContain("STOP Token · STOP");
        expect(names()).toContain("BeeZee · BZE");
        rerender(<StakedTokenPicker mode="hasRewards" stakable={new Set([HALTED.denom])} only="lp" value="" onChange={onChange} stateOf={stateOf} />);
        expect(screen.queryByRole("radio", { name: "STOP Token · STOP" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "LP shares" })).not.toBeInTheDocument();
    });

    it("hasCompounded lists only tokens with one, with the caller's state", () => {
        renderPicker({ mode: "hasCompounded" });
        expect(screen.queryByRole("region", { name: "Created by you" })).not.toBeInTheDocument();
        expect(rowNames("All tokens")).toEqual(["PAGE Token · PAGE", "BeeZee · BZE", "HONEY/BZE pool shares · HONEY/BZE LP"]);
        expect(within(group("All tokens").getByRole("radio", { name: /pool shares/ })).getByText("Nothing staked")).toBeInTheDocument();
    });

    it("searches by ticker, name or denom", async () => {
        renderPicker();
        await userEvent.type(screen.getByRole("textbox", { name: "Search tokens" }), "beezee");
        expect(screen.queryByRole("region", { name: "Created by you" })).not.toBeInTheDocument();
        expect(rowNames("All tokens")).toEqual(["BeeZee · BZE"]);

        await userEvent.clear(screen.getByRole("textbox", { name: "Search tokens" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Search tokens" }), "bze1other/up");
        expect(rowNames("All tokens")).toEqual(["PAGE Token · PAGE"]);

        await userEvent.clear(screen.getByRole("textbox", { name: "Search tokens" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Search tokens" }), "nothing like it");
        expect(screen.getByTestId("picker-empty")).toHaveTextContent("No token matches 'nothing like it'.");
    });

    it("the chips: Created by you, LP shares, All", async () => {
        renderPicker();
        await userEvent.click(screen.getByRole("button", { name: "Created by you" }));
        expect(screen.queryByRole("region", { name: "All tokens" })).not.toBeInTheDocument();
        expect(rowNames("Created by you")).toHaveLength(3);

        await userEvent.click(screen.getByRole("button", { name: "LP shares" }));
        expect(screen.queryByRole("region", { name: "Created by you" })).not.toBeInTheDocument();
        expect(rowNames("All tokens")).toEqual(["HONEY/BZE pool shares · HONEY/BZE LP"]);

        await userEvent.click(screen.getByRole("button", { name: "All" }));
        expect(rowNames("All tokens")).toHaveLength(4);
    });

    it("without a wallet: no Created by you group or chip", () => {
        data.address = undefined;
        renderPicker();
        expect(screen.queryByRole("region", { name: "Created by you" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Created by you" })).not.toBeInTheDocument();
        // HONEY is listed with every other token.
        expect(rowNames("All tokens")).toContain("HONEY Token · HONEY");
    });

    it("leaves out halted tokens and LP shares when asked", () => {
        renderPicker({ excludeHalted: true, includeLP: false });
        expect(rowNames("All tokens")).toEqual(["PAGE Token · PAGE", "BeeZee · BZE"]);
        expect(screen.queryByRole("button", { name: "LP shares" })).not.toBeInTheDocument();
    });

    it("pages All tokens 20 at a time", async () => {
        data.address = undefined;
        data.assets = Array.from({ length: 45 }, (_, i) => asset(`T${String(i).padStart(2, "0")}`, `factory/bze1x/ut${i}`));
        data.drs = { ...data.drs, list: [] };
        renderPicker();
        expect(rowNames("All tokens")).toHaveLength(20);
        await userEvent.click(screen.getByRole("button", { name: "Show 20 more · 45 tokens" }));
        expect(rowNames("All tokens")).toHaveLength(40);
        await userEvent.click(screen.getByRole("button", { name: "Show 20 more · 45 tokens" }));
        expect(rowNames("All tokens")).toHaveLength(45);
        expect(screen.queryByRole("button", { name: /Show 20 more/ })).not.toBeInTheDocument();
    });

    it("picks a token and marks it checked", async () => {
        const { rerender } = renderPicker();
        await userEvent.click(screen.getByRole("radio", { name: "STOP Token · STOP" }));
        expect(onChange).toHaveBeenCalledWith(HALTED);
        rerender(<StakedTokenPicker mode="makeStakable" value={HALTED.denom} onChange={onChange} stateOf={stateOf} />);
        expect(screen.getByRole("radio", { name: "STOP Token · STOP" })).toHaveAttribute("aria-checked", "true");
    });

    it("a row whose state is disabled can't be picked, and says why", async () => {
        const airdropState = (_a: Asset, d?: DenomReward) => d && d.staked_amount === "0"
            ? { text: "Nothing staked", tone: "warn" as const, disabled: true }
            : { text: "staked", tone: "good" as const };
        renderPicker({ mode: "hasCompounded", stateOf: airdropState });
        const lp = group("All tokens").getByRole("radio", { name: /pool shares/ });
        expect(lp).toBeDisabled();
        expect(within(lp).getByText("Nothing staked")).toBeInTheDocument();
        await userEvent.click(lp);
        expect(onChange).not.toHaveBeenCalled();
        await userEvent.click(group("All tokens").getByRole("radio", { name: "BeeZee · BZE" }));
        expect(onChange).toHaveBeenCalledWith(BZE);
    });

    it("a failed list says so and retries", async () => {
        data.drs = { list: undefined, isLoading: false, hasError: true, retry: vi.fn() };
        renderPicker();
        expect(screen.getByText(/Couldn't load which tokens are stakable/)).toBeInTheDocument();
        expect(screen.queryByText("Already stakable")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(data.drs.retry).toHaveBeenCalled();
    });
});
