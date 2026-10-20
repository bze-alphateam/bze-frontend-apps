import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {ChakraProvider} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import {createHiveGlowSystem, PrettyBalance} from "@bze/bze-ui-kit";
import {BoostRewardsTile} from "./boost-rewards-tile";

const renderTile = (rewards: PrettyBalance[], usdValue = '0', onClaim = vi.fn()) => render(
    <ChakraProvider value={createHiveGlowSystem('dex')}>
        <BoostRewardsTile rewards={rewards} usdValue={usdValue} onClaim={onClaim}/>
    </ChakraProvider>
);

describe("BoostRewardsTile", () => {
    it("hides Claim when no rewards are locked", () => {
        renderTile([]);
        expect(screen.getByText("$0")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: /claim/i})).not.toBeInTheDocument();
    });

    it("hides Claim when every pending reward is zero", () => {
        renderTile([{denom: 'ubze', amount: new BigNumber(0)}, {denom: 'uvdl', amount: new BigNumber(0)}]);
        expect(screen.queryByRole("button", {name: /claim/i})).not.toBeInTheDocument();
    });

    it("shows Claim for a pending reward, even when its USD value is $0", () => {
        const onClaim = vi.fn();
        renderTile([{denom: 'ubze', amount: new BigNumber(0)}, {denom: 'uvdl', amount: new BigNumber('0.000001')}], '0', onClaim);
        fireEvent.click(screen.getByRole("button", {name: /claim/i}));
        expect(onClaim).toHaveBeenCalledOnce();
    });
});
