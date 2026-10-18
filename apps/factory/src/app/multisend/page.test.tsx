import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";
import { exampleCsv, loadMultiSendDraft, saveMultiSendDraft } from "@/lib/multisend";
import { loadMultiSendRun, markSending, planBatches, saveMultiSendRun, startRun, listFingerprint } from "@/lib/multisend-run";

// The page runs on mocked hooks: query params, wallet, balances, the affordability check and
// the tx hook. The asset picker becomes a plain button per denom; PayPanel has its own coverage.
const { queryParams, wallet, balances, afford, affordInputs, lookupMock, navigateMock, txMock } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    balances: { current: {} as Record<string, string> },
    afford: { canAfford: true, message: "" },
    affordInputs: [] as unknown[],
    lookupMock: { getTx: vi.fn(), recentMultiSends: vi.fn() },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/lib/multisend-lookup", async (importActual) => ({
    ...(await importActual<typeof import("@/lib/multisend-lookup")>()),
    restTxLookup: () => lookupMock,
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, txKind, footer }: {
        rows: { label: string; coin?: { denom: string; amount: string }; text?: string }[];
        txKind?: unknown;
        footer?: ReactNode;
    }) => (
        <div data-testid="pay-panel">
            <span>{rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}</span>
            <span data-testid="tx-kind">{JSON.stringify(txKind ?? null)}</span>
            {footer}
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, includeLP, ownFirst, onSelect }: {
        label: string; includeLP?: boolean; ownFirst?: boolean; onSelect: (a: { denom: string }) => void;
    }) => (
        <div data-own-first={String(ownFirst)}>
            <span>{label}</span>
            {["utok", "ubze", ...(includeLP ? ["ulp/abc"] : [])].map(d => (
                <button key={d} onClick={() => onSelect({ denom: d })}>{label}: {d}</button>
            ))}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        "ulp/abc": { denom: "ulp/abc", ticker: "TOK/BZE LP", decimals: 12, logo: "" },
    };
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        // `bze1zz…` stands for any number of distinct valid wallets (see `wallets`).
        validateBZEBech32Address: (a: string) => a.startsWith("bze1zz")
            ? { isValid: true, message: "" }
            : actual.validateBZEBech32Address(a),
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: new BN(balances.current[denom] ?? "0") }, isLoading: false }),
        useCanAffordTx: (input: unknown) => (affordInputs.push(input), {
            canAfford: afford.canAfford,
            message: afford.message,
            isLoading: false,
            gasFee: { denom: "ubze", amount: new BN(5000) },
        }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import MultiSendPage from "./page";

const A = "bze13x5v3t9plqu8ql3h44ltx0ys59uzz43lt6p0tz";
const B = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";
const C = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const wallets = (n: number) => Array.from({ length: n }, (_, i) =>
    `bze1zz${BECH32[Math.floor(i / 32)]}${BECH32[i % 32]}`);

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<MultiSendPage />, { wrapper });
const TOKEN = "What do you send?";
const LIST = "Who gets it, and how much?";
const question = (title: string) => screen.getByRole("region", { name: title });
const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));
const sendButton = () => screen.getByRole("button", { name: /^Send to \d+ wallets$/ });
const listInput = () => within(question(LIST)).getByLabelText(/one per line/);

async function pickToken(denom = "utok") {
    await userEvent.click(within(question(TOKEN)).getByText(`Token to send: ${denom}`));
    await continueIn(TOKEN);
}

// userEvent.type reads braces and brackets as keys; paste puts the text in as it is.
async function pasteList(text: string) {
    await userEvent.click(listInput());
    await userEvent.paste(text);
}

type TxOpts = { onBroadcast?: (h: string) => void; onSuccess: (r: unknown) => void };
type MultiSendMsg = { value: { inputs: { coins: { amount: string }[] }[]; outputs: { address: string }[] } };
const sentOutputs = (call: number) => (txMock.mock.calls[call][0] as MultiSendMsg[])[0].value.outputs.map(o => o.address);
const progress = () => screen.getByRole("region", { name: "Sending progress" });
const batchRows = () => within(progress()).getAllByRole("listitem").map(li => li.textContent);

async function longList(n = 250) {
    renderPage();
    await pickToken();
    await userEvent.type(within(question(LIST)).getByLabelText(/Amount each/), "1");
    await pasteList(wallets(n).join("\n"));
    await continueIn(LIST);
}

/** A stored run of the 250-wallet list (1 TOK each) whose first batch is in `status`. */
async function storeRun(change: (run: ReturnType<typeof startRun>) => ReturnType<typeof startRun>) {
    const ready = wallets(250).map(address => ({ address, amount: "1000000" }));
    saveMultiSendDraft({ denom: "utok", mode: "same", sameAmount: "1", text: wallets(250).join("\n") });
    saveMultiSendRun(change(startRun(await listFingerprint("utok", ready), "utok", planBatches(ready))));
}

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    balances.current = { utok: "1000000000", ubze: "1000000000" };
    afford.canAfford = true;
    afford.message = "";
    navigateMock.mockReset();
    affordInputs.length = 0;
    lookupMock.getTx.mockReset().mockResolvedValue(null);
    lookupMock.recentMultiSends.mockReset().mockResolvedValue([]);
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        const hash = `HASH${txMock.mock.calls.length}`;
        opts.onBroadcast?.(hash);
        opts.onSuccess({ txhash: hash });
        return true;
    });
});

describe("Send to a list of wallets (/multisend)", { timeout: 20_000 }, () => {
    it("sends one multi-send with one input equal to the sum of the outputs", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Send to a list of wallets" })).toBeInTheDocument();
        expect(screen.getAllByText("bank · multi-send").length).toBeGreaterThan(0);
        expect(screen.getByText("List saved in this browser")).toBeInTheDocument();
        // LP tokens can be sent too, own tokens listed first.
        expect(screen.getByText("Token to send: ulp/abc")).toBeInTheDocument();
        expect(screen.getByText("Token to send").parentElement).toHaveAttribute("data-own-first", "true");

        await pickToken();
        expect(question(TOKEN)).toHaveTextContent("TOK · you have 1,000");

        await userEvent.click(screen.getByRole("button", { name: "Amount per wallet" }));
        await pasteList(`${A}, 1.5\n${B}, 2\n${A}, 0.5`);
        await continueIn(LIST);
        expect(question(LIST)).toHaveTextContent("2 wallets · 4 TOK");

        expect(screen.getByRole("region", { name: "What will happen" })).toHaveTextContent(
            "4 TOK goes to 2 wallets, each getting the amount on its line.",
        );
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Sent to wallets: 4000000 utok, Factory fee: None");
        expect(screen.getByTestId("tx-kind")).toHaveTextContent('{"kind":"multi-send","count":2}');
        // The gas is paid in BZE here, so only the sent amount leaves the TOK balance.
        expect(screen.getByText("Left in your wallet").nextSibling).toHaveTextContent("996 TOK");

        await userEvent.click(sendButton());
        expect(txMock).toHaveBeenCalledTimes(1);
        const [msgs] = txMock.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend",
            value: {
                inputs: [{ address: "bze1me", coins: [{ denom: "utok", amount: "4000000" }] }],
                outputs: [
                    { address: A, coins: [{ denom: "utok", amount: "2000000" }] },
                    { address: B, coins: [{ denom: "utok", amount: "2000000" }] },
                ],
            },
        }]);

        expect(screen.getByRole("heading", { name: "Sent to 2 wallets" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");
        await userEvent.click(screen.getByRole("button", { name: "Send another list" }));
        expect(question(LIST)).toHaveAttribute("data-state", "active");
        expect(listInput()).toHaveValue("");
    });

    it("same mode sends the amount to every wallet and takes the gas from the same balance", async () => {
        balances.current = { ubze: "1000000000" };
        renderPage();
        await pickToken("ubze");
        await userEvent.type(within(question(LIST)).getByLabelText(/Amount each \(BZE\)/), "3");
        await pasteList(`${A}\n${B}\n${C}`);
        await continueIn(LIST);

        expect(screen.getByRole("region", { name: "What will happen" })).toHaveTextContent(
            "9 BZE goes to 3 wallets, each getting 3 BZE.",
        );
        expect(screen.getByText("Left in your wallet").nextSibling).toHaveTextContent("990.995 BZE");

        await userEvent.click(sendButton());
        const [[msg]] = txMock.mock.calls[0];
        expect(msg.value.inputs).toEqual([{ address: "bze1me", coins: [{ denom: "ubze", amount: "9000000" }] }]);
        expect(msg.value.outputs.map((o: { coins: { amount: string }[] }) => o.coins[0].amount)).toEqual(["3000000", "3000000", "3000000"]);
    });

    it("counts ready wallets, duplicates and lines to fix, and lists the problems", async () => {
        renderPage();
        await pickToken();
        await userEvent.type(within(question(LIST)).getByLabelText(/Amount each/), "1");
        await pasteList(`${A}\n${A}\nosmo108cyg5m3hwnu496xv5mnwkx33lmdvs7e7lptjl\nnot-an-address`);

        const q = question(LIST);
        expect(within(q).getByText("1 wallets ready")).toBeInTheDocument();
        expect(within(q).getByText("1 duplicates, merged into one")).toBeInTheDocument();
        expect(within(q).getByText("2 lines to fix, left out")).toBeInTheDocument();
        const items = within(q).getAllByRole("listitem").map(li => li.textContent);
        expect(items).toEqual([
            "Line 3: osmo108cyg5m3hwnu496xv5mnwkx33lmdvs7e7lptjl osmo1… is not a BeeZee address. Only bze1… addresses work here",
            "Line 4: not-an-address isn't a valid BeeZee address",
        ]);
    });

    it("shows the first 50 problems, then how many more", async () => {
        renderPage();
        await pickToken();
        await pasteList(Array.from({ length: 53 }, (_, i) => `bad${i}`).join("\n"));
        const items = within(question(LIST)).getAllByRole("listitem");
        expect(items).toHaveLength(51);
        expect(items[50]).toHaveTextContent("and 3 more");
    });

    it("sends a long list in transactions of 100, one signature per click, and ends with a report", async () => {
        await longList();
        expect(screen.getByText(/It's sent in 3 transactions of up to 100 wallets each, so you'll approve 3 times in your wallet\. If you stop halfway, the wallets already paid are marked and won't be paid twice\./)).toBeInTheDocument();
        // The network fee covers the three transactions.
        expect(JSON.parse(screen.getByTestId("tx-kind").textContent!)).toEqual([
            { kind: "multi-send", count: 100 }, { kind: "multi-send", count: 100 }, { kind: "multi-send", count: 50 },
        ]);

        await userEvent.click(screen.getByRole("button", { name: "Start sending (3 transactions)" }));
        expect(txMock).toHaveBeenCalledTimes(1);
        expect(sentOutputs(0)).toEqual(wallets(250).slice(0, 100));
        expect((txMock.mock.calls[0][0] as MultiSendMsg[])[0].value.inputs[0].coins[0].amount).toBe("100000000");

        expect(within(progress()).getByText("Transaction 2 of 3")).toBeInTheDocument();
        expect(batchRows()).toEqual([
            "100 wallets · 100 TOKSent ✓",
            "100 wallets · 100 TOKWaiting",
            "50 wallets · 50 TOKWaiting",
        ]);
        const txLink = within(progress()).getByRole("link", { name: "View transaction" });
        expect(txLink).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
        expect(txLink).toHaveAttribute("data-app", "explorer");
        expect(loadMultiSendRun()?.batches.map(b => b.status)).toEqual(["sent", "pending", "pending"]);
        const report = within(progress()).getByRole("link", { name: /Download report \(CSV\)/ });
        const csv = decodeURIComponent(report.getAttribute("href")!.split(",").slice(1).join(","));
        expect(csv.split("\n")[1]).toBe(`${wallets(250)[0]},1,TOK,sent,HASH1`);
        expect(csv.split("\n")[101]).toBe(`${wallets(250)[100]},1,TOK,not sent,`);

        // Never chained: each click signs one transaction.
        await userEvent.click(screen.getByRole("button", { name: "Send the next transaction" }));
        expect(txMock).toHaveBeenCalledTimes(2);
        expect(sentOutputs(1)).toEqual(wallets(250).slice(100, 200));
        await userEvent.click(screen.getByRole("button", { name: "Send the next transaction" }));
        expect(sentOutputs(2)).toEqual(wallets(250).slice(200));

        expect(screen.getByRole("heading", { name: "Sent to 250 wallets in 3 transactions" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Download report \(CSV\)/ })).toHaveAttribute("download", "multisend-report.csv");
        await userEvent.click(screen.getByRole("button", { name: "Send another list" }));
        expect(loadMultiSendRun()).toBeUndefined();
        expect(loadMultiSendDraft()).toEqual({ denom: "utok", mode: "same", sameAmount: "", text: "" });
        expect(listInput()).toHaveValue("");
    });

    it("checks the balance again before every transaction", async () => {
        await longList();
        // Before the run: the whole list.
        expect(affordInputs.at(-1)).toEqual({
            spec: [{ kind: "multi-send", count: 100 }, { kind: "multi-send", count: 100 }, { kind: "multi-send", count: 50 }],
            spend: { denom: "utok", amount: "250000000" },
        });
        await userEvent.click(screen.getByRole("button", { name: "Start sending (3 transactions)" }));
        await userEvent.click(screen.getByRole("button", { name: "Send the next transaction" }));
        // Then the next batch only.
        expect(affordInputs.at(-1)).toEqual({ spec: { kind: "multi-send", count: 50 }, spend: { denom: "utok", amount: "50000000" } });

        afford.canAfford = false;
        afford.message = "Insufficient TOK balance (5 TOK short)";
        await userEvent.click(screen.getByRole("button", { name: "Stop for now" }));
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByRole("button", { name: "Send the next transaction" })).toBeDisabled();
        expect(within(progress()).getByText("Insufficient TOK balance (5 TOK short)")).toBeInTheDocument();
    });

    it("a rejection in the wallet puts the batch back to waiting", async () => {
        txMock.mockImplementation(async () => false);
        await longList();
        await userEvent.click(screen.getByRole("button", { name: "Start sending (3 transactions)" }));
        expect(batchRows()[0]).toBe("100 wallets · 100 TOKWaiting");
        expect(loadMultiSendRun()?.batches[0]).toEqual({ id: 1, count: 100, total: "100000000", status: "pending" });
        await userEvent.click(screen.getByRole("button", { name: "Send the next transaction" }));
        expect(sentOutputs(1)).toEqual(wallets(250).slice(0, 100));
    });

    it("an unclear result is looked up by hash before anything else, and found", async () => {
        txMock.mockImplementationOnce(async (_m: unknown, opts: TxOpts) => {
            opts.onBroadcast?.("H1");
            return false; // e.g. the confirmation timed out
        });
        lookupMock.getTx.mockResolvedValue({ txhash: "H1", code: 0, multiSends: [] });
        await longList();
        await userEvent.click(screen.getByRole("button", { name: "Start sending (3 transactions)" }));

        await waitFor(() => expect(batchRows()[0]).toBe("100 wallets · 100 TOKSent ✓"));
        expect(lookupMock.getTx).toHaveBeenCalledWith("H1");
        expect(loadMultiSendRun()?.batches[0]).toMatchObject({ status: "sent", txHash: "H1" });
        expect(txMock).toHaveBeenCalledTimes(1);
    });

    it("an unclear batch that can't be found is only sent again on an explicit click", async () => {
        let finishLookup: (v: null) => void = () => {};
        txMock.mockImplementationOnce(async (_m: unknown, opts: TxOpts) => {
            opts.onBroadcast?.("H1");
            return false;
        });
        lookupMock.getTx.mockImplementation(() => new Promise(res => { finishLookup = res; }));
        await longList();
        await userEvent.click(screen.getByRole("button", { name: "Start sending (3 transactions)" }));
        expect(batchRows()[0]).toBe("100 wallets · 100 TOKChecking…");

        // While it is being checked, the next transaction is the second batch, never the first again.
        await userEvent.click(screen.getByRole("button", { name: "Send the next transaction" }));
        expect(sentOutputs(1)).toEqual(wallets(250).slice(100, 200));

        finishLookup(null);
        await waitFor(() => expect(batchRows()[0]).toBe("100 wallets · 100 TOKNot found"));
        expect(lookupMock.recentMultiSends).toHaveBeenCalledWith("bze1me");
        expect(within(progress()).getByText(/We couldn't find this transaction on the chain\. Send it again only if your wallet shows it failed\./)).toBeInTheDocument();
        expect(txMock).toHaveBeenCalledTimes(2);

        await userEvent.click(screen.getByRole("button", { name: "Send this one again" }));
        expect(txMock).toHaveBeenCalledTimes(3);
        expect(sentOutputs(2)).toEqual(wallets(250).slice(0, 100));
        expect(batchRows()[0]).toBe("100 wallets · 100 TOKSent ✓");
    });

    it("a node error leaves the batch unclear with a way to check again", async () => {
        txMock.mockImplementationOnce(async (_m: unknown, opts: TxOpts) => {
            opts.onBroadcast?.("H1");
            return false;
        });
        lookupMock.getTx.mockRejectedValueOnce(new Error("502")).mockResolvedValue({ txhash: "H1", code: 0, multiSends: [] });
        await longList();
        await userEvent.click(screen.getByRole("button", { name: "Start sending (3 transactions)" }));
        await waitFor(() => expect(batchRows()[0]).toBe("100 wallets · 100 TOKCouldn't checkCheck again"));
        expect(screen.queryByRole("button", { name: "Send this one again" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Check again" }));
        await waitFor(() => expect(batchRows()[0]).toBe("100 wallets · 100 TOKSent ✓"));
    });

    it("resumes a stored run where it left off", async () => {
        await storeRun(run => ({ ...run, batches: run.batches.map(b => b.id === 1 ? { ...b, status: "sent", txHash: "OLD" } : b) }));
        renderPage();
        expect(await screen.findByText("1 of 3 transactions sent. Continue where you left off.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Send the next transaction" })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        await userEvent.click(screen.getByRole("button", { name: "Send the next transaction" }));
        expect(sentOutputs(0)).toEqual(wallets(250).slice(100, 200));
    });

    it("a batch left sending when the page closed is checked on load (sender search)", async () => {
        await storeRun(run => markSending(run, 1, "bze1old"));
        const ready = wallets(100).map(address => ({ address, coins: [{ denom: "utok", amount: "1000000" }] }));
        lookupMock.recentMultiSends.mockResolvedValue([{ txhash: "FOUND", code: 0, multiSends: [ready] }]);
        renderPage();
        await waitFor(() => expect(batchRows()[0]).toBe("100 wallets · 100 TOKSent ✓"));
        expect(lookupMock.recentMultiSends).toHaveBeenCalledWith("bze1old");
        expect(lookupMock.getTx).not.toHaveBeenCalled();
        expect(loadMultiSendRun()?.batches[0]).toMatchObject({ status: "sent", txHash: "FOUND" });
    });

    it("an edited list needs a confirmation before a new run", async () => {
        await storeRun(run => ({ ...run, batches: run.batches.map(b => b.id === 1 ? { ...b, status: "sent", txHash: "OLD" } : b) }));
        renderPage();
        await screen.findByText(/1 of 3 transactions sent/);

        await userEvent.click(within(question(LIST)).getByRole("button", { name: /^Change/ }));
        await pasteList(`\n${A}`);
        await continueIn(LIST);
        expect(await screen.findByText(/This list changed since your last run\./)).toBeInTheDocument();
        expect(screen.getByText(/Start a new run\? Wallets from the old run may be paid again\./)).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Sending progress" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Start sending (3 transactions)" })).toBeDisabled();

        await userEvent.click(screen.getByRole("button", { name: "Start new run" }));
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(loadMultiSendRun()).toBeDefined();
        await userEvent.click(screen.getByRole("button", { name: "Start new run" }));
        await userEvent.click(screen.getByRole("button", { name: "Yes, forget the old run" }));
        expect(loadMultiSendRun()).toBeUndefined();
        expect(screen.getByRole("button", { name: "Start sending (3 transactions)" })).toBeEnabled();
    });

    it("an upload fills the list", async () => {
        renderPage();
        await pickToken();
        const file = new File([`${A}\n${B}\n`], "winners.csv", { type: "text/csv" });
        await userEvent.upload(screen.getByTestId("list-file"), file);
        await waitFor(() => expect(listInput()).toHaveValue(`${A}\n${B}\n`));
    });

    it("refuses files over 1 MB and other file types", async () => {
        renderPage();
        await pickToken();
        const big = new File(["x".repeat(1024 * 1024 + 1)], "big.csv", { type: "text/csv" });
        await userEvent.upload(screen.getByTestId("list-file"), big);
        expect(screen.getByRole("alert")).toHaveTextContent("Files are limited to 1 MB.");

        const other = new File(["{}"], "list.json", { type: "text/csv" });
        await userEvent.upload(screen.getByTestId("list-file"), other, { applyAccept: false });
        expect(screen.getByRole("alert")).toHaveTextContent("Upload a .csv or .txt file.");
        expect(listInput()).toHaveValue("");
    });

    it("offers an example file per mode", async () => {
        renderPage();
        await pickToken();
        const link = () => within(question(LIST)).getByRole("link", { name: /Download an example file/ });
        expect(decodeURIComponent(link().getAttribute("href")!.split(",")[1])).toBe(exampleCsv("same"));
        expect(link()).toHaveAttribute("download", "wallets-example.csv");

        await userEvent.click(screen.getByRole("button", { name: "Amount per wallet" }));
        expect(decodeURIComponent(link().getAttribute("href")!.split(",")[1])).toBe(exampleCsv("perWallet"));
        expect(exampleCsv("perWallet")).toContain("address,amount");
    });

    it("saves the draft, restores it on load and clears it after sending", async () => {
        const first = renderPage();
        await pickToken();
        await userEvent.click(screen.getByRole("button", { name: "Amount per wallet" }));
        await pasteList(`${A}, 5`);
        expect(loadMultiSendDraft()).toEqual({ denom: "utok", mode: "perWallet", sameAmount: "", text: `${A}, 5` });
        first.unmount();

        renderPage();
        expect(question(TOKEN)).toHaveAttribute("data-state", "done");
        expect(listInput()).toHaveValue(`${A}, 5`);
        expect(screen.getByRole("button", { name: "Amount per wallet" })).toHaveAttribute("aria-pressed", "true");
        await continueIn(LIST);
        await userEvent.click(sendButton());
        expect(loadMultiSendDraft()).toBeUndefined();
    });

    it("a ?denom= link wins over the draft's token", () => {
        saveMultiSendDraft({ denom: "ubze", mode: "same", sameAmount: "1", text: A });
        queryParams.current = new URLSearchParams("denom=utok");
        renderPage();
        expect(question(TOKEN)).toHaveTextContent("TOK · you have");
        expect(question(TOKEN)).not.toHaveTextContent("BZE");
    });

    it("without a wallet the send button is off and says why", async () => {
        wallet.address = undefined;
        renderPage();
        await pickToken();
        await userEvent.type(within(question(LIST)).getByLabelText(/Amount each/), "1");
        await pasteList(A);
        await continueIn(LIST);
        expect(sendButton()).toBeDisabled();
        expect(screen.getByText("Connect your wallet to send.")).toBeInTheDocument();
    });

    it("a list the wallet can't afford is not sent", async () => {
        afford.canAfford = false;
        afford.message = "Insufficient TOK balance (5 TOK short)";
        renderPage();
        await pickToken();
        await userEvent.type(within(question(LIST)).getByLabelText(/Amount each/), "1");
        await pasteList(A);
        await continueIn(LIST);
        expect(sendButton()).toBeDisabled();
        expect(screen.getByText("Insufficient TOK balance (5 TOK short)")).toBeInTheDocument();
    });

    it("an empty list can't continue", async () => {
        renderPage();
        await pickToken();
        await userEvent.type(within(question(LIST)).getByLabelText(/Amount each/), "1");
        expect(within(question(LIST)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(sendButton()).toHaveTextContent("Send to 0 wallets");
        expect(sendButton()).toBeDisabled();
    });
});
