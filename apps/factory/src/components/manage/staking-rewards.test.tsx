import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

// Drive the list off its data hook; the tx layer and wallet are stubbed so the test asserts the
// row states (running / finished + staked / finished + empty) and the delete message only.
const { useStakingRewardsMock, txMock, refreshMock } = vi.hoisted(() => ({
    useStakingRewardsMock: vi.fn(),
    txMock: vi.fn(),
    refreshMock: vi.fn(),
}));

vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => useStakingRewardsMock() }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: vi.fn() }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1someone" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BigNumber } = await import("bignumber.js");
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        "factory/bze1owner/utok": { denom: "factory/bze1owner/utok", ticker: "TOK", decimals: 6, logo: "" },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber(0) } }),
    };
});

import { StakingRewards } from "./staking-rewards";

const reward = (id: string, payouts: number, duration: number, staked_amount = "0"): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "1000000",
    prize_denom: "ubze",
    staking_denom: "factory/bze1owner/utok",
    duration,
    payouts,
    min_stake: 0n,
    lock: 0,
    staked_amount,
    distributed_stake: "0",
});

function renderList(rewards: StakingRewardSDKType[]) {
    useStakingRewardsMock.mockReturnValue({ rewards, isLoading: false, refresh: refreshMock });
    return render(<StakingRewards />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useStakingRewardsMock.mockReset();
    txMock.mockReset().mockResolvedValue(true);
    refreshMock.mockReset();
});

describe("StakingRewards", () => {
    it("keeps running programs as they are, with no Delete", () => {
        renderList([reward("1", 3, 30, "5000000")]);

        expect(screen.getByRole("button", { name: /Extend/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
        expect(screen.queryByTestId("finished-staking-rewards")).not.toBeInTheDocument();
    });

    it("collapses finished programs into a group with their count", async () => {
        renderList([reward("1", 3, 30), reward("2", 30, 30), reward("3", 10, 10, "7")]);

        const toggle = screen.getByRole("button", { name: "Finished (2)" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.getAllByText(/^#/)).toHaveLength(1);

        await userEvent.click(toggle);
        expect(screen.getAllByText(/^#/)).toHaveLength(3);
    });

    it("disables Delete on a finished program that still holds stake and says why", async () => {
        renderList([reward("2", 30, 30, "1500000")]);
        await userEvent.click(screen.getByRole("button", { name: "Finished (1)" }));

        expect(screen.getByRole("button", { name: /Delete/ })).toBeDisabled();
        expect(screen.getByTestId("staking-reward-delete-blocker")).toHaveTextContent(
            "1.5 TOK still staked — stakers must exit first",
        );
    });

    it("deletes a finished, emptied program after confirming, then refreshes", async () => {
        renderList([reward("2", 30, 30)]);
        await userEvent.click(screen.getByRole("button", { name: "Finished (1)" }));

        await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
        expect(screen.getByTestId("staking-reward-delete-panel")).toHaveTextContent(/paid everything it had and\s+holds no stake/);
        expect(txMock).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole("button", { name: "Delete program #2" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [msgs, options] = txMock.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/bze.rewards.MsgDeleteStakingReward",
            value: expect.objectContaining({ creator: "bze1someone", rewardId: "2" }),
        }]);
        options.onSuccess();
        options.onFailure("Someone still has a stake in this program");
        expect(refreshMock).toHaveBeenCalledTimes(2);
    });
});
