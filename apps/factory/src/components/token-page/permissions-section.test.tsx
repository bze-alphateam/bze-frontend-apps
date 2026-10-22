import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The Permissions section with the real Transfer admin and Renounce dialogs, the real wizard tx hook
// and pending-tx store. The wallet, the wallet side of the tx (useFactoryTx), the setup facts, the
// gas estimate and the toast are mocked, so the tests read the msgs handed to the tx.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};

const m = vi.hoisted(() => ({
    tx: vi.fn(),
    toast: vi.fn(),
    address: "" as string | undefined,
    setupItems: [] as { key: string; title: string; state: string }[],
}));

const OWNER = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";
const OTHER = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";

vi.mock("next/navigation", () => ({
    usePathname: () => "/tokens/token",
    useSearchParams: () => new URLSearchParams(`denom=factory/${OWNER}/uhoney`),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => ({ items: m.setupItems, isLoading: false }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useToast: () => ({ toast: { success: m.toast } }),
        useGasFeeEstimate: () => ({ amount: new BigNumber(20000), displayAmount: new BigNumber("0.02"), ticker: "TBZE", denom: "ubze", isNative: true, isLoading: false }),
        getExplorerTxURL: (hash: string) => `https://explorer.example/tx/${hash}`,
    };
});

import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";
import { PermissionsSection, type PermissionsSectionProps } from "./permissions-section";

const DENOM = `factory/${OWNER}/uhoney`;
const asset = { denom: DENOM, ticker: "HONEY", name: "Honey", decimals: 6, logo: "", supply: 1000000000n } as unknown as PermissionsSectionProps["asset"];

const props = (over: Partial<PermissionsSectionProps> = {}): PermissionsSectionProps => ({
    asset,
    isChecking: false,
    admin: OWNER,
    adminState: "admin",
    supplyDisplay: new BigNumber(1000000),
    supply: "1000000000000",
    refreshAdmins: vi.fn(async () => {}),
    ...over,
});

function renderSection(p: PermissionsSectionProps) {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    return render(<PermissionsSection {...p} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <PendingTxProvider store={store}>{children}</PendingTxProvider>
            </ChakraProvider>
        ),
    });
}

const sentMsgs = () => m.tx.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

beforeEach(() => {
    m.tx.mockReset();
    m.tx.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("ABCDEF0123456789");
        opts.onSuccess?.({ txhash: "ABCDEF0123456789", height: 42, code: 0 });
        return true;
    });
    m.toast.mockReset();
    m.address = OWNER;
    m.setupItems = [
        { key: "created", title: "Token created", state: "done" },
        { key: "description", title: "Description", state: "todo" },
        { key: "brandKit", title: "Brand kit", state: "done" },
        { key: "registry", title: "Listed in the Cosmos Chain Registry", state: "todo" },
    ];
});

describe("PermissionsSection: states", () => {
    it("admin: the status line and both items", () => {
        renderSection(props());
        const section = within(screen.getByTestId("permissions-section"));
        expect(section.getByRole("heading", { name: "Permissions" })).toBeInTheDocument();
        expect(section.getByTestId("permissions-status")).toHaveTextContent(/^Admin: your wallet, bze1uv.*Changes here can't be undone by you\.$/);
        expect(within(section.getByTestId("transfer-admin-item")).getByText("Give admin rights to another address, e.g. a team multisig.")).toBeInTheDocument();
        expect(within(section.getByTestId("renounce-admin-item")).getByText("Nobody, you included, can ever mint or edit HONEY again.")).toBeInTheDocument();
        expect(section.getByRole("button", { name: "Transfer admin" })).toBeInTheDocument();
        expect(section.getByRole("button", { name: "Renounce…" })).toBeInTheDocument();
    });

    it("not admin: who is, and no actions", () => {
        m.address = OTHER;
        renderSection(props({ adminState: "not-admin" }));
        expect(screen.getByTestId("permissions-status")).toHaveTextContent(/^Admin: bze1uv/);
        expect(screen.getByTestId("permissions-status")).toHaveAttribute("title", OWNER);
        expect(screen.queryByTestId("transfer-admin-item")).not.toBeInTheDocument();
        expect(screen.queryByTestId("renounce-admin-item")).not.toBeInTheDocument();
    });

    it("disconnected: the status line only", () => {
        m.address = undefined;
        renderSection(props({ adminState: "not-admin" }));
        expect(screen.getByTestId("permissions-status")).toHaveTextContent(/^Admin: bze1uv/);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renounced: Admin given up, and no actions", () => {
        renderSection(props({ admin: "", adminState: "renounced" }));
        expect(screen.getByTestId("permissions-status")).toHaveTextContent("Admin given up. Nobody can mint or edit HONEY any more.");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("unknown: says actions stay hidden, and retries", async () => {
        const refreshAdmins = vi.fn(async () => {});
        renderSection(props({ admin: undefined, adminState: "unknown", refreshAdmins }));
        expect(screen.getByTestId("permissions-unknown")).toHaveTextContent("Unable to verify admin permissions. Actions stay hidden until we know.");
        expect(screen.queryByTestId("transfer-admin-item")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(refreshAdmins).toHaveBeenCalledTimes(1);
    });

    it("checking: a shimmer, no status and no actions yet", () => {
        renderSection(props({ isChecking: true }));
        expect(screen.getByTestId("admin-item-loading")).toBeInTheDocument();
        expect(screen.queryByTestId("permissions-status")).not.toBeInTheDocument();
        expect(screen.queryByTestId("transfer-admin-item")).not.toBeInTheDocument();
    });
});

describe("Transfer admin dialog", () => {
    const open = async () => {
        await userEvent.click(screen.getByRole("button", { name: "Transfer admin" }));
        return within(await screen.findByRole("dialog", { name: "Transfer admin of HONEY" }));
    };

    it("validates the address: required, bech32, never your own", async () => {
        renderSection(props());
        const dialog = await open();
        const input = dialog.getByPlaceholderText("bze1…");

        await userEvent.click(dialog.getByRole("button", { name: "Continue" }));
        expect(dialog.getByText("Enter the new admin address.")).toBeInTheDocument();

        await userEvent.type(input, "not-an-address");
        expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();

        await userEvent.clear(input);
        await userEvent.type(input, OWNER);
        expect(dialog.getByText("That's already you.")).toBeInTheDocument();
        expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(m.tx).not.toHaveBeenCalled();
    });

    it("reviews what changes, sends MsgChangeAdmin to the new address and refreshes the admin", async () => {
        const refreshAdmins = vi.fn(async () => {});
        renderSection(props({ refreshAdmins }));
        const dialog = await open();

        await userEvent.type(dialog.getByPlaceholderText("bze1…"), `  ${OTHER} `);
        await userEvent.click(dialog.getByRole("button", { name: "Continue" }));

        const rows = dialog.getAllByTestId("transfer-review-row").map(r => r.textContent);
        expect(rows).toEqual([
            "You loseMint, edit details, transfer or renounce admin.",
            "They getThe same.",
            "Permanent for youOnly the new admin can give it back.",
        ]);
        expect(dialog.getByTestId("transfer-new-admin")).toHaveAttribute("title", OTHER);
        expect(dialog.getByText(/Triple-check the address/)).toBeInTheDocument();
        expect(dialog.getByText("Network fee ≈ 0.020000 TBZE")).toBeInTheDocument();

        await userEvent.click(dialog.getByRole("button", { name: "Transfer admin" }));
        expect(sentMsgs()).toEqual([{
            typeUrl: "/bze.tokenfactory.MsgChangeAdmin",
            value: { creator: OWNER, denom: DENOM, newAdmin: OTHER },
        }]);
        await waitFor(() => expect(refreshAdmins).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(m.toast).toHaveBeenCalledWith("HONEY admin transferred");
    });

    it("Edit goes back to the address", async () => {
        renderSection(props());
        const dialog = await open();
        await userEvent.type(dialog.getByPlaceholderText("bze1…"), OTHER);
        await userEvent.click(dialog.getByRole("button", { name: "Continue" }));
        await userEvent.click(dialog.getByRole("button", { name: /Edit/ }));
        expect(dialog.getByPlaceholderText("bze1…")).toHaveValue(OTHER);
    });

    it("keeps the TxPanel in the dialog when the wallet declines", async () => {
        m.tx.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
            opts.onFailure?.("Request rejected", { stage: "sign" });
            return false;
        });
        const refreshAdmins = vi.fn(async () => {});
        renderSection(props({ refreshAdmins }));
        const dialog = await open();
        await userEvent.type(dialog.getByPlaceholderText("bze1…"), OTHER);
        await userEvent.click(dialog.getByRole("button", { name: "Continue" }));
        await userEvent.click(dialog.getByRole("button", { name: "Transfer admin" }));

        expect(await dialog.findByTestId("tx-panel")).toBeInTheDocument();
        expect(refreshAdmins).not.toHaveBeenCalled();
    });
});

describe("Renounce dialog", () => {
    const open = async () => {
        await userEvent.click(screen.getByRole("button", { name: "Renounce…" }));
        return within(await screen.findByRole("dialog", { name: "Renounce admin of HONEY?" }));
    };

    it("says what is gone, what stays, the fixed supply and the setup facts", async () => {
        renderSection(props());
        const dialog = await open();

        expect(dialog.getByText("This is permanent. There is no undo, not by you, not by BeeZee.")).toBeInTheDocument();
        expect(within(dialog.getByRole("region", { name: "Gone forever" })).getAllByRole("listitem").map(li => li.textContent)).toEqual([
            "Minting more HONEY",
            "Editing name, logo and description",
            "Editing the brand kit",
            "Handing admin to someone else",
        ]);
        expect(within(dialog.getByRole("region", { name: "Stays the same" })).getAllByRole("listitem").map(li => li.textContent)).toEqual([
            "Everyone keeps their HONEY",
            "Pools, markets and rewards keep running",
            "Anyone can still burn HONEY they hold on Burner",
        ]);
        expect(dialog.getByTestId("renounce-supply")).toHaveTextContent("Supply, fixed from now on1,000,000 HONEY");
        expect(dialog.getByTestId("renounce-hint-description")).toHaveTextContent("Your description is empty. Once you renounce it stays empty.");
        expect(dialog.getByTestId("renounce-hint-description")).toHaveAttribute("data-ok", "false");
        expect(dialog.getByTestId("renounce-hint-brandKit")).toHaveTextContent("Brand kit is set.");
        expect(dialog.getByTestId("renounce-hint-registry")).toHaveTextContent("Listed in the Cosmos Chain Registry (not affected).");
        expect(dialog.getByTestId("renounce-network-fee")).toHaveTextContent("Network fee ≈ 0.020000 TBZE");
    });

    it("focuses Keep admin, which closes it without sending anything", async () => {
        // jsdom has no layout, so the dialog's focus logic would see every element as hidden. Give
        // elements a box, as a browser does.
        const rects = vi.spyOn(HTMLElement.prototype, "getClientRects")
            .mockReturnValue([new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList);
        renderSection(props());
        const dialog = await open();

        const keep = dialog.getByRole("button", { name: "Keep admin" });
        await waitFor(() => expect(keep).toHaveFocus());
        rects.mockRestore();
        await userEvent.click(keep);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(m.tx).not.toHaveBeenCalled();
    });

    it("arms only on the exact ticker: wrong case or a partial ticker keep it disabled", async () => {
        renderSection(props());
        const dialog = await open();
        const input = dialog.getByRole("textbox", { name: "Type HONEY to confirm" });
        const renounce = dialog.getByRole("button", { name: "Renounce admin" });

        expect(renounce).toBeDisabled();
        await userEvent.type(input, "honey");
        expect(renounce).toBeDisabled();
        await userEvent.clear(input);
        await userEvent.type(input, "HONE");
        expect(renounce).toBeDisabled();
        await userEvent.type(input, "Y");
        expect(renounce).toBeEnabled();
    });

    it("sends MsgChangeAdmin to '', then closes, refreshes the admin and says so", async () => {
        const refreshAdmins = vi.fn(async () => {});
        renderSection(props({ refreshAdmins }));
        const dialog = await open();

        await userEvent.type(dialog.getByRole("textbox", { name: "Type HONEY to confirm" }), "HONEY");
        await userEvent.click(dialog.getByRole("button", { name: "Renounce admin" }));

        expect(sentMsgs()).toEqual([{
            typeUrl: "/bze.tokenfactory.MsgChangeAdmin",
            value: { creator: OWNER, denom: DENOM, newAdmin: "" },
        }]);
        await waitFor(() => expect(refreshAdmins).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(m.toast).toHaveBeenCalledWith("HONEY admin renounced");
    });

    it("starts empty on every open", async () => {
        renderSection(props());
        let dialog = await open();
        await userEvent.type(dialog.getByRole("textbox", { name: "Type HONEY to confirm" }), "HON");
        await userEvent.click(dialog.getByRole("button", { name: "Keep admin" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        dialog = await open();
        expect(dialog.getByRole("textbox", { name: "Type HONEY to confirm" })).toHaveValue("");
    });
});
