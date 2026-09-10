import { describe, it, expect, vi, beforeAll } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {
    AssetsContext,
    GAS_ESTIMATES,
    SettingsProvider,
    WalletSendForm,
    setInLocalStorage,
    type Asset,
    type AssetBalance,
    type AssetsContextType,
} from "@bze/bze-ui-kit";

// The send form lives in ui-kit and runs the REAL gas engine (useMaxSpendable /
// useCanAffordTx on top of GAS_ESTIMATES): only the wallet connection is mocked and the
// assets/balances are fed through the ui-kit context the app's AssetsProvider would fill.
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({
        address: "bze1test",
        status: WalletState.Connected,
        wallet: undefined,
        chain: undefined,
        getSigningClient: vi.fn(),
        signingClientError: undefined,
        disconnect: vi.fn(),
        getRpcEndpoint: vi.fn(),
    }),
}));

// The fee hooks read chain params (tradebin / txfeecollector) through the query layer, which
// serves them from its localStorage cache when present. Seed both caches so no request is
// made and the gas price is the known default (0.02 ubze/gas).
beforeAll(() => {
    setInLocalStorage("tradebin_params", JSON.stringify({
        minNativeLiquidityForModuleSwap: "100000000000",
        createMarketFee: { denom: "ubze", amount: "1000000" },
        marketMakerFee: { denom: "ubze", amount: "1000" },
        marketTakerFee: { denom: "ubze", amount: "2000" },
    }), 60_000);
    setInLocalStorage("txfeecollector_params", JSON.stringify({
        validatorMinGasFee: { denom: "ubze", amount: "0.02" },
    }), 60_000);
});

function makeAsset(ticker: string, denom: string): Asset {
    return {
        type: denom === "ubze" ? "native" : "factory",
        denom,
        decimals: 6,
        name: `${ticker} Token`,
        ticker,
        logo: "",
        stable: false,
        verified: true,
        supply: 1_000_000n,
    } as Asset;
}

const BZE = makeAsset("BZE", "ubze");
const USDC = makeAsset("USDC", "uusdc");
const BZE_BALANCE = new BigNumber(10).shiftedBy(6);   // 10 BZE
const USDC_BALANCE = new BigNumber(5).shiftedBy(6);   // 5 USDC

const balances: AssetBalance[] = [
    { ...BZE, amount: BZE_BALANCE, USDValue: new BigNumber(0) },
    { ...USDC, amount: USDC_BALANCE, USDValue: new BigNumber(0) },
];

const noop = () => {};
const assetsContext: AssetsContextType = {
    assetsMap: new Map([[BZE.denom, BZE], [USDC.denom, USDC]]),
    updateAssets: async () => new Map(),
    marketsMap: new Map(),
    updateMarkets: noop,
    marketsDataMap: new Map(),
    updateMarketsData: async () => new Map(),
    poolsMap: new Map(),
    poolsDataMap: new Map(),
    updateLiquidityPools: async () => {},
    balancesMap: new Map([
        [BZE.denom, { denom: BZE.denom, amount: BZE_BALANCE }],
        [USDC.denom, { denom: USDC.denom, amount: USDC_BALANCE }],
    ]),
    updateBalances: noop,
    usdPricesMap: new Map(),
    isLoading: false,
    isLoadingPrices: false,
    ibcChains: [],
    epochs: new Map(),
    updateEpochs: noop,
    connectionType: "none",
    updateConnectionType: noop,
} as unknown as AssetsContextType;

// The env defaults the engine applies without NEXT_PUBLIC_* overrides (constants/chain.ts):
// gas × 1.5 multiplier × 0.02 ubze/gas, half-up rounded, then shown in BZE.
const SEND_GAS_BZE = new BigNumber(GAS_ESTIMATES.send.base)
    .multipliedBy(1.5)
    .integerValue(BigNumber.ROUND_CEIL)
    .multipliedBy(0.02)
    .integerValue(BigNumber.ROUND_HALF_UP)
    .shiftedBy(-6);
const EXPECTED_MAX_BZE = new BigNumber(10).minus(SEND_GAS_BZE).toFixed();

function renderForm(selectedTicker: string) {
    return render(
        <WalletSendForm balances={balances} onClose={vi.fn()} selectedTicker={selectedTicker} accentColor="blue" />,
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <ChakraProvider value={defaultSystem}>
                    <SettingsProvider>
                        <AssetsContext.Provider value={assetsContext}>{children}</AssetsContext.Provider>
                    </SettingsProvider>
                </ChakraProvider>
            ),
        },
    );
}

const amountInput = () => screen.getByPlaceholderText("Amount to send") as HTMLInputElement;

describe("Wallet send form MAX button", () => {
    it("leaves the gas fee behind when sending the fee token (BZE)", async () => {
        renderForm("BZE");

        fireEvent.click(screen.getByRole("button", { name: "Max" }));

        await waitFor(() => expect(amountInput().value).toBe(EXPECTED_MAX_BZE));
        expect(screen.getByText(/Max keeps ≈ .* BZE for the network fee/)).toBeInTheDocument();
    });

    it("fills the full balance when sending another token", async () => {
        renderForm("USDC");

        fireEvent.click(screen.getByRole("button", { name: "Max" }));

        await waitFor(() => expect(amountInput().value).toBe("5"));
        expect(screen.queryByText(/for the network fee/)).not.toBeInTheDocument();
    });

    it("flags an amount that fits the balance but leaves no room for the gas fee", async () => {
        renderForm("BZE");

        fireEvent.change(amountInput(), { target: { value: "10" } });

        await waitFor(() =>
            expect(screen.getByText(/Not enough BZE left for the network fee/)).toBeInTheDocument(),
        );
    });
});
