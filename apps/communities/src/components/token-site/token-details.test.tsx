import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Asset} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const TOKEN = "factory/bze1owner/honey";
const POOL = "bze1communitypooladdress0000000000000000";

const useDenomConfig = vi.fn();
const getAddressDenomBalance = vi.fn();
const getFactoryDenomAuthority = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useDenomConfig: (denom: string) => useDenomConfig(denom),
    getAddressDenomBalance: (address: string, denom: string) => getAddressDenomBalance(address, denom),
    getFactoryDenomAuthority: (denom: string) => getFactoryDenomAuthority(denom),
}));

import {TokenDetails} from "./token-details";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: TOKEN, decimals: 6, name: "Honey", ticker: "HONEY",
    logo: "", stable: false, verified: false, supply: 1n,
};

const config = (communityPool: string, gasSurcharge: string, transferFee: string, status = "ok") =>
    ({status, communityPool, gasSurcharge: new BigNumber(gasSurcharge), transferFee: new BigNumber(transferFee)});

function renderDetails() {
    return render(<TokenDetails asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

describe("TokenDetails fee settings", () => {
    beforeEach(() => {
        useDenomConfig.mockReset();
        getAddressDenomBalance.mockReset();
        getFactoryDenomAuthority.mockReset().mockResolvedValue({admin: "bze1admin", mintable: true});
    });

    it("shows all three settings with the community pool and its balance", async () => {
        useDenomConfig.mockReturnValue(config(POOL, "0.5", "0.01"));
        getAddressDenomBalance.mockResolvedValue("12345000000");
        renderDetails();

        expect(screen.getByTestId("fee-settings")).toBeTruthy();
        expect(screen.getByTestId("transfer-fee").textContent).toBe("1% extra on app fees paid in HONEY");
        expect(screen.getByTestId("gas-surcharge").textContent).toBe("+50% when HONEY pays the network fee");
        expect(screen.getByTestId("fee-explanation").textContent).toContain("go to its community pool.");
        await waitFor(() => expect(screen.getByTestId("pool-balance").textContent).toContain("holds 12,345 HONEY"));
        expect(getAddressDenomBalance).toHaveBeenCalledWith(POOL, TOKEN);
        expect(screen.getByLabelText("Copy community pool address")).toBeTruthy();
    });

    it("says fees are burned when there is no community pool", () => {
        useDenomConfig.mockReturnValue(config("", "0", "0.025"));
        renderDetails();

        expect(screen.getByTestId("community-pool").textContent).toBe("None: fees in HONEY are burned");
        expect(screen.getByTestId("transfer-fee").textContent).toContain("2.5%");
        expect(screen.queryByTestId("gas-surcharge")).toBeNull();
        expect(screen.getByTestId("fee-explanation").textContent).toContain("are burned.");
        expect(getAddressDenomBalance).not.toHaveBeenCalled();
    });

    it("treats ratios that round to 0% as no setting", () => {
        useDenomConfig.mockReturnValue(config("", "0.00001", "0.00001"));
        renderDetails();
        expect(screen.queryByTestId("fee-settings")).toBeNull();
    });

    it("renders as before when every setting is zero", () => {
        useDenomConfig.mockReturnValue(config("", "0", "0"));
        renderDetails();
        expect(screen.queryByTestId("fee-settings")).toBeNull();
        expect(screen.getByText("Token details")).toBeTruthy();
    });

    it("renders as before on a v8.2.0 node and while loading", () => {
        useDenomConfig.mockReturnValue(config("", "0", "0", "unsupported"));
        const {unmount} = renderDetails();
        expect(screen.queryByTestId("fee-settings")).toBeNull();
        unmount();

        useDenomConfig.mockReturnValue(undefined);
        renderDetails();
        expect(screen.queryByTestId("fee-settings")).toBeNull();
    });
});
