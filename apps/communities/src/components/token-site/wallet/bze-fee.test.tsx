import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {type Asset, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

let skipEnabled = true;
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    isSkipEnabled: () => skipEnabled,
    useAssets: () => ({denomTicker: () => "BZE", denomDecimals: () => 6}),
    useBalance: (denom: string) => ({balance: {denom, amount: new BigNumber("1234560")}}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: WalletState.Connected, address: "bze1me", connect: vi.fn()}),
}));

let needsBze = true;
vi.mock("@/hooks/token-site/useTokenFeeMode", () => ({
    useFeeMode: () => ({needsBze}),
}));

import {TokenWalletProvider, useTokenWallet} from "@/hooks/token-site/useTokenWallet";
import {TokenSiteTheme} from "../kit";
import {BzeFeeNotice, BzeFeeRow} from "./bze-fee";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: "factory/bze1owner/upage", decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false,
    verified: false, supply: 1n,
};

function View() {
    const {view, isOpen} = useTokenWallet();
    return <output data-testid="view">{isOpen ? view : "closed"}</output>;
}

function renderBoth() {
    const user = userEvent.setup();
    render(<><BzeFeeNotice asset={ASSET}/><BzeFeeRow/><View/></>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><TokenWalletProvider>{children}</TokenWalletProvider></TokenSiteTheme>
            </ChakraProvider>
        ),
    });
    return user;
}

beforeEach(() => {
    skipEnabled = true;
    needsBze = true;
});

describe("BZE fee notice and row", () => {
    it("say fees need BZE in low-liquidity mode, with the BZE balance", () => {
        renderBoth();

        expect(screen.getByTestId("bze-fee-notice")).toHaveTextContent(
            "PAGE runs on the BeeZee network. Each transaction needs a small amount of BZE for the network fee.",
        );
        expect(screen.getByTestId("bze-fee-row")).toHaveTextContent("Network fees are paid in BZE · 1.23 BZE available");
    });

    it("render nothing, and no BeeZee wording, while the token pays its own fees", () => {
        needsBze = false;
        renderBoth();

        expect(screen.queryByTestId("bze-fee-notice")).not.toBeInTheDocument();
        expect(screen.queryByTestId("bze-fee-row")).not.toBeInTheDocument();
        expect(screen.queryByText(/BeeZee|BZE/)).not.toBeInTheDocument();
    });

    it("open the Get BZE panel from Get BZE", async () => {
        const user = renderBoth();

        const [fromNotice] = screen.getAllByRole("button", {name: "Get BZE"});
        await user.click(fromNotice);

        expect(screen.getByTestId("view")).toHaveTextContent("get-bze");
    });

    it("keep the text but drop Get BZE while Skip is off", () => {
        skipEnabled = false;
        renderBoth();

        expect(screen.getByTestId("bze-fee-notice")).toBeInTheDocument();
        expect(screen.getByTestId("bze-fee-row")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Get BZE"})).not.toBeInTheDocument();
    });
});
