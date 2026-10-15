import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The Control tab with the real lock dialog and hand-over card: the wallet, the tx layer, the
// setup checklist and the query string are mocked, so the tests read the msgs handed to the tx.
// jsdom has no PointerEvent; the Chakra checkbox (zag) constructs one on blur.
if (!("PointerEvent" in window)) {
    Object.defineProperty(window, "PointerEvent", { value: class PointerEvent extends MouseEvent {}, writable: true });
}

const m = vi.hoisted(() => ({
    tx: vi.fn(),
    toast: vi.fn(),
    query: {} as Record<string, string | undefined>,
    setupItems: [] as { key: string; title: string; state: string }[],
}));

const OWNER = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";
const OTHER = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: OWNER }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => ({ items: m.setupItems, isLoading: false }) }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigationWithParams: () => ({ getQueryParam: (k: string) => m.query[k] ?? null }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return { ...actual, useToast: () => ({ toast: { success: m.toast } }) };
});

import { ControlTab } from "./control-tab";
import type { WorkspaceTabProps } from "./types";

const DENOM = `factory/${OWNER}/uhoney`;
const asset = { denom: DENOM, ticker: "HONEY", name: "Honey", decimals: 6, logo: "", supply: 1000000000n } as unknown as WorkspaceTabProps["asset"];

const props = (over: Partial<WorkspaceTabProps> = {}): WorkspaceTabProps => ({
    asset,
    admin: OWNER,
    adminState: "admin",
    supplyDisplay: new BigNumber(1000),
    supply: "1000000000",
    isSupplyLoading: false,
    balanceDisplay: new BigNumber(2),
    refreshSupply: vi.fn(),
    refreshAdmins: vi.fn(async () => {}),
    goTo: vi.fn(),
    ...over,
});

const renderTab = (p: WorkspaceTabProps) => render(
    <ChakraProvider value={defaultSystem}>
        <ControlTab {...p} />
    </ChakraProvider>,
);

const openDialog = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Lock HONEY forever…" }));
    return within(await screen.findByRole("dialog", { name: "Lock HONEY forever?" }));
};

beforeEach(() => {
    m.tx.mockReset();
    m.tx.mockImplementation(async (_msgs, opts) => { opts?.onSuccess?.({}); return true; });
    m.toast.mockReset();
    m.query = {};
    m.setupItems = [
        { key: "created", title: "Token created", state: "done" },
        { key: "description", title: "Description", state: "done" },
        { key: "brandKit", title: "Brand kit", state: "done" },
        { key: "pool", title: "Liquidity pool", state: "todo" },
    ];
});

describe("ControlTab intro", () => {
    it("says what control means and how buyers see it", () => {
        renderTab(props());
        expect(screen.getByText("Who controls HONEY")).toBeInTheDocument();
        expect(screen.getByText(/Buyers see HONEY as/)).toHaveTextContent(
            "Buyers see HONEY as Mintable while someone has control, and Fixed supply once it is locked.",
        );
    });
});

describe("Lock dialog", () => {
    it("arms the lock only with the box ticked and the exact ticker typed", async () => {
        renderTab(props());
        const dialog = await openDialog();
        const lock = dialog.getByRole("button", { name: "Lock HONEY forever" });
        expect(lock).toBeDisabled();

        await userEvent.type(dialog.getByPlaceholderText("HONEY"), "honey");
        expect(lock).toBeDisabled();
        await userEvent.click(dialog.getByRole("checkbox"));
        expect(lock).toBeDisabled();

        await userEvent.clear(dialog.getByPlaceholderText("HONEY"));
        await userEvent.type(dialog.getByPlaceholderText("HONEY"), "HONEY");
        expect(lock).toBeEnabled();

        await userEvent.click(dialog.getByRole("checkbox"));
        expect(lock).toBeDisabled();
    });

    it("shows the frozen and still-working lists", async () => {
        renderTab(props());
        const dialog = await openDialog();
        expect(dialog.getByText("Last step of your launch · optional")).toBeInTheDocument();
        expect(dialog.getByText("Minting more HONEY")).toBeInTheDocument();
        expect(dialog.getByText("Handing control to someone else")).toBeInTheDocument();
        expect(dialog.getByText("Anyone burning their own HONEY")).toBeInTheDocument();
        expect(dialog.getByText("Getting listed in the registry")).toBeInTheDocument();
    });

    it("checklist: all green when the setup is done", async () => {
        renderTab(props());
        const dialog = await openDialog();
        expect(dialog.getByTestId("prelock-description")).toHaveAttribute("data-ok", "true");
        expect(dialog.getByTestId("prelock-description")).toHaveTextContent("Name and description are final");
        expect(dialog.getByTestId("prelock-brandKit")).toHaveAttribute("data-ok", "true");
        expect(dialog.getByTestId("prelock-supply")).toHaveTextContent("Supply is what you want: 1,000 HONEY");
        expect(dialog.queryByTestId("prelock-pool")).not.toBeInTheDocument();
        expect(dialog.queryByTestId("prelock-warning")).not.toBeInTheDocument();
    });

    it("checklist: orange items warn but don't block, unaffected items are labelled", async () => {
        m.setupItems = [
            { key: "description", title: "Description", state: "todo" },
            { key: "brandKit", title: "Brand kit", state: "unknown" },
            { key: "registry", title: "Logo in every wallet", state: "todo" },
        ];
        renderTab(props());
        const dialog = await openDialog();
        expect(dialog.getByTestId("prelock-description")).toHaveAttribute("data-ok", "false");
        expect(dialog.getByTestId("prelock-brandKit")).toHaveAttribute("data-ok", "false");
        expect(dialog.getByTestId("prelock-registry")).toHaveTextContent("Logo in every wallet (not affected by the lock)");
        expect(dialog.getByTestId("prelock-warning")).toHaveTextContent("Brand kit and description can't be added after locking.");

        await userEvent.click(dialog.getByRole("checkbox"));
        await userEvent.type(dialog.getByPlaceholderText("HONEY"), "HONEY");
        expect(dialog.getByRole("button", { name: "Lock HONEY forever" })).toBeEnabled();
    });

    it("an orange unaffected item alone doesn't show the frozen warning", async () => {
        m.setupItems = [
            { key: "description", title: "Description", state: "done" },
            { key: "brandKit", title: "Brand kit", state: "done" },
            { key: "registry", title: "Logo in every wallet", state: "todo" },
        ];
        renderTab(props());
        const dialog = await openDialog();
        expect(dialog.getByTestId("prelock-registry")).toHaveAttribute("data-ok", "false");
        expect(dialog.queryByTestId("prelock-warning")).not.toBeInTheDocument();
    });

    it("signs MsgChangeAdmin with an empty new admin, then closes, refreshes and toasts", async () => {
        const p = props();
        renderTab(p);
        const dialog = await openDialog();
        await userEvent.click(dialog.getByRole("checkbox"));
        await userEvent.type(dialog.getByPlaceholderText("HONEY"), "HONEY");
        await userEvent.click(dialog.getByRole("button", { name: "Lock HONEY forever" }));

        const [msgs] = m.tx.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.tokenfactory.MsgChangeAdmin");
        expect(msgs[0].value).toEqual({ creator: OWNER, denom: DENOM, newAdmin: "" });
        expect(p.refreshAdmins).toHaveBeenCalledTimes(1);
        expect(m.toast).toHaveBeenCalledWith("HONEY is locked forever");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("keeps the dialog open when the tx fails", async () => {
        m.tx.mockResolvedValue(false);
        const p = props();
        renderTab(p);
        const dialog = await openDialog();
        await userEvent.click(dialog.getByRole("checkbox"));
        await userEvent.type(dialog.getByPlaceholderText("HONEY"), "HONEY");
        await userEvent.click(dialog.getByRole("button", { name: "Lock HONEY forever" }));
        expect(p.refreshAdmins).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("Not now closes it and starts empty next time", async () => {
        renderTab(props());
        let dialog = await openDialog();
        await userEvent.type(dialog.getByPlaceholderText("HONEY"), "HON");
        await userEvent.click(dialog.getByRole("button", { name: "Not now, keep control" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        dialog = await openDialog();
        expect(dialog.getByPlaceholderText("HONEY")).toHaveValue("");
    });

    it("?lock=1 opens the dialog for the admin and closing drops the param", async () => {
        m.query.lock = "1";
        const p = props();
        renderTab(p);
        const dialog = within(await screen.findByRole("dialog", { name: "Lock HONEY forever?" }));
        await userEvent.click(dialog.getByRole("button", { name: "Not now, keep control" }));
        expect(p.goTo).toHaveBeenCalledWith(`/manage/token?denom=${encodeURIComponent(DENOM)}&tab=control`);
    });

    it.each([
        ["not-admin", OTHER],
        ["renounced", ""],
        ["unknown", undefined],
    ] as const)("?lock=1 is ignored for %s", (adminState, admin) => {
        m.query.lock = "1";
        renderTab(props({ adminState, admin }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Lock HONEY forever…" })).not.toBeInTheDocument();
    });
});

describe("Hand over control", () => {
    const card = () => within(screen.getByRole("region", { name: "Hand over control" }));

    it.each([
        ["", "Recipient address is required."],
        ["bze1nope", undefined],
        [OWNER, "That is your own address — it already controls the token."],
    ])("rejects %j", async (value, message) => {
        renderTab(props());
        const input = card().getByPlaceholderText("bze1…");
        if (value) await userEvent.type(input, value);
        await userEvent.click(input);
        await userEvent.tab();
        expect(card().getByRole("button", { name: "Hand over control" })).toBeDisabled();
        expect(input).toHaveAttribute("aria-invalid", "true");
        if (message) expect(card().getByText(message)).toBeInTheDocument();
    });

    it("signs MsgChangeAdmin to the new address, then refreshes the admins", async () => {
        const p = props();
        renderTab(p);
        await userEvent.type(card().getByPlaceholderText("bze1…"), `  ${OTHER} `);
        await userEvent.click(card().getByRole("button", { name: "Hand over control" }));
        const [msgs] = m.tx.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.tokenfactory.MsgChangeAdmin");
        expect(msgs[0].value).toEqual({ creator: OWNER, denom: DENOM, newAdmin: OTHER });
        expect(p.refreshAdmins).toHaveBeenCalledTimes(1);
    });

    it("warns that you lose all control", () => {
        renderTab(props());
        expect(card().getByText("You lose all control")).toBeInTheDocument();
    });
});

describe("ControlTab states", () => {
    it("locked: a calm success card with what still works", () => {
        renderTab(props({ adminState: "renounced", admin: "" }));
        const locked = screen.getByTestId("control-locked");
        expect(locked).toHaveTextContent("Supply provably fixed");
        expect(locked).toHaveTextContent("Nobody can ever mint, edit or brand HONEY again.");
        expect(locked).toHaveTextContent("Trading, pools and markets");
        expect(screen.queryByRole("region", { name: "Hand over control" })).not.toBeInTheDocument();
    });

    it("not admin: who controls the token now", () => {
        renderTab(props({ adminState: "not-admin", admin: OTHER }));
        expect(screen.getByTestId("control-not-admin")).toHaveTextContent(`${OTHER} controls HONEY now.`);
        expect(screen.queryByRole("region", { name: "Lock the supply" })).not.toBeInTheDocument();
    });

    it("unknown: Retry reloads the admins", async () => {
        const p = props({ adminState: "unknown", admin: undefined });
        renderTab(p);
        expect(screen.getByTestId("control-unknown")).toHaveTextContent("Couldn't load who controls HONEY.");
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(p.refreshAdmins).toHaveBeenCalled();
    });
});
