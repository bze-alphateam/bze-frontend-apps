import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The launch screen on mocked hooks: the asset list, the fees, the setup checklist and navigation.
const m = vi.hoisted(() => ({
    assets: {} as Record<string, { denom: string; ticker: string; name: string; decimals: number }>,
    setup: { items: [] as { key: string; state: string; detail: string; href: string; action?: { label: string; href: string } }[], isLoading: false },
    fees: {} as Record<string, { denom: string; amount: string } | undefined>,
    navigate: vi.fn(),
    toast: vi.fn(),
}));

vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: m.navigate }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => m.setup }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: m.assets[denom], isLoading: false }),
        useCreationFees: () => ({ fees: m.fees, isLoading: false }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: m.toast } }),
    };
});

import { LaunchNextSteps } from "./launch-next-steps";

const DENOM = "factory/bze1me/uhoney";
const ENC = encodeURIComponent(DENOM);
const WORKSPACE = `/tokens/token?denom=${ENC}&tab=overview`;
const RETURN = new URLSearchParams({ return: WORKSPACE, returnLabel: "HONEY" }).toString();

const BZE = { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6 };
const HONEY = { denom: DENOM, ticker: "HONEY", name: "Honey Coin", decimals: 6 };

const item = (key: string, state: string, extra: object = {}) => ({ key, state, detail: "", href: `/${key}`, ...extra });

const reset = vi.fn();
const renderScreen = (returnTo?: { href: string; label: string }) => render(
    <ChakraProvider value={defaultSystem}>
        <LaunchNextSteps denom={DENOM} txHash="HASH1" name="Honey Coin " symbol="HONEY" supply="1000000" reset={reset} returnTo={returnTo} />
    </ChakraProvider>,
);

const steps = () => within(screen.getByRole("list", { name: "Next steps" })).getAllByRole("listitem");
const step = (key: string) => screen.getByTestId(`launch-step-${key}`);

beforeEach(() => {
    m.assets = { ubze: BZE, [DENOM]: HONEY };
    m.setup = {
        items: [item("created", "done"), item("brandKit", "todo"), item("pool", "todo"), item("holderRewards", "todo"), item("market", "todo")],
        isLoading: false,
    };
    m.fees = {
        createMarketFee: { denom: "ubze", amount: "1000000000" },
        createDenomRewardFee: { denom: "ubze", amount: "5000000000" },
    };
    m.navigate.mockReset();
    reset.mockReset();
});

describe("LaunchNextSteps", () => {
    it("shows the minted line, the title and the steps in order, lock last", () => {
        renderScreen();
        expect(screen.getByTestId("launch-minted")).toHaveTextContent("Step 1 done · 1,000,000 HONEY minted to you");
        expect(screen.getByRole("heading", { name: "Honey Coin is live" })).toBeInTheDocument();
        expect(screen.getByText(/Right now only you hold HONEY and nobody can buy it\./)).toBeInTheDocument();
        expect(steps().map(li => li.querySelector("[data-testid]")?.getAttribute("data-testid"))).toEqual([
            "launch-step-look", "launch-step-pool", "launch-step-rewards", "launch-step-lock",
        ]);
        expect(within(step("lock")).getByText("Last: renounce admin (optional)")).toBeInTheDocument();
        expect(step("look")).toHaveTextContent("About 2 min");
    });

    it("ticks off the steps the chain says are done and keeps the rest open", () => {
        m.setup.items = [item("brandKit", "done"), item("pool", "done"), item("holderRewards", "partial")];
        renderScreen();
        expect(step("look")).toHaveAttribute("data-state", "done");
        expect(step("pool")).toHaveAttribute("data-state", "done");
        expect(step("rewards")).toHaveAttribute("data-state", "todo");
        expect(step("lock")).toHaveAttribute("data-state", "todo");
        expect(within(step("pool")).queryByRole("button")).not.toBeInTheDocument();
        expect(within(step("rewards")).getByRole("button", { name: "Set up rewards" })).toBeInTheDocument();
    });

    it("shows the registry step and the guide link only when the setup has that item", () => {
        const { unmount } = renderScreen();
        expect(screen.queryByTestId("launch-step-registry")).not.toBeInTheDocument();
        expect(within(screen.getByTestId("launch-logo-note")).queryByRole("link")).not.toBeInTheDocument();
        unmount();

        m.setup.items.push(item("registry", "todo", {
            detail: "Add HONEY to the Cosmos Chain Registry.",
            href: `/official?denom=${ENC}`,
            action: { label: "Open the guide", href: `/official?denom=${ENC}` },
        }));
        renderScreen();
        expect(steps()).toHaveLength(5);
        expect(steps()[3]).toContainElement(step("registry"));
        expect(step("registry")).toHaveTextContent("Get its logo in every wallet");
        expect(within(screen.getByTestId("launch-logo-note")).getByRole("link", { name: "How to add one" }))
            .toHaveAttribute("href", `/official?denom=${ENC}`);
    });

    it("links every action to the workspace tab or the form, with the way back", async () => {
        m.setup.items.push(item("registry", "todo", { action: { label: "Open the guide", href: `/official?denom=${ENC}` } }));
        renderScreen();
        const go = async (key: string, name: string) => {
            await userEvent.click(within(step(key)).getByRole("button", { name }));
            return m.navigate.mock.lastCall?.[0];
        };
        expect(await go("look", "Set brand kit")).toBe(`/tokens/token?denom=${ENC}&tab=profile`);
        expect(await go("pool", "Create pool")).toBe(`/pool/new?base=${ENC}&${RETURN}`);
        expect(await go("rewards", "Set up rewards")).toBe(`/tokens/token?denom=${ENC}&tab=rewards`);
        expect(await go("registry", "Open the guide")).toBe(`/official?denom=${ENC}`);
        expect(await go("lock", "Review and renounce")).toBe(`/tokens/token?denom=${ENC}&tab=control&lock=1`);

        await userEvent.click(screen.getByRole("button", { name: "Go to HONEY's page" }));
        expect(m.navigate).toHaveBeenLastCalledWith(WORKSPACE);
        await userEvent.click(screen.getByRole("button", { name: "Allow limit orders too" }));
        expect(m.navigate).toHaveBeenLastCalledWith(`/market/new?base=${ENC}&${RETURN}`);
        await userEvent.click(screen.getByRole("button", { name: "Back to the Factory" }));
        expect(m.navigate).toHaveBeenLastCalledWith("/");
        expect(screen.getByRole("link", { name: "DEX" })).toHaveAttribute("href", `https://dex.test/assets/details?denom=${ENC}`);
        expect(screen.getByRole("link", { name: "DEX" })).toHaveAttribute("data-app", "dex");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");
    });

    it("shows the pool and compounded reward fees from the creation fees", () => {
        renderScreen();
        expect(step("pool")).toHaveTextContent("Pool creation fee: 1,000 BZE");
        expect(step("rewards")).toHaveTextContent("Compounded reward fee: 5,000 BZE");
    });

    it("leaves the fee hints out while the fees are unknown", () => {
        m.fees = {};
        renderScreen();
        expect(step("pool")).not.toHaveTextContent("fee:");
        expect(step("rewards")).not.toHaveTextContent("fee:");
    });

    it("shows the form values and loading states before the asset list has the token", () => {
        delete m.assets[DENOM];
        renderScreen();
        expect(screen.getByRole("heading", { name: "Honey Coin is live" })).toBeInTheDocument();
        const card = screen.getByRole("region", { name: "Your token" });
        expect(card).toHaveTextContent("HONEY · Mintable");
        expect(card).toHaveTextContent(DENOM);
        for (const key of ["look", "pool", "rewards", "lock"]) {
            expect(step(key)).toHaveAttribute("data-state", "loading");
        }
        expect(within(step("pool")).getByRole("button", { name: "Create pool" })).toBeInTheDocument();
    });

    it("prefers the chain's name and ticker once the asset is listed", () => {
        m.assets[DENOM] = { ...HONEY, name: "Honey", ticker: "HNY" };
        renderScreen();
        expect(screen.getByRole("heading", { name: "Honey is live" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Go to HNY's page" })).toBeInTheDocument();
    });

    it("copies the token ID and resets for another token", async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        renderScreen();
        await userEvent.click(screen.getByRole("button", { name: "Copy token ID" }));
        expect(writeText).toHaveBeenCalledWith(DENOM);
        await userEvent.click(screen.getByRole("button", { name: "Create another token" }));
        expect(reset).toHaveBeenCalledOnce();
    });

    it("opened from a playbook: Back to the playbook, with the new token and its first step done", async () => {
        renderScreen({ href: "/playbooks?id=launch", label: "the playbook" });
        expect(screen.queryByRole("button", { name: "Go to HONEY's page" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Back to the playbook" }));
        expect(m.navigate).toHaveBeenCalledWith(`/playbooks?id=launch&denom=${ENC}&step=createToken&completed=1`);
    });
});
