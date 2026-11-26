import { describe, it, expect } from "vitest";
import { adminTxHref, disableMintingArmed, mintingGoneForever, mintingStaysTheSame } from "./permissions";

describe("turn off minting copy", () => {
    it("ends: minting more of the ticker, by anyone, even governance", () => {
        expect(mintingGoneForever("HONEY")).toEqual([
            "Minting more HONEY, by anyone, ever",
            "No vote, not even governance, can turn minting back on",
        ]);
    });

    it("stays: the admin's other rights, holders, pools, markets and rewards", () => {
        expect(mintingStaysTheSame("HONEY")).toEqual([
            "You stay the admin",
            "Name, logo and description",
            "Brand kit",
            "Fee settings",
            "Transferring admin",
            "Everyone keeps their HONEY",
            "Pools, markets and rewards keep running",
        ]);
    });

    it("arms on the exact ticker only", () => {
        expect(disableMintingArmed("HONEY", "HONEY")).toBe(true);
        expect(disableMintingArmed("honey", "HONEY")).toBe(false);
        expect(disableMintingArmed("", "")).toBe(false);
    });

    it("has its own pending-tx key", () => {
        const keys = new Set((["transfer", "renounce", "disable-minting"] as const).map(a => adminTxHref("factory/bze1x/u", a)));
        expect(keys.size).toBe(3);
    });
});
