import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import { bze } from "@bze/bzejs";

// The Supply group with the real Turn off minting item and dialog, the real wizard tx hook and
// pending-tx store. The wallet, the wallet side of the tx (useFactoryTx), the raffle lookup, the gas
// estimate and the toast are mocked, so the tests read the msgs handed to the tx.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};

const m = vi.hoisted(() => ({
    tx: vi.fn(),
    toast: vi.fn(),
    address: "" as string | undefined,
}));

const OWNER = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";

vi.mock("next/navigation", () => ({
    usePathname: () => "/tokens/token",
    useSearchParams: () => new URLSearchParams(`denom=factory/${OWNER}/uhoney`),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@/hooks/useTokenRaffle", () => ({ useTokenRaffle: () => ({ raffle: { status: "none" }, refresh: vi.fn() }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useToast: () => ({ toast: { success: m.toast } }),
        useEpochs: () => ({ hourEpochInfo: undefined }),
        getBurnerApp: () => ({ href: "https://burner.test" }),
        useGasFeeEstimate: () => ({ amount: new BigNumber(20000), displayAmount: new BigNumber("0.02"), ticker: "TBZE", denom: "ubze", isNative: true, isLoading: false }),
        getExplorerTxURL: (hash: string) => `https://explorer.example/tx/${hash}`,
    };
});

import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";
import { SupplyGroup } from "./supply-group";

const DENOM = `factory/${OWNER}/uhoney`;
const asset = { denom: DENOM, ticker: "HONEY", name: "Honey", decimals: 6, logo: "", supply: 1000000000n } as unknown as React.ComponentProps<typeof SupplyGroup>["asset"];

type Props = React.ComponentProps<typeof SupplyGroup>;
const props = (over: Partial<Props> = {}): Props => ({
    asset,
    access: "admin",
    back: { href: "/tokens/token", label: "HONEY" } as unknown as Props["back"],
    mintable: true,
    mintableKnown: true,
    supplyDisplay: new BigNumber(1000),
    onMinted: vi.fn(),
    onMintingDisabled: vi.fn(),
    ...over,
});

function renderGroup(p: Props) {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    return render(<SupplyGroup {...p} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <PendingTxProvider store={store}>{children}</PendingTxProvider>
            </ChakraProvider>
        ),
    });
}

beforeEach(() => {
    m.tx.mockReset();
    m.tx.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("ABCDEF0123456789");
        opts.onSuccess?.({ txhash: "ABCDEF0123456789", height: 42, code: 0 });
        return true;
    });
    m.toast.mockReset();
    m.address = OWNER;
});

describe("Supply group: Turn off minting item", () => {
    it("shows for the admin of a mintable token on a v8.3.0 answer", () => {
        renderGroup(props());
        expect(screen.getByTestId("disable-minting-item")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Turn off…" })).toBeInTheDocument();
    });

    it.each([
        ["admin, minting already off", { mintable: false }],
        ["not the admin", { access: "not-admin" as const }],
        ["renounced", { access: "renounced" as const, mintable: false }],
        ["still checking", { access: "checking" as const, mintable: undefined, mintableKnown: false }],
        ["admin query failed", { access: "unknown" as const, mintable: undefined, mintableKnown: false }],
        ["v8.2.0 answer without the mintable field (read as mintable)", { mintable: true, mintableKnown: false }],
    ])("hidden: %s", (_, over) => {
        renderGroup(props(over as Partial<Props>));
        expect(screen.queryByTestId("disable-minting-item")).not.toBeInTheDocument();
    });
});

describe("Turn off minting dialog", () => {
    async function openDialog() {
        const user = userEvent.setup();
        renderGroup(props());
        await user.click(screen.getByRole("button", { name: "Turn off…" }));
        return user;
    }

    it("lists what ends and what stays", async () => {
        await openDialog();
        const ends = within(screen.getByRole("region", { name: "Ends for good" }));
        expect(ends.getByText("Minting more HONEY, by anyone, ever")).toBeInTheDocument();
        const stays = within(screen.getByRole("region", { name: "Stays the same" }));
        expect(stays.getByText("Brand kit")).toBeInTheDocument();
        expect(stays.getByText("Fee settings")).toBeInTheDocument();
    });

    it("arms only on the exact ticker", async () => {
        const user = await openDialog();
        const confirm = screen.getByRole("button", { name: "Turn off minting" });
        expect(confirm).toBeDisabled();
        await user.type(screen.getByPlaceholderText("HONEY"), "honey");
        expect(confirm).toBeDisabled();
        await user.clear(screen.getByPlaceholderText("HONEY"));
        await user.type(screen.getByPlaceholderText("HONEY"), "HONEY");
        expect(confirm).toBeEnabled();
        expect(m.tx).not.toHaveBeenCalled();
    });

    it("signs exactly one MsgDisableMinting with the wallet address and the page denom, then refreshes", async () => {
        const p = props();
        const user = userEvent.setup();
        renderGroup(p);
        await user.click(screen.getByRole("button", { name: "Turn off…" }));
        await user.type(screen.getByPlaceholderText("HONEY"), "HONEY");
        await user.click(screen.getByRole("button", { name: "Turn off minting" }));

        expect(m.tx).toHaveBeenCalledTimes(1);
        const msgs = m.tx.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.tokenfactory.MsgDisableMinting");
        expect(msgs[0].value).toEqual({ creator: OWNER, denom: DENOM });
        await vi.waitFor(() => expect(p.onMintingDisabled).toHaveBeenCalledTimes(1));
        expect(m.toast).toHaveBeenCalled();
    });

    it("a refused tx leaves the state as it was (no refresh)", async () => {
        const p = props();
        m.tx.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
            opts.onFailure?.("minting is disabled for this denom", { stage: "simulate" });
            return false;
        });
        const user = userEvent.setup();
        renderGroup(p);
        await user.click(screen.getByRole("button", { name: "Turn off…" }));
        await user.type(screen.getByPlaceholderText("HONEY"), "HONEY");
        await user.click(screen.getByRole("button", { name: "Turn off minting" }));

        expect(p.onMintingDisabled).not.toHaveBeenCalled();
    });
});

describe("MsgDisableMinting amino (Ledger / amino wallets)", () => {
    it("converts through the bzejs 4.0.0 converters", () => {
        const msg = bze.tokenfactory.MsgDisableMinting.toAminoMsg({ creator: OWNER, denom: DENOM });
        expect(msg).toEqual({ type: "bze/x/tokenfactory/MsgDisableMinting", value: { creator: OWNER, denom: DENOM } });
        expect(bze.tokenfactory.MsgDisableMinting.aminoType).toBe("bze/x/tokenfactory/MsgDisableMinting");
        expect(bze.tokenfactory.MsgDisableMinting.fromAminoMsg(msg)).toEqual({ creator: OWNER, denom: DENOM });
    });
});
