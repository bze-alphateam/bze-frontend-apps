import React from "react";
import {describe, expect, it, vi} from "vitest";
import {screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {Asset} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import {MSG, ScanError, type ScanTx, type ScanTxTransfer} from "@/lib/token-activity";
import {renderWithScan, scanClient} from "@/test-support/scan";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const TMS = "factory/bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263/utms";
const CTR = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/uctr";
const SIGNER = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const DEX = "bze18mhtjwczlzqqgvw84uz8lrdv4hqule3jp8allp";
const HASH = "EDA31BBD24F96E51707CCC623670317FDE5AE23DC5F9EEB46E8B224AB159B3C0";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAssets: () => ({denomTicker: (denom: string) => denom, denomDecimals: () => 6}),
}));

let hash = HASH;
vi.mock("next/navigation", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/navigation")>()),
    useSearchParams: () => new URLSearchParams({denom: NOAD, hash}),
}));

const open = vi.fn();
vi.mock("@/hooks/token-site/useTokenWallet", () => ({useTokenWallet: () => ({open})}));

vi.mock("./inner-site", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./inner-site")>()),
    InnerSite: ({children}: { children: (asset: Asset) => React.ReactNode }) => <>{children(ASSET)}</>,
}));

import {TxPage} from "./tx-page";

forbidNetwork();

const ASSET: Asset = {type: "factory", denom: NOAD, decimals: 6, name: "NoAdminToken", ticker: "NOAD", logo: "", stable: false, verified: false};

const SYMBOLS: Record<string, string> = {[NOAD]: "NOAD", [TMS]: "TMS", [CTR]: "CTR", ubze: "BZE"};
const mod = (name: string) => ({name, kind: "module"});
const leg = (seq: number, msg_index: number | null, sender: string, recipient: string, label: ScanTxTransfer["recipient_label"], denom: string, amount: string): ScanTxTransfer =>
    ({seq, msg_index, kind: "transfer", sender, sender_label: null, recipient, recipient_label: label, denom, amount, symbol: SYMBOLS[denom], exponent: 6});

const ROUTES = [`${TMS}_${NOAD}`, `${TMS}_ubze`, `${CTR}_ubze`];

// EDA3…B3C0 on testnet.
const SWAP: ScanTx = {
    height: 4099213, tx_index: 0, hash: HASH, time: "2026-11-05T21:05:21.889686Z", success: true, msg_count: 1, msg_types: [MSG.multiSwap],
    fee: [{denom: "ubze", amount: "3823"}], signer: SIGNER, signers: [SIGNER], fee_payer: SIGNER, memo: "communities.getbze.com",
    code: 0, error_log: null, gas_wanted: 382210, gas_used: 318659,
    messages: [{msg_index: 0, type_url: MSG.multiSwap, sender: SIGNER, module: "tradebin", body: {input: {denom: NOAD, amount: "10000000"}, routes: ROUTES}, events: []}],
    transfers: [
        leg(0, null, SIGNER, "bze17xpfvakm2amg962yls6f84z3kell8c5lda0te2", mod("Fee collector"), "ubze", "3823"),
        leg(1, 0, SIGNER, DEX, mod("DEX"), NOAD, "10000000"),
        leg(2, 0, DEX, "bze1cp", mod("CP fee collector"), NOAD, "6000"),
        leg(3, 0, DEX, "bze1burner", mod("Burner"), NOAD, "4000"),
        leg(4, 0, DEX, "bze1cp", mod("CP fee collector"), TMS, "95700"),
        leg(5, 0, DEX, "bze1cp", mod("CP fee collector"), "ubze", "11874"),
        leg(6, 0, DEX, "bze1burner", mod("Burner"), "ubze", "11874"),
        leg(7, 0, DEX, SIGNER, null, CTR, "6866381"),
        leg(8, 0, SIGNER, DEX, mod("DEX"), "ubze", "100000"),
        leg(9, 0, DEX, "bze1bfc", mod("Burner fee collector"), "ubze", "100000"),
    ],
    dex: null, ibc_transfers: null,
};

describe("TxPage", () => {
    it("sums a swap up in plain words, with its route and fees", async () => {
        hash = HASH;
        renderWithScan(<TxPage/>, scanClient({tx: vi.fn(async () => SWAP)}));

        expect(await screen.findByRole("heading", {level: 1, name: "Swapped 10 NOAD for 6.866381 CTR"})).toBeInTheDocument();
        expect(screen.getByText(/swapped NOAD for CTR through 3 pools on Nov 5, 2026 at 21:05 UTC\./)).toBeInTheDocument();
        expect(screen.getByTestId("tx-summary")).toHaveTextContent("plus a 0.1 BZE trading fee");
        expect(screen.getByTestId("tx-summary")).toHaveTextContent("≈ 0.686638 CTR per NOAD");

        const details = screen.getByTestId("tx-details");
        expect(details).toHaveTextContent("NOAD → TMS → BZE → CTR · 3 pools");
        expect(details).toHaveTextContent("0.01 NOAD · 0.0957 TMS · 0.023748 BZE");
        expect(details).toHaveTextContent("Network fee0.003823 BZE");
        expect(details).toHaveTextContent("Sent fromcommunities.getbze.com");
        expect(details).toHaveTextContent("Nov 5, 2026 · 21:05:21 UTC");
        expect(details).toHaveTextContent("Block4,099,213");
        expect(details).toHaveTextContent(HASH);

        await userEvent.click(screen.getByRole("button", {name: "Get NOAD"}));
        expect(open).toHaveBeenCalledWith("get");
    });

    it("says a transaction Scan hasn't indexed yet is pending", async () => {
        hash = "AB".repeat(32);
        renderWithScan(<TxPage/>, scanClient({tx: vi.fn().mockRejectedValue(new ScanError("not found", 404))}));

        expect(await screen.findByTestId("tx-not-indexed")).toHaveTextContent("Not indexed yet");
        expect(screen.getByText(hash)).toBeInTheDocument();
    });

    it("shows an error with Retry when Scan doesn't answer", async () => {
        hash = HASH;
        const tx = vi.fn().mockRejectedValue(new ScanError("BZE Scan unreachable", 0));
        renderWithScan(<TxPage/>, scanClient({tx}));

        expect(await screen.findByText(/Couldn.t load this transaction/)).toBeInTheDocument();
        const calls = tx.mock.calls.length;
        await userEvent.click(screen.getByRole("button", {name: "Retry"}));
        // Retry refetches; with nothing loaded yet the page shows its skeleton, then the error again.
        await waitFor(() => expect(tx.mock.calls.length).toBeGreaterThan(calls));
        expect(await screen.findByText(/Couldn.t load this transaction/)).toBeInTheDocument();
    });
});
