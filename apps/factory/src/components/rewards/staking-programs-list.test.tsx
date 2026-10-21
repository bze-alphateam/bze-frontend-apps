import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

// Drive the list off its data hook; the tx layer and wallet are stubbed so the test asserts the
// row states (running / finished + staked / finished + empty), the scoping and the messages only.
const m = vi.hoisted(() => ({
    state: { rewards: [] as unknown[], isLoading: false, hasError: false },
    refresh: vi.fn(),
    tx: vi.fn(),
    navigate: vi.fn(),
    address: "bze1someone" as string | undefined,
    balance: "0",
    pools: [] as { lp_denom: string; base: string; quote: string }[],
}));

vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => ({ ...m.state, refresh: m.refresh }) }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: m.navigate }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BigNumber } = await import("bignumber.js");
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        "factory/bze1owner/utok": { denom: "factory/bze1owner/utok", ticker: "TOK", decimals: 6, logo: "" },
        ulp_tok_bze: { denom: "ulp_tok_bze", ticker: "TOK/BZE LP", decimals: 12, logo: "" },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssets: () => ({ assets: Object.values(assets) }),
        useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber(m.balance) } }),
        useLiquidityPools: () => ({ pools: m.pools }),
    };
});

import { StakingProgramsList, StakingProgramsListProps } from "./staking-programs-list";

const TOK = "factory/bze1owner/utok";

const reward = (id: string, payouts: number, duration: number, staked_amount = "0", over: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "1000000",
    prize_denom: "ubze",
    staking_denom: TOK,
    duration,
    payouts,
    min_stake: 0n,
    lock: 0,
    staked_amount,
    distributed_stake: "0",
    ...over,
});

function renderList(rewards: StakingRewardSDKType[], props: StakingProgramsListProps = {}) {
    m.state = { rewards, isLoading: false, hasError: false };
    return render(<StakingProgramsList {...props} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const ids = (root: HTMLElement = document.body) =>
    within(root).queryAllByTestId("staking-program-row").map(row => within(row).getByText(/^#/).textContent);

beforeEach(() => {
    m.refresh.mockReset();
    m.tx.mockReset().mockResolvedValue(true);
    m.navigate.mockReset();
    m.address = "bze1someone";
    m.balance = "0";
    m.pools = [];
});

describe("StakingProgramsList", () => {
    it("keeps running programs as they are, with no Delete", () => {
        renderList([reward("1", 3, 30, "5000000")]);

        expect(screen.getByRole("button", { name: /Extend/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
        expect(screen.queryByTestId("finished-staking-rewards")).not.toBeInTheDocument();
    });

    it("shows a row's facts in plain words", () => {
        renderList([reward("1", 3, 30, "5000000", { lock: 7, min_stake: 2000000n })]);

        const row = screen.getByTestId("staking-program-row");
        expect(row).toHaveTextContent("Stake TOK, earn BZE");
        const facts = within(row).getByTestId("staking-program-facts");
        ["1 BZE a day", "27 of 30 days left", "lock 7 days", "minimum 2 TOK", "5 TOK staked"]
            .forEach(fact => expect(within(facts).getByText(fact)).toBeInTheDocument());
    });

    it("says no lock and leaves the minimum out when it is zero", () => {
        renderList([reward("1", 0, 1)]);

        const facts = screen.getByTestId("staking-program-facts");
        expect(within(facts).getByText("no lock")).toBeInTheDocument();
        expect(within(facts).getByText("1 of 1 day left")).toBeInTheDocument();
        expect(facts).not.toHaveTextContent("minimum");
    });

    it("collapses finished programs into a group with their count", async () => {
        renderList([reward("1", 3, 30), reward("2", 30, 30), reward("3", 10, 10, "7")]);

        const toggle = screen.getByRole("button", { name: "Finished (2)" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(ids()).toEqual(["#1"]);

        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(ids()).toEqual(["#1", "#2", "#3"]);
    });

    it("says so when no program is running", () => {
        renderList([reward("2", 30, 30)]);
        expect(screen.getByText("No running programs — every program below has paid all its days.")).toBeInTheDocument();
    });

    it("disables Delete on a finished program that still holds stake and says why", async () => {
        renderList([reward("2", 30, 30, "1500000")]);
        await userEvent.click(screen.getByRole("button", { name: "Finished (1)" }));

        expect(screen.getByRole("button", { name: /Delete/ })).toBeDisabled();
        expect(screen.getByTestId("staking-reward-delete-blocker")).toHaveTextContent(
            "1.5 TOK still staked — stakers must exit first before it can be deleted.",
        );
    });

    it("deletes a finished, emptied program after confirming, then refreshes", async () => {
        renderList([reward("2", 30, 30)]);
        await userEvent.click(screen.getByRole("button", { name: "Finished (1)" }));

        await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
        expect(screen.getByTestId("staking-reward-delete-panel")).toHaveTextContent(
            "This removes the finished program from the chain. Nothing is paid out and nothing is lost.",
        );
        expect(m.tx).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole("button", { name: "Delete program #2" }));

        expect(m.tx).toHaveBeenCalledTimes(1);
        const [msgs, options] = m.tx.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/bze.rewards.MsgDeleteStakingReward",
            value: expect.objectContaining({ creator: "bze1someone", rewardId: "2" }),
        }]);
        options.onSuccess();
        options.onFailure("Someone still has a stake in this program");
        expect(m.refresh).toHaveBeenCalledTimes(2);
    });

    it("opens the Extend wizard for the program: extending is permissionless, on every row", async () => {
        renderList([reward("0000000000000007", 3, 30)]);
        await userEvent.click(screen.getByRole("button", { name: /Extend/ }));
        expect(m.navigate).toHaveBeenCalledWith("/reward/extend?id=0000000000000007");
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(m.tx).not.toHaveBeenCalled();
    });

    it("shows only the programs involving a token, LP programs of its pools included", () => {
        m.pools = [{ lp_denom: "ulp_tok_bze", base: TOK, quote: "ubze" }];
        renderList([
            reward("1", 0, 10),
            reward("2", 0, 10, "0", { staking_denom: "ubze", prize_denom: "ubze" }),
            reward("3", 0, 10, "0", { staking_denom: "ulp_tok_bze", prize_denom: "ubze" }),
            reward("4", 0, 10, "0", { staking_denom: "ubze", prize_denom: TOK }),
        ], { involving: TOK });

        expect(ids()).toEqual(["#1", "#3", "#4"]);
    });

    it("pins the programs with the wallet's own tokens", () => {
        m.address = "bze1owner";
        renderList([
            reward("1", 0, 10, "0", { staking_denom: "ubze", prize_denom: "ubze" }),
            reward("2", 0, 10),
        ], { pinMine: true });

        expect(ids(screen.getByRole("region", { name: "Programs with your tokens" }))).toEqual(["#2"]);
        expect(ids(screen.getByRole("region", { name: "Every other program" }))).toEqual(["#1"]);
    });

    it("pins nothing without a wallet that owns one of the tokens", () => {
        m.address = undefined;
        renderList([reward("2", 0, 10)], { pinMine: true });

        expect(screen.queryByRole("region", { name: "Programs with your tokens" })).not.toBeInTheDocument();
        expect(ids()).toEqual(["#2"]);
    });

    it("filters by status: running only, or the finished ones open", async () => {
        const onStatus = vi.fn();
        const rewards = [reward("1", 3, 30), reward("2", 30, 30)];
        const { rerender } = renderList(rewards, { status: "running", onStatus });
        expect(ids()).toEqual(["#1"]);
        expect(screen.queryByTestId("finished-staking-rewards")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Running" })).toHaveAttribute("aria-pressed", "true");

        await userEvent.click(screen.getByRole("button", { name: "Finished" }));
        expect(onStatus).toHaveBeenCalledWith("finished");

        rerender(<StakingProgramsList status="finished" onStatus={onStatus} />);
        expect(ids()).toEqual(["#2"]);
    });

    it("says nothing matches when the status filter empties the list", () => {
        renderList([reward("1", 3, 30)], { status: "finished", onStatus: vi.fn() });
        expect(screen.getByTestId("staking-programs-filtered-empty")).toHaveTextContent("Nothing matches this filter.");
    });

    it("shows the error with a Retry instead of an empty list", async () => {
        m.state = { rewards: [], isLoading: false, hasError: true };
        render(<ChakraProvider value={defaultSystem}><StakingProgramsList /></ChakraProvider>);

        expect(screen.getByText("Couldn't load the simple rewards")).toBeInTheDocument();
        expect(screen.queryByTestId("staking-programs-empty")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(m.refresh).toHaveBeenCalledTimes(1);
    });

    it("offers a campaign when there is none, and New program, both to the create form", async () => {
        renderList([], { returnTo: { href: "/tokens", label: "Tokens" } });

        expect(screen.getByTestId("staking-programs-empty")).toHaveTextContent("No simple rewards yet.");
        await userEvent.click(screen.getByRole("button", { name: "Run a campaign" }));
        expect(m.navigate).toHaveBeenLastCalledWith("/reward/new?return=%2Ftokens&returnLabel=Tokens");

        await userEvent.click(screen.getByRole("button", { name: "New program" }));
        expect(m.navigate).toHaveBeenCalledTimes(2);
    });

    it("names the token in the empty state and uses the caller's create link", async () => {
        renderList([reward("2", 0, 10, "0", { staking_denom: "ubze", prize_denom: "ubze" })], {
            involving: TOK,
            newProgramHref: "/reward/new?staking=x",
        });

        expect(screen.getByTestId("staking-programs-empty")).toHaveTextContent("No simple rewards with TOK yet.");
        await userEvent.click(screen.getByRole("button", { name: "New program" }));
        expect(m.navigate).toHaveBeenCalledWith("/reward/new?staking=x");
    });

    it("uses a list the caller passes in", () => {
        render(
            <ChakraProvider value={defaultSystem}>
                <StakingProgramsList programs={{ rewards: [reward("9", 0, 10)], isLoading: false, hasError: false, refresh: m.refresh }} />
            </ChakraProvider>,
        );
        expect(ids()).toEqual(["#9"]);
    });
});
