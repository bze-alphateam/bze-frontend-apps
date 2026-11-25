import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import { rulesFor } from "@/test-support/css-rules";

// The details read the asset's markets and pools and each row's assets through ui-kit.
// Those hooks are fed one BZE/USDC market and one BZE/USDC pool; the logos stay real.
const { BZE, USDC } = vi.hoisted(() => {
    const asset = (denom: string, ticker: string) => ({
        type: "Native", denom, decimals: 6, name: ticker, ticker, logo: "", stable: false, verified: true, supply: 1000n,
    });
    return { BZE: asset("ubze", "BZE"), USDC: asset("uusdc", "USDC") };
});

const authority = vi.hoisted(() => ({ value: { admin: "", mintable: false } as { admin: string; mintable: boolean } | undefined | 'reject' | ((denom: string) => { admin: string; mintable: boolean }) }));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, unknown> = { ubze: BZE, uusdc: USDC };
    return {
        ...actual,
        getFactoryDenomAuthority: async (denom: string) => {
            const answer = authority.value;
            if (answer === 'reject') throw new Error('node down');
            return typeof answer === 'function' ? answer(denom) : answer;
        },
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssetMarkets: () => ({
            assetMarketsData: [],
            asset24hTradedVolume: new BigNumber(0),
            assetMarkets: [{ base: "ubze", quote: "uusdc" }],
        }),
        useAssetLiquidityPools: () => ({
            assetPools: [{ id: "ubze_uusdc", base: "ubze", quote: "uusdc", reserve_base: "0", reserve_quote: "0" }],
            asset24HoursVolume: new BigNumber(0),
            assetPoolsData: new Map(),
        }),
        useMarket: () => ({
            marketSymbol: "BZE/USDC",
            market: { base: "ubze", quote: "uusdc" },
            marketData: undefined,
            isLoading: false,
        }),
    };
});

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ toLpPage: vi.fn(), toMarketPage: vi.fn() }),
}));

import { AssetDetails } from "./asset-details";

function renderDetails() {
    return render(
        <ChakraProvider value={defaultSystem}>
            <AssetDetails asset={BZE as unknown as Asset} />
        </ChakraProvider>,
    );
}

describe("AssetDetails pair logos", () => {
    it("draws an order book market's pair like the markets list, untiled", () => {
        renderDetails();

        const logo = within(screen.getByRole("button", { name: "BZE/USDC market" })).getByTestId("pair-logo");
        const token = logo.firstElementChild!.firstElementChild as HTMLElement;
        expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-8\)/);
        // The old row framed a smaller pair in its own bordered tile.
        expect(rulesFor(logo.parentElement as HTMLElement)).not.toMatch(/border-width/);
    });

    it("draws a liquidity pool's pair the same way", () => {
        renderDetails();

        const logo = within(screen.getByRole("button", { name: "BZE/USDC liquidity pool" })).getByTestId("pair-logo");
        const token = logo.firstElementChild!.firstElementChild as HTMLElement;
        expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-8\)/);
    });
});

describe("AssetDetails supply notice of a factory token", () => {
    const FACTORY = { ...BZE, type: "Factory", denom: "factory/bze1creator/utok", ticker: "UTOK" } as unknown as Asset;
    const renderFactory = () => render(
        <ChakraProvider value={defaultSystem}>
            <AssetDetails asset={FACTORY} />
        </ChakraProvider>,
    );

    it("warns about supply control for an admin who can still mint", async () => {
        authority.value = { admin: "bze1admin", mintable: true };
        renderFactory();

        expect(await screen.findByText("Centralized Supply Control")).toBeInTheDocument();
    });

    it("calls the supply decentralized when the admin turned minting off", async () => {
        authority.value = { admin: "bze1admin", mintable: false };
        renderFactory();

        await waitFor(() => expect(screen.getByText(/Minting has been turned off for good/)).toBeInTheDocument());
        expect(screen.queryByText("Centralized Supply Control")).not.toBeInTheDocument();
    });

    it("calls the supply decentralized when the admin was renounced", async () => {
        authority.value = { admin: "", mintable: false };
        renderFactory();

        expect(await screen.findByText(/Ownership has been renounced/)).toBeInTheDocument();
    });

    it("shows no supply claim while the lookup is pending", async () => {
        let release: (v: { admin: string; mintable: boolean }) => void = () => {};
        authority.value = () => new Promise(resolve => { release = resolve; }) as never;
        renderFactory();

        expect(screen.queryByText("Decentralized Supply")).not.toBeInTheDocument();
        expect(screen.queryByText("Centralized Supply Control")).not.toBeInTheDocument();
        release({ admin: "", mintable: false });
        expect(await screen.findByText("Decentralized Supply")).toBeInTheDocument();
    });

    it("shows no supply claim when the lookup fails or answers undefined", async () => {
        authority.value = "reject";
        const failed = renderFactory();
        await waitFor(() => expect(screen.getByText("…")).toBeInTheDocument());
        expect(screen.queryByText("Decentralized Supply")).not.toBeInTheDocument();
        failed.unmount();

        authority.value = undefined;
        renderFactory();
        await waitFor(() => expect(screen.getByText("…")).toBeInTheDocument());
        expect(screen.queryByText("Decentralized Supply")).not.toBeInTheDocument();
        expect(screen.queryByText("Centralized Supply Control")).not.toBeInTheDocument();
    });

    it("does not carry token A's answer over to token B", async () => {
        authority.value = (denom: string) => denom.endsWith("/a") ? { admin: "bze1admin", mintable: true } : { admin: "", mintable: false };
        const A = { ...FACTORY, denom: "factory/bze1creator/a" } as unknown as Asset;
        const B = { ...FACTORY, denom: "factory/bze1creator/b" } as unknown as Asset;
        const view = render(<ChakraProvider value={defaultSystem}><AssetDetails asset={A} /></ChakraProvider>);
        expect(await screen.findByText("Centralized Supply Control")).toBeInTheDocument();

        authority.value = () => new Promise(() => {}) as never;
        view.rerender(<ChakraProvider value={defaultSystem}><AssetDetails asset={B} /></ChakraProvider>);

        expect(screen.queryByText("Centralized Supply Control")).not.toBeInTheDocument();
        expect(screen.queryByText("bze1admin")).not.toBeInTheDocument();
    });
});
