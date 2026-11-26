import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// /dao/new (BFE-388): the Token step, then the shared CreateDaoFlow (mocked here) with the stake preset
// worked out from the token's rewards. Wallet, chain queries and the flow are mocked; the picker, the
// guided steps, the Done screen and the electorate maths are real.
const { HONEY, MOON, DUST, mk } = vi.hoisted(() => ({
    HONEY: "factory/bze1owner/uhoney",
    MOON: "factory/bze1owner/umoon",
    DUST: "factory/bze1owner/udust",
    mk: (denom: string, ticker: string) => ({ denom, ticker, name: ticker, decimals: 6, logo: "", type: "Factory", supply: 1000n, stable: false, verified: false }),
}));
const sr = (id: number, denom: string, lock: number, staked: string) => ({ reward_id: String(id), staking_denom: denom, lock, staked_amount: staked });

const h = vi.hoisted(() => ({
    query: { current: new URLSearchParams() },
    daoParams: { current: { status: "ready", params: { max_sr_per_dao: "5", min_electorate_lock_days: 5 } } as Record<string, unknown> },
    rewards: { current: [] as ReturnType<typeof sr>[] },
    rewardsError: { current: false },
    refreshRewards: vi.fn(),
    retryParams: vi.fn(),
    rerender: { current: undefined as undefined | (() => void) },
    drs: { current: {} as Record<string, { staking_denom: string; lock: number; staked_amount: string; min_stake: string }> },
    wallet: { address: "bze1me" as string | undefined },
    admins: { current: {} as Record<string, string> },
    flowProps: [] as Array<Record<string, unknown>>,
    push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        // a real router changes the URL: keep the query in step and re-render
        push: (url: string) => { h.push(url); h.query.current = new URLSearchParams(url.split("?")[1] ?? ""); h.rerender.current?.(); },
        replace: vi.fn(),
    }),
    usePathname: () => "/dao/new",
    useSearchParams: () => h.query.current,
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: h.wallet.address }) }));
vi.mock("@/hooks/useDaoParams", () => ({ useDaoParams: () => ({ ...h.daoParams.current, retry: h.retryParams }) }));
vi.mock("@/hooks/useStakingRewards", () => ({
    useStakingRewards: () => ({ rewards: h.rewardsError.current ? [] : h.rewards.current, isLoading: false, hasError: h.rewardsError.current, refresh: h.refreshRewards }),
}));
vi.mock("@/hooks/useDenomReward", () => ({
    useDenomReward: (denom: string) => ({ denomReward: h.drs.current[denom], schedules: [], prizes: [], isLoading: false, hasError: false, refresh: vi.fn() }),
}));
vi.mock("@/hooks/useDenomAdmin", () => ({
    useDenomAdmin: (denom: string) => ({ admin: h.admins.current[denom], mintable: true, isLoading: false, refresh: vi.fn() }),
}));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => ({ tokens: [] }) }));
vi.mock("@/hooks/useAllDenomRewards", () => ({
    useAllDenomRewards: () => ({ list: Object.values(h.drs.current), isLoading: false, hasError: false, retry: vi.fn() }),
}));
vi.mock("@/components/token-page/transfer-admin-dialog", () => ({
    TransferAdminDialog: ({ initialAddress }: { initialAddress?: string }) => <div data-testid="transfer-dialog">{initialAddress}</div>,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets = [mk(HONEY, "HONEY"), mk(MOON, "MOON"), mk(DUST, "DUST"), { ...mk("ubze", "BZE"), type: "Native" }];
    return {
        ...actual,
        useAssets: () => ({ assets, isLoading: false, nativeAsset: assets[3], getAsset: (d: string) => assets.find(a => a.denom === d) }),
        useAssetsContext: () => ({ usdPricesMap: new Map() }),
        getDaoApp: () => ({ href: "https://dao.example" }),
        CreateDaoFlow: (props: { onCreated: (c: { id: string; address: string; txHash: string }) => void }) => {
            h.flowProps.push(props as unknown as Record<string, unknown>);
            return <div data-testid="create-dao-flow"><button onClick={() => props.onCreated({ id: "9", address: "bze1newdao", txHash: "ABCD" })}>finish the flow</button></div>;
        },
    };
});

import DaoNewPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => {
    const view = render(<DaoNewPage />, { wrapper });
    h.rerender.current = () => view.rerender(<DaoNewPage />);
    return view;
};
const lastFlow = () => h.flowProps[h.flowProps.length - 1];

beforeEach(() => {
    h.query.current = new URLSearchParams();
    h.daoParams.current = { status: "ready", params: { max_sr_per_dao: "5", min_electorate_lock_days: 5 } };
    h.wallet.address = "bze1me";
    h.admins.current = {};
    h.flowProps.length = 0;
    h.push.mockReset();
    h.rewardsError.current = false;
    h.refreshRewards.mockReset();
    h.retryParams.mockReset();
    h.rewards.current = [sr(1, HONEY, 7, "5000000"), sr(2, MOON, 5, "0"), sr(3, DUST, 2, "100")];
    h.drs.current = { [HONEY]: { staking_denom: HONEY, lock: 7, staked_amount: "1000000", min_stake: "0" } };
});

describe("/dao/new without ?denom=", () => {
    it("asks for the token first, with the three row states, and mounts no flow", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Create a DAO");
        const rows = screen.getAllByTestId("picker-row");
        const byName = (t: string) => rows.find(r => r.getAttribute("aria-label")?.endsWith(t))!;
        expect(within(byName("HONEY")).getByTestId("picker-state")).toHaveTextContent("6 HONEY staked");
        expect(byName("HONEY")).toBeEnabled();
        expect(within(byName("MOON")).getByTestId("picker-state")).toHaveTextContent("Nobody stakes it yet");
        expect(byName("MOON")).toBeEnabled();
        expect(within(byName("DUST")).getByTestId("picker-state")).toHaveTextContent("No reward with a 5+ day lock");
        expect(byName("DUST")).toBeDisabled();
        expect(rows.find(r => r.getAttribute("aria-label")?.endsWith("BZE"))).toBeUndefined();
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
    });

    it("mounts the flow with the picked token's preset, and remounts it for another token", async () => {
        renderPage();
        await userEvent.click(screen.getByRole("radio", { name: /HONEY/ }));
        expect(screen.getByTestId("create-dao-flow")).toBeInTheDocument();
        expect(lastFlow().preset).toEqual({ type: "DAO_TYPE_STAKE", electorate: { sr_ids: ["1"], dr_denom: HONEY } });
        expect(lastFlow().locked).toEqual({ type: true, stakingDenom: HONEY });

        await userEvent.click(screen.getByRole("button", { name: /Edit/ }));
        await userEvent.click(screen.getByRole("radio", { name: /MOON/ }));
        await waitFor(() => expect(lastFlow().locked).toEqual({ type: true, stakingDenom: MOON }));
        expect(lastFlow().preset).toEqual({ type: "DAO_TYPE_STAKE", electorate: { sr_ids: ["2"], dr_denom: "" } });
        expect(screen.getAllByTestId("create-dao-flow")).toHaveLength(1);
    });
});

describe("/dao/new?denom=", () => {
    beforeEach(() => { h.query.current = new URLSearchParams({ denom: HONEY }); });

    it("shows the Token step as done and hands the flow exactly the computed preset", () => {
        renderPage();
        expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
        expect(screen.getByText("HONEY stakers")).toBeInTheDocument();
        expect(screen.getByTestId("create-dao-flow")).toBeInTheDocument();
        expect(lastFlow().preset).toEqual({ type: "DAO_TYPE_STAKE", electorate: { sr_ids: ["1"], dr_denom: HONEY } });
        expect(lastFlow().locked).toEqual({ type: true, stakingDenom: HONEY });
    });

    it("after creation: Open the DAO, and the hand-over only for the token's admin", async () => {
        h.admins.current = { [HONEY]: "bze1me" };
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "finish the flow" }));
        expect(screen.getByRole("link", { name: "Open the DAO" })).toHaveAttribute("href", "https://dao.example/dao/9");
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Hand HONEY to this DAO" }));
        expect(screen.getByTestId("transfer-dialog")).toHaveTextContent("bze1newdao");
    });

    it("offers no hand-over to someone who is not the admin", async () => {
        h.admins.current = { [HONEY]: "bze1someoneelse" };
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "finish the flow" }));
        expect(screen.getByRole("link", { name: "Open the DAO" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Hand HONEY/ })).not.toBeInTheDocument();
    });

    it("an unknown denom is not found, and so is a token that is not a factory token", () => {
        h.query.current = new URLSearchParams({ denom: "factory/bze1x/unope" });
        const a = renderPage();
        expect(screen.getByText("We couldn't find this token.")).toBeInTheDocument();
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
        a.unmount();
        h.query.current = new URLSearchParams({ denom: "ubze" });
        renderPage();
        expect(screen.getByText("We couldn't find this token.")).toBeInTheDocument();
    });

    it("a token with no eligible reward gets the two wizards instead of the flow", () => {
        h.query.current = new URLSearchParams({ denom: DUST });
        renderPage();
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
        const note = screen.getByTestId("dao-new-no-source");
        expect(within(note).getByRole("link", { name: "Make DUST stakable" })).toBeInTheDocument();
        expect(within(note).getByRole("link", { name: /Create a simple reward with at least 5 days/ })).toBeInTheDocument();
    });
});

describe("/dao/new follows the link", () => {
    it("Pick a token on an unknown denom shows the picker, with no stale token", async () => {
        h.query.current = new URLSearchParams({ denom: "factory/bze1x/unope" });
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "Pick a token" }));
        expect(screen.getByTestId("staked-token-picker")).toBeInTheDocument();
        expect(screen.queryByText("We couldn't find this token.")).not.toBeInTheDocument();
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
    });

    it("another ?denom= switches the token, and no ?denom= goes back to the picker", () => {
        h.query.current = new URLSearchParams({ denom: HONEY });
        const view = renderPage();
        expect(lastFlow().locked).toEqual({ type: true, stakingDenom: HONEY });
        h.query.current = new URLSearchParams({ denom: MOON });
        view.rerender(<DaoNewPage />);
        expect(lastFlow().locked).toEqual({ type: true, stakingDenom: MOON });
        h.query.current = new URLSearchParams();
        view.rerender(<DaoNewPage />);
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
        expect(screen.getByTestId("staked-token-picker")).toBeInTheDocument();
    });
});

describe("/dao/new when a query fails", () => {
    it("a failed rewards load blocks the flow and Retry asks again", async () => {
        h.query.current = new URLSearchParams({ denom: HONEY });
        h.rewardsError.current = true;
        renderPage();
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(h.refreshRewards).toHaveBeenCalled();
    });

    it("a failed DAO params check shows an error with Retry", async () => {
        h.daoParams.current = { status: "error" };
        renderPage();
        expect(screen.getByText("Couldn't check whether this network supports DAOs")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(h.retryParams).toHaveBeenCalled();
    });
});

describe("/dao/new on a v8.2.x node", () => {
    it("shows the not available state, never the form", () => {
        h.daoParams.current = { status: "unsupported" };
        renderPage();
        expect(screen.getByText("DAOs are not available on this network yet")).toBeInTheDocument();
        expect(screen.queryByTestId("staked-token-picker")).not.toBeInTheDocument();
        expect(screen.queryByTestId("create-dao-flow")).not.toBeInTheDocument();
    });
});
