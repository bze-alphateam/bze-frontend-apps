import {describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {Asset} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const useFeeTokens = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useFeeTokens: () => useFeeTokens(),
}));

import {SiteFooter} from "./site-footer";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: "factory/bze1owner/upage", decimals: 6, name: "Page Token", ticker: "PAGE",
    logo: "", stable: false, verified: false, supply: 1n,
};

function renderFooter(feeToken: boolean, isLoading = false) {
    useFeeTokens.mockReturnValue({isLoading, isValidFeeDenom: (denom: string) => feeToken && denom === ASSET.denom});
    return render(<SiteFooter asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

describe("SiteFooter", () => {
    it("shows the token's name and no BeeZee mention when the token pays its own fees", () => {
        renderFooter(true);

        expect(screen.getByText("Page Token")).toBeInTheDocument();
        expect(screen.queryByText("Runs on BeeZee")).not.toBeInTheDocument();
    });

    it("says it runs on BeeZee in low-liquidity mode", () => {
        renderFooter(false);

        expect(screen.getByRole("link", {name: "Runs on BeeZee"})).toHaveAttribute("href", "https://getbze.com");
    });

    it("stays quiet while the fee tokens load", () => {
        renderFooter(false, true);

        expect(screen.queryByText("Runs on BeeZee")).not.toBeInTheDocument();
    });
});
