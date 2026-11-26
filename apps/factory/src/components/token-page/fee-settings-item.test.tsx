import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The "Fees and community pool" item on a mocked config read, wallet and tx hook: the tests read the
// msgs handed to the tx.
type Info = { status: "ok" | "unsupported" | "error"; communityPool: string; transferFee: BigNumber; gasSurcharge: BigNumber };
const OWNER = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";
const POOL = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";
const DENOM = `factory/${OWNER}/uhoney`;

const m = vi.hoisted(() => ({
    tx: vi.fn(),
    getInfo: vi.fn(),
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76" }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        getDenomConfigInfo: m.getInfo,
        useMaxSpendable: () => ({ gasFee: { amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE" } }),
    };
});

import { FeeSettingsItem } from "./fee-settings-item";
import type { AdminAccess } from "./action-group";

const asset = { denom: DENOM, ticker: "HONEY", name: "Honey", decimals: 6, logo: "" } as Asset;
const info = (over: Partial<Info> = {}): Info => ({ status: "ok", communityPool: "", transferFee: new BigNumber(0), gasSurcharge: new BigNumber(0), ...over });

const renderItem = (access: AdminAccess) => render(<FeeSettingsItem asset={asset} access={access} />, {
    wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
});
const item = async () => within(await screen.findByTestId("fee-settings-item"));
const openForm = async () => {
    renderItem("admin")
    await userEvent.click((await item()).getByRole("button", { name: "Edit" }));
    return within(await screen.findByRole("form", { name: "Fees and community pool" }));
};
const sentValue = () => (m.tx.mock.calls[0][0] as { typeUrl: string; value: Record<string, string> }[])[0];

beforeEach(() => {
    m.tx.mockReset();
    m.tx.mockImplementation(async (_msgs: unknown, opts: { onSuccess?: () => void }) => { opts.onSuccess?.(); return true; });
    m.getInfo.mockReset();
    m.getInfo.mockResolvedValue(info({ communityPool: POOL, transferFee: new BigNumber("0.01"), gasSurcharge: new BigNumber("0.5") }));
});

describe("FeeSettingsItem read-only", () => {
    it.each(["not-admin", "unknown", "checking"])("shows the summary and no Edit for %s", async (access) => {
        const view = await (renderItem(access), item());
        expect(view.getByTestId("fee-setting-transfer")).toHaveTextContent("Transfer fee: 1%");
        expect(view.getByTestId("fee-setting-surcharge")).toHaveTextContent("Gas surcharge: 50%");
        expect(view.getByTestId("fee-setting-pool")).toHaveTextContent("Community pool: bze1sx");
        expect(view.getByTestId("fee-setting-pool").querySelector("[title]")).toHaveAttribute("title", POOL);
        expect(view.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
        expect(view.queryByText(/Frozen/)).not.toBeInTheDocument();
    });

    it("renounced: read-only and says it is frozen", async () => {
        const view = await (renderItem("renounced"), item());
        expect(view.getByText("Frozen: nobody can change these settings.")).toBeInTheDocument();
        expect(view.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("says the fees are burned when there is no community pool", async () => {
        m.getInfo.mockResolvedValue(info());
        const view = await (renderItem("not-admin"), item());
        expect(view.getByTestId("fee-setting-pool")).toHaveTextContent("Community pool: None: these fees are burned");
    });

    it("is hidden on a v8.2.0 node (the config route answers 501)", async () => {
        m.getInfo.mockResolvedValue(info({ status: "unsupported" }));
        renderItem("admin");
        await waitFor(() => expect(screen.queryByTestId("fee-settings-loading")).not.toBeInTheDocument());
        expect(screen.queryByTestId("fee-settings-item")).not.toBeInTheDocument();
    });

    it("shows a shimmer while loading, and a retry when the read failed", async () => {
        m.getInfo.mockResolvedValueOnce(info({ status: "error" }));
        renderItem("admin");
        expect(screen.getByTestId("fee-settings-loading")).toBeInTheDocument();
        const view = await item();
        expect(view.getByText("Couldn't load the fee settings of HONEY.")).toBeInTheDocument();
        m.getInfo.mockResolvedValue(info());
        await userEvent.click(view.getByRole("button", { name: "Retry" }));
        expect(await screen.findByTestId("fee-setting-transfer")).toBeInTheDocument();
        expect(m.getInfo).toHaveBeenLastCalledWith(DENOM, { fresh: true });
    });
});

describe("FeeSettingsItem form for the admin", () => {
    it("opens prefilled with the live config and keeps Save disabled while nothing changed", async () => {
        const form = await openForm();
        expect(form.getByLabelText("Community pool (optional)")).toHaveValue(POOL);
        expect(form.getByLabelText("Transfer fee (%, 0 to 5)")).toHaveValue("1");
        expect(form.getByLabelText("Gas surcharge (%, 0 to 200)")).toHaveValue("50");
        expect(form.getByRole("button", { name: "Save fee settings" })).toBeDisabled();
    });

    it("reads the live config when Edit opens, so the form prefills and diffs against it, not the cache", async () => {
        m.getInfo.mockImplementation(async (_denom: string, opts?: { fresh?: boolean }) => (
            opts?.fresh ? info({ communityPool: POOL, transferFee: new BigNumber("0.02"), gasSurcharge: new BigNumber("0.5") }) : info({ communityPool: POOL, transferFee: new BigNumber("0.01"), gasSurcharge: new BigNumber("0.5") })
        ));
        const form = await openForm();

        expect(m.getInfo).toHaveBeenLastCalledWith(DENOM, { fresh: true });
        expect(form.getByLabelText("Transfer fee (%, 0 to 5)")).toHaveValue("2");
        // nothing differs from the live 2 %, so Save stays disabled
        expect(form.getByRole("button", { name: "Save fee settings" })).toBeDisabled();
    });

    it("lists old -> new for each changed field and sends all three fields", async () => {
        const form = await openForm();
        const fee = form.getByLabelText("Transfer fee (%, 0 to 5)");
        await userEvent.clear(fee);
        await userEvent.type(fee, "2.5");

        expect(form.getByTestId("fee-settings-changes")).toHaveTextContent("Transfer fee: 1% → 2.5%");
        await userEvent.click(form.getByRole("button", { name: "Save fee settings" }));

        expect(m.tx).toHaveBeenCalledTimes(1);
        expect(sentValue().typeUrl).toBe("/bze.tokenfactory.MsgSetDenomConfig");
        expect(sentValue().value).toEqual({ creator: OWNER, denom: DENOM, communityPool: POOL, transferFee: "0.025", gasSurcharge: "0.5" });
    });

    it("Reset to defaults sends an empty pool and zero rates", async () => {
        const form = await openForm();
        await userEvent.click(form.getByRole("button", { name: "Reset to defaults" }));

        expect(form.getByTestId("fee-settings-changes")).toHaveTextContent("Community pool: bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0 → None");
        await userEvent.click(form.getByRole("button", { name: "Save fee settings" }));

        expect(sentValue().value).toEqual({ creator: OWNER, denom: DENOM, communityPool: "", transferFee: "0", gasSurcharge: "0" });
    });

    it("Clear empties only the community pool", async () => {
        const form = await openForm();
        await userEvent.click(form.getByRole("button", { name: "Clear" }));
        await userEvent.click(form.getByRole("button", { name: "Save fee settings" }));

        expect(sentValue().value).toMatchObject({ communityPool: "", transferFee: "0.01", gasSurcharge: "0.5" });
    });

    it("refuses out-of-range rates and a bad address, without sending", async () => {
        const form = await openForm();
        const fee = form.getByLabelText("Transfer fee (%, 0 to 5)");
        await userEvent.clear(fee);
        await userEvent.type(fee, "5.01");
        expect(form.getByText("Transfer fee can be at most 5%.")).toBeInTheDocument();
        expect(form.getByRole("button", { name: "Save fee settings" })).toBeDisabled();

        await userEvent.clear(fee);
        await userEvent.type(fee, "1");
        const pool = form.getByLabelText("Community pool (optional)");
        await userEvent.clear(pool);
        await userEvent.type(pool, "bze1nope");
        expect(form.getByRole("button", { name: "Save fee settings" })).toBeDisabled();
        expect(m.tx).not.toHaveBeenCalled();
    });

    it("asks the node again, past the cache, after a successful save and shows the new values", async () => {
        const form = await openForm();
        await userEvent.click(form.getByRole("button", { name: "Reset to defaults" }));
        m.getInfo.mockResolvedValue(info());
        await userEvent.click(form.getByRole("button", { name: "Save fee settings" }));

        await waitFor(() => expect(m.getInfo).toHaveBeenLastCalledWith(DENOM, { fresh: true }));
        await waitFor(() => expect(screen.getByTestId("fee-setting-transfer")).toHaveTextContent("Transfer fee: 0%"));
        expect(screen.queryByRole("form", { name: "Fees and community pool" })).not.toBeInTheDocument();
    });
});
