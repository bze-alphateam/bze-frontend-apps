import { describe, it, expect } from "vitest";
import { lastWizard, type StoredWizards } from "./last-wizard";
import { EMPTY_TOKEN_FORM, type TokenFormStep } from "./token-draft";
import type { MultiSendRun, RunBatch } from "./multisend-run";

const token = (symbol: string, answered: TokenFormStep[], savedAt = 1): StoredWizards["token"] =>
    ({ value: { form: { ...EMPTY_TOKEN_FORM, symbol }, answered }, savedAt });
const list = (denom: string, savedAt = 1): StoredWizards["multisendDraft"] =>
    ({ value: { denom, mode: "same", sameAmount: "", text: "bze1a" }, savedAt });
const batch = (id: number, status: RunBatch["status"]): RunBatch => ({ id, count: 10, total: "100", status });
const run = (batches: RunBatch[], savedAt = 1): StoredWizards["multisendRun"] =>
    ({ value: { fingerprint: "f", denom: "ubee", batches, startedAt: 0 } as MultiSendRun, savedAt });

describe("lastWizard", () => {
    it("is nothing without drafts", () => {
        expect(lastWizard({})).toBeUndefined();
    });

    it("is nothing for a wizard with no finished step", () => {
        expect(lastWizard({ token: token("BEE", []), multisendDraft: list("") })).toBeUndefined();
    });

    it("points to the token wizard on the first unfinished step", () => {
        expect(lastWizard({ token: token("BEE", ["details"], 5) })).toEqual({
            key: "token:5",
            label: "Continue creating BEE",
            step: 2,
            total: 4,
            href: "/token/new",
            savedAt: 5,
        });
        expect(lastWizard({ token: token("", ["details", "supply", "permissions"]) })).toMatchObject({ label: "Continue creating your token", step: 4 });
    });

    it("points to the multi-send list once a token is picked, and to Review while a run has batches left", () => {
        expect(lastWizard({ multisendDraft: list("ubee") })).toMatchObject({ label: "Continue your airdrop to a list of wallets", step: 3, total: 4, href: "/airdrop?to=list" });
        expect(lastWizard({ multisendDraft: list("ubee"), multisendRun: run([batch(1, "sent"), batch(2, "pending")]) })).toMatchObject({ step: 4 });
    });

    it("ignores a finished run", () => {
        expect(lastWizard({ multisendRun: run([batch(1, "sent")]) })).toBeUndefined();
    });

    it("picks the most recently saved wizard", () => {
        expect(lastWizard({ token: token("BEE", ["details"], 10), multisendDraft: list("ubee", 20) })).toMatchObject({ href: "/airdrop?to=list" });
        expect(lastWizard({ token: token("BEE", ["details"], 30), multisendDraft: list("ubee", 20) })).toMatchObject({ href: "/token/new" });
    });

    it("skips a newer wizard that has no finished step", () => {
        expect(lastWizard({ token: token("BEE", ["details"], 10), multisendDraft: list("", 20) })).toMatchObject({ href: "/token/new" });
    });
});
