import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import { createHiveGlowSystem, type NativeStakingData } from "@bze/bze-ui-kit";
import { NativeStakingDialog } from "@/components/ui/staking/native-staking";

// The dialog's data comes in through props; only the wallet, the assets and the tx hooks are faked.
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1test" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useAssets: () => ({ nativeAsset: { denom: "ubze", ticker: "BZE", decimals: 6 } }),
    useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
    useSDKTx: () => ({ tx: vi.fn() }),
    useCanAffordTx: () => ({ canAfford: true, message: "" }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem("dex")}>{children}</ChakraProvider>
);

const bze = (amount: number) => ({ denom: "ubze", amount: new BigNumber(amount).shiftedBy(6) });

function stakingData(staked: number, rewards: number): NativeStakingData {
    return {
        averageApr: "12",
        unlockDuration: "21",
        totalStaked: bze(1_000_000),
        minAmount: bze(0),
        averageDailyDistribution: bze(5_000),
        currentStaking: {
            staked: bze(staked),
            unbonding: { total: bze(0), firstUnlock: {} },
            pendingRewards: { total: bze(rewards), validators: ["bzevaloper1a"] },
        },
    };
}

afterEach(cleanup);

describe("NativeStakingDialog", () => {
    it("shows the stake and rewards, then the Staking link beside a compact Claim", () => {
        render(<NativeStakingDialog stakingData={stakingData(1_000, 3)} onClose={vi.fn()}/>, { wrapper });

        const dialog = screen.getByRole("dialog");
        const figures = within(dialog).getAllByTestId("staking-figure").map((el) => el.getAttribute("data-type"));
        expect(figures).toEqual(["staking", "rewards"]);

        const footer = within(dialog).getByTestId("native-staking-actions");
        expect(within(footer).getByRole("link", { name: /Staking/ })).toBeTruthy();
        expect(within(footer).getByRole("button", { name: "Claim" })).toBeTruthy();
    });

    it("points a wallet without a stake to the Staking app and offers no Claim", () => {
        render(<NativeStakingDialog stakingData={stakingData(0, 0)} onClose={vi.fn()}/>, { wrapper });

        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText(/not staking BZE yet/)).toBeTruthy();
        expect(within(dialog).queryByRole("button", { name: "Claim" })).toBeNull();
        expect(within(dialog).getByRole("link", { name: /Staking/ })).toBeTruthy();
    });

    it("moves to the claim step from Claim, and closes through onClose", async () => {
        const onClose = vi.fn();
        render(<NativeStakingDialog stakingData={stakingData(1_000, 3)} onClose={onClose}/>, { wrapper });

        fireEvent.click(within(screen.getByTestId("native-staking-actions")).getByRole("button", { name: "Claim" }));
        expect(screen.getByRole("button", { name: /Claim Rewards/ })).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /close/i }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
});
