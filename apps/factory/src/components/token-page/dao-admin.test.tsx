import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Dao, DaoControllerResponse } from "@bze/bze-ui-kit";

// DAO admins (BFE-387) on the token page's Permissions section and its Transfer admin dialog. The
// x/dao queries are mocked (BFE-369's functions); the dialog, the wizard tx hook and the lookup hooks are real.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
};

const m = vi.hoisted(() => ({
    tx: vi.fn(),
    supported: vi.fn(),
    byAddress: vi.fn(),
    controller: vi.fn(),
}));

const OWNER = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";
const DAO_ADDRESS = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";
const PLAIN = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

vi.mock("next/navigation", () => ({
    usePathname: () => "/tokens/token",
    useSearchParams: () => new URLSearchParams(`denom=factory/${OWNER}/uhoney`),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: OWNER }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => ({ items: [], isLoading: false }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useToast: () => ({ toast: { success: vi.fn() } }),
        useAssets: () => ({ assets: [{ denom: `factory/${OWNER}/uhoney`, ticker: "HONEY" }] }),
        useGasFeeEstimate: () => ({ amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "TBZE", denom: "ubze", isNative: true, isLoading: false }),
        isDaoModuleSupported: m.supported,
        getDaoByAddress: m.byAddress,
        getDaoController: m.controller,
    };
});

import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";
import { PermissionsSection, type PermissionsSectionProps } from "./permissions-section";
import { TransferAdminDialog } from "./transfer-admin-dialog";

const DENOM = `factory/${OWNER}/uhoney`;
const asset = { denom: DENOM, ticker: "HONEY", name: "Honey", decimals: 6, logo: "", supply: 1000000000n } as unknown as PermissionsSectionProps["asset"];

const dao = (over: Partial<Dao> = {}): Dao => ({
    id: "7",
    address: DAO_ADDRESS,
    admin: DAO_ADDRESS,
    pending_admin: "",
    type: "DAO_TYPE_STATIC_LIST",
    name: "Honey Guild",
    description: "",
    members: [],
    electorate: null,
    created_at: "0",
    admin_seq: "0",
    pending_admin_seq: "0",
    ...over,
} as unknown as Dao);

const controller = (over: Partial<DaoControllerResponse>): DaoControllerResponse => ({ controller: DAO_ADDRESS, end_reason: "SELF_OWNED", path: [DAO_ADDRESS], ...over });

function wrap({ children }: { children: ReactNode }) {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    return (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
}

beforeEach(() => {
    localStorage.clear();
    m.tx.mockReset();
    m.tx.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("ABCDEF0123456789");
        opts.onSuccess?.({ txhash: "ABCDEF0123456789", height: 42, code: 0 });
        return true;
    });
    m.supported.mockReset().mockResolvedValue(true);
    m.byAddress.mockReset().mockResolvedValue(null);
    m.controller.mockReset().mockResolvedValue(controller({}));
});

describe("Permissions section with a DAO admin", () => {
    const renderSection = (daoAdmin?: Dao) => render(
        <PermissionsSection
            asset={asset}
            isChecking={false}
            admin={DAO_ADDRESS}
            daoAdmin={daoAdmin}
            adminState="not-admin"
            supplyDisplay={new BigNumber(1000)}
            refreshAdmins={vi.fn(async () => {})}
        />,
        { wrapper: wrap },
    );

    it("a static-list DAO: its name and id, who votes, and the way to its page", () => {
        renderSection(dao());
        expect(screen.getByTestId("permissions-status")).toHaveTextContent("Admin: DAO Honey Guild (#7)");
        expect(screen.getByTestId("dao-admin-type")).toHaveTextContent("Voted by its members");
        expect(screen.getByRole("link", { name: "Open the DAO" })).toHaveAttribute("href", "https://dao.getbze.com/dao/7");
        expect(screen.queryByTestId("transfer-admin-item")).not.toBeInTheDocument();
    });

    it("a stake DAO names the staked token", () => {
        renderSection(dao({ type: "DAO_TYPE_STAKE", electorate: { sr_ids: [], dr_denom: DENOM } }));
        expect(screen.getByTestId("dao-admin-type")).toHaveTextContent("Voted by the stakers of HONEY");
    });

    it("a stake DAO of staking rewards only says so", () => {
        renderSection(dao({ type: "DAO_TYPE_STAKE", electorate: { sr_ids: ["1"], dr_denom: "" } }));
        expect(screen.getByTestId("dao-admin-type")).toHaveTextContent("Voted by the stakers of its staking rewards");
    });

    it("without a DAO (plain address, 501 node, failed lookup) it stays the address line", () => {
        renderSection(undefined);
        expect(screen.getByTestId("permissions-status")).toHaveTextContent(/^Admin: bze1sx/);
        expect(screen.queryByTestId("dao-admin-details")).not.toBeInTheDocument();
        expect(screen.queryByText("Open the DAO")).not.toBeInTheDocument();
    });
});

describe("Transfer admin dialog and DAOs", () => {
    const renderDialog = (initialAddress?: string) => render(
        <TransferAdminDialog asset={asset} open onClose={vi.fn()} onTransferred={vi.fn()} initialAddress={initialAddress} />,
        { wrapper: wrap },
    );
    const dialog = async () => within(await screen.findByRole("dialog", { name: "Transfer admin of HONEY" }));
    const enter = async (d: ReturnType<typeof within>, address: string) => {
        await userEvent.type(d.getByPlaceholderText("bze1…"), address);
    };
    const sentMsgs = () => m.tx.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

    it("a DAO address shows its name, id, type and controller, then the extra review line; still one MsgChangeAdmin", async () => {
        m.byAddress.mockResolvedValue(dao());
        renderDialog();
        const d = await dialog();
        await enter(d, DAO_ADDRESS);

        expect(await d.findByTestId("dao-admin-summary")).toHaveTextContent("DAO Honey Guild (#7)");
        expect(d.getByTestId("dao-admin-type")).toHaveTextContent("Voted by its members");
        expect(await d.findByTestId("dao-admin-controller")).toHaveTextContent("Controlled by its voters");
        expect(d.queryByTestId("dao-address-hint")).not.toBeInTheDocument();
        expect(m.byAddress).toHaveBeenCalledWith(DAO_ADDRESS);
        expect(m.controller).toHaveBeenCalledWith("7");

        await userEvent.click(d.getByRole("button", { name: "Continue" }));
        expect(d.getByTestId("dao-handover-note")).toHaveTextContent("From now on, changes to HONEY need this DAO: a proposal its voters pass, or its admin.");

        await userEvent.click(d.getByRole("button", { name: "Transfer admin" }));
        expect(sentMsgs()).toEqual([{
            typeUrl: "/bze.tokenfactory.MsgChangeAdmin",
            value: { creator: OWNER, denom: DENOM, newAdmin: DAO_ADDRESS },
        }]);
    });

    it.each([
        ["SELF_OWNED", DAO_ADDRESS, "Controlled by its voters"],
        ["ACCOUNT", PLAIN, "Controlled by bze1z3…qwg3l"],
        ["CYCLE", PLAIN, "Controlled by DAO bze1z3…qwg3l (its admins form a loop)"],
        ["DEPTH_CAP", PLAIN, "Controlled through a chain of more than 16 DAOs"],
    ] as const)("controller end reason %s", async (end_reason, who, line) => {
        m.byAddress.mockResolvedValue(dao());
        m.controller.mockResolvedValue(controller({ end_reason, controller: who }));
        renderDialog(DAO_ADDRESS);
        const d = await dialog();
        expect(await d.findByTestId("dao-admin-controller")).toHaveTextContent(line);
    });

    it("a failed controller lookup just omits the line", async () => {
        m.byAddress.mockResolvedValue(dao());
        m.controller.mockRejectedValue(new Error("boom"));
        renderDialog(DAO_ADDRESS);
        const d = await dialog();
        expect(await d.findByTestId("dao-admin-summary")).toBeInTheDocument();
        await waitFor(() => expect(m.controller).toHaveBeenCalled());
        expect(d.queryByTestId("dao-admin-controller")).not.toBeInTheDocument();
    });

    it("a prefilled address starts at the lookup", async () => {
        m.byAddress.mockResolvedValue(dao());
        renderDialog(DAO_ADDRESS);
        const d = await dialog();
        expect(d.getByPlaceholderText("bze1…")).toHaveValue(DAO_ADDRESS);
        expect(await d.findByTestId("dao-admin-summary")).toHaveTextContent("Honey Guild");
    });

    it("a plain address keeps the old flow, with the hint to paste a DAO's address", async () => {
        renderDialog();
        const d = await dialog();
        expect(await d.findByTestId("dao-address-hint")).toHaveTextContent("Hand HONEY to a DAO: paste the DAO's address.");
        const create = d.getByTestId("create-dao-link");
        expect(create).toHaveTextContent("Create a DAO for HONEY");
        expect(create.getAttribute("href")).toContain(`/dao/new?denom=${encodeURIComponent(DENOM)}`);
        await enter(d, PLAIN);
        await waitFor(() => expect(m.byAddress).toHaveBeenCalledWith(PLAIN));
        expect(d.queryByTestId("dao-admin-summary")).not.toBeInTheDocument();

        await userEvent.click(d.getByRole("button", { name: "Continue" }));
        expect(d.queryByTestId("dao-handover-note")).not.toBeInTheDocument();
        await userEvent.click(d.getByRole("button", { name: "Transfer admin" }));
        expect(sentMsgs()[0].value).toEqual({ creator: OWNER, denom: DENOM, newAdmin: PLAIN });
    });

    it("a v8.2.0 node (x/dao answers 501): no DAO wording, no lookup, the old flow", async () => {
        m.supported.mockResolvedValue(false);
        renderDialog();
        const d = await dialog();
        await enter(d, PLAIN);
        await waitFor(() => expect(m.supported).toHaveBeenCalled());
        expect(d.queryByTestId("dao-address-hint")).not.toBeInTheDocument();
        expect(m.byAddress).not.toHaveBeenCalled();

        await userEvent.click(d.getByRole("button", { name: "Continue" }));
        await userEvent.click(d.getByRole("button", { name: "Transfer admin" }));
        expect(sentMsgs()[0].value).toEqual({ creator: OWNER, denom: DENOM, newAdmin: PLAIN });
    });

    it("a failed lookup never blocks the transfer", async () => {
        m.byAddress.mockRejectedValue(new Error("network"));
        renderDialog();
        const d = await dialog();
        await enter(d, DAO_ADDRESS);
        await waitFor(() => expect(m.byAddress).toHaveBeenCalled());
        await userEvent.click(d.getByRole("button", { name: "Continue" }));
        expect(d.queryByTestId("dao-handover-note")).not.toBeInTheDocument();
        await userEvent.click(d.getByRole("button", { name: "Transfer admin" }));
        expect(sentMsgs()[0].value).toEqual({ creator: OWNER, denom: DENOM, newAdmin: DAO_ADDRESS });
    });
});
