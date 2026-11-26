import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { DaoParams } from "@bze/bze-ui-kit";
import { CreateDaoItem } from "./create-dao-item";

// "Create a DAO for <TICKER>" on the token page (BFE-388): three states, hidden on a v8.2.x node.
const DENOM = "factory/bze1owner/uhoney";
const asset = { denom: DENOM, ticker: "HONEY", name: "Honey", decimals: 6, logo: "" } as never;
const back = { href: `/tokens/token?denom=${DENOM}`, label: "HONEY" };
const PARAMS = { max_sr_per_dao: "5", min_electorate_lock_days: 5 } as unknown as DaoParams;
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

const ready = { status: "ready" as const, params: PARAMS, retry: vi.fn() };
const loaded = (rewards: object[] = [], value?: object) => ({
    staking: { rewards: rewards as never[], isLoading: false, hasError: false },
    denomReward: { value: value as never, isLoading: false, hasError: false },
});
const sr = (id: number, lock: number, staked: string) => ({ reward_id: String(id), staking_denom: DENOM, lock, staked_amount: staked });

const show = (over: Partial<Parameters<typeof CreateDaoItem>[0]> = {}) =>
    render(<CreateDaoItem asset={asset} back={back} params={ready} {...loaded()} {...over} />, { wrapper });

describe("Create a DAO row of the token page", () => {
    it("eligible and live: who votes, the total staked and a button to /dao/new", () => {
        show(loaded([sr(12, 7, "2500000")], { staking_denom: DENOM, lock: 7, staked_amount: "1500000", min_stake: "0" }));
        const row = screen.getByTestId("create-dao-item");
        expect(row).toHaveTextContent("Create a DAO for HONEY");
        expect(row).toHaveTextContent("Voted by the stakers of: Compounded reward, Simple reward #12 · total staked 4 HONEY");
        const href = within(row).getByRole("link", { name: "Create" }).getAttribute("href")!;
        expect(href.startsWith(`/dao/new?denom=${encodeURIComponent(DENOM)}`)).toBe(true);
        expect(href).toContain("returnLabel=HONEY");
    });

    it("eligible but nobody stakes: same button, with the admin line", () => {
        show(loaded([sr(1, 5, "0")]));
        const row = screen.getByTestId("create-dao-item");
        expect(row).toHaveTextContent("Nobody stakes HONEY yet. The DAO needs an admin until someone does.");
        expect(within(row).getByRole("link", { name: "Create" })).toBeInTheDocument();
    });

    it("none eligible: the reason and the two wizards, no button", () => {
        show(loaded([sr(3, 2, "10")]));
        const row = screen.getByTestId("create-dao-item");
        expect(row).toHaveTextContent("Simple reward #3: lock 2 days, needs 5");
        expect(within(row).queryByRole("link", { name: "Create" })).not.toBeInTheDocument();
        expect(within(row).getByRole("link", { name: "Make HONEY stakable" }).getAttribute("href")).toContain("/denom-reward/new");
        expect(within(row).getByRole("link", { name: "Create a simple reward with at least 5 days of lock" }).getAttribute("href")).toContain("/reward/new?staking=");
    });

    it("says the token is run by a DAO, and still offers another", () => {
        show({ ...loaded([sr(1, 5, "9")]), daoAdmin: { id: "7", name: "Honey Guild" } });
        expect(screen.getByTestId("create-dao-existing")).toHaveTextContent("This token is run by DAO Honey Guild");
        expect(screen.getByRole("link", { name: "Create" })).toBeInTheDocument();
    });

    it("is hidden on a node without x/dao (v8.2.0 answers 501)", () => {
        const { container } = show({ params: { status: "unsupported", retry: vi.fn() } });
        expect(container).toBeEmptyDOMElement();
    });

    it("shows nothing while the rewards load or failed (the group has its own retry)", () => {
        const a = show({ staking: { rewards: [], isLoading: true, hasError: false } });
        expect(a.container).toBeEmptyDOMElement();
        a.unmount();
        const b = show({ staking: { rewards: [], isLoading: false, hasError: true } });
        expect(b.container).toBeEmptyDOMElement();
    });

    it("is hidden while the DAO params load or when their query failed", () => {
        const a = show({ params: { status: "loading", retry: vi.fn() } });
        expect(a.container).toBeEmptyDOMElement();
        a.unmount();
        const b = show({ params: { status: "error", retry: vi.fn() } });
        expect(b.container).toBeEmptyDOMElement();
    });
});
