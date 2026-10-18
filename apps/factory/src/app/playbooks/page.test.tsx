import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { loadPlaybookProgress, savePlaybookProgress } from "@/lib/playbooks";

// /playbooks on mocked hooks: the query string, the user's tokens, the token's setup checklist and
// the staking programs. Progress uses jsdom localStorage.
const m = vi.hoisted(() => ({
    params: new URLSearchParams(),
    navigate: vi.fn(),
    replace: vi.fn(),
    tokens: [] as unknown[],
    setup: { items: [] as { key: string; state: string }[], pools: [] as unknown[], isLoading: false },
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => m.params }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: m.navigate, replace: m.replace }) }));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => ({ tokens: m.tokens, isLoading: false }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => m.setup }));
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => ({ rewards: [], isLoading: false, hasError: false, refresh: vi.fn() }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useAssets: () => ({ denomTicker: (d: string) => d.split("/").pop()!.slice(1).toUpperCase() }),
}));

import PlaybooksPage from "./page";

const HONEY = "factory/bze1me/uhoney";
const JAM = "factory/bze1me/ujam";
const ENC = encodeURIComponent(HONEY);
const token = (denom: string, admin = "bze1me") => ({ admin, asset: { denom, ticker: denom.split("/u")[1].toUpperCase(), name: "", logo: "", decimals: 6 } });

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const open = (query: string) => {
    m.params = new URLSearchParams(query);
    return render(<PlaybooksPage />, { wrapper });
};
const step = (goalId: string) => screen.getByTestId(`playbook-step-${goalId}`);

beforeEach(() => {
    localStorage.clear();
    m.navigate.mockReset();
    m.replace.mockReset();
    m.tokens = [token(HONEY), token(JAM)];
    m.setup = { items: [{ key: "pool", state: "todo" }, { key: "holderRewards", state: "todo" }, { key: "registry", state: "todo" }], pools: [], isLoading: false };
});

describe("/playbooks", { timeout: 20_000 }, () => {
    it("launch without a token: step 1 is current and opens /token/new with the way back", async () => {
        open("id=launch");
        expect(screen.getByRole("heading", { name: "Launch a community token" })).toBeInTheDocument();
        expect(screen.getByText("Leave any time, your progress stays.")).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Which token is this for?" })).not.toBeInTheDocument();
        expect(step("createToken")).toHaveAttribute("data-state", "current");
        expect(step("pool")).toHaveAttribute("data-state", "later");
        expect(within(step("pool")).getByRole("button", { name: "Create a pool" })).toBeDisabled();

        await userEvent.click(within(step("createToken")).getByRole("button", { name: "Create my token" }));
        expect(m.navigate).toHaveBeenCalledWith(`/token/new?${new URLSearchParams({ return: "/playbooks?id=launch", returnLabel: "the playbook" })}`);
    });

    it("the token chooser picks one of your tokens and starts over for another", async () => {
        savePlaybookProgress("noticed", { manualDone: ["reach"] });
        open("id=noticed");
        const chooser = screen.getByRole("region", { name: "Which token is this for?" });
        await userEvent.click(within(chooser).getByRole("button", { name: /HONEY/ }));
        expect(m.replace).toHaveBeenLastCalledWith(`/playbooks?id=noticed&denom=${ENC}`);
        expect(within(chooser).getByRole("button", { name: /HONEY/ })).toHaveAttribute("aria-pressed", "true");
        expect(step("reach")).toHaveAttribute("data-state", "done");
        expect(loadPlaybookProgress("noticed")).toEqual({ denom: HONEY, manualDone: ["reach"] });

        await userEvent.click(within(chooser).getByRole("button", { name: /JAM/ }));
        expect(step("reach")).toHaveAttribute("data-state", "current");
        expect(loadPlaybookProgress("noticed")).toEqual({ denom: JAM, manualDone: [] });
    });

    it("steps are detected from the chain, step buttons encode the playbook path", async () => {
        m.setup.items = [{ key: "pool", state: "done" }, { key: "holderRewards", state: "todo" }, { key: "registry", state: "todo" }];
        open(`id=launch&denom=${ENC}`);
        expect(step("createToken")).toHaveAttribute("data-state", "done");
        expect(step("pool")).toHaveTextContent("It has a pool, so people can buy and sell it.");
        expect(step("stakable")).toHaveAttribute("data-state", "current");
        expect(within(step("stakable")).queryByRole("button", { name: "Mark as done" })).not.toBeInTheDocument();

        await userEvent.click(within(step("stakable")).getByRole("button", { name: "Set up holder rewards" }));
        const back = new URLSearchParams({ return: `/playbooks?id=launch&denom=${ENC}&step=stakable`, returnLabel: "the playbook" });
        expect(m.navigate).toHaveBeenCalledWith(`/denom-reward/token?denom=${ENC}&${back}`);
    });

    it("returning with step=…&completed=1 marks the step, stores it and strips the markers", () => {
        open(`id=noticed&denom=${ENC}&step=reach&completed=1`);
        expect(step("reach")).toHaveAttribute("data-state", "done");
        expect(loadPlaybookProgress("noticed")).toEqual({ denom: HONEY, manualDone: ["reach"] });
        expect(m.replace).toHaveBeenCalledWith(`/playbooks?id=noticed&denom=${ENC}`);
    });

    it("the back link (no completed) marks nothing, and the markers go too", () => {
        open(`id=noticed&denom=${ENC}&step=reach`);
        expect(step("reach")).toHaveAttribute("data-state", "current");
        expect(m.replace).toHaveBeenCalledWith(`/playbooks?id=noticed&denom=${ENC}`);
    });

    it("an undetectable step is marked by hand; all done shows the outcome", async () => {
        m.setup.items = [{ key: "holderRewards", state: "done" }];
        open(`id=noticed&denom=${ENC}`);
        await userEvent.click(within(step("reach")).getByRole("button", { name: "Mark as done" }));
        expect(loadPlaybookProgress("noticed")?.manualDone).toEqual(["reach"]);
        expect(screen.getByTestId("playbook-done")).toHaveTextContent("Done. HONEY now is in the wallets of another community, and they can stake it.");
        await userEvent.click(screen.getByRole("button", { name: "Back to the Factory" }));
        expect(m.navigate).toHaveBeenCalledWith("/");
    });

    it("a renounced admin finishes the launch's lock step", () => {
        m.tokens = [token(HONEY, "")];
        m.setup.items = ["pool", "holderRewards", "registry"].map(key => ({ key, state: "done" }));
        open(`id=launch&denom=${ENC}`);
        expect(step("lock")).toHaveAttribute("data-state", "done");
        expect(screen.getByTestId("playbook-done")).toHaveTextContent("Done. HONEY now trades");
    });

    it("an unknown id lists the playbooks", () => {
        open("id=nope");
        expect(screen.getByTestId("playbook-launch")).toBeInTheDocument();
        expect(screen.getByTestId("playbook-lps")).toBeInTheDocument();
    });
});
