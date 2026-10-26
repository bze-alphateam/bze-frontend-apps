import { describe, it, expect } from "vitest";
import type { MetadataSDKType } from "@bze/bzejs/cosmos/bank/v1beta1/bank";
import type { Asset } from "@bze/bze-ui-kit";
import { buildUpdatedMetadata, metadataChanges } from "./token-metadata";

const asset = { denom: "factory/bze1owner/utok", ticker: "TOK", name: "Tok", decimals: 6 } as unknown as Asset;

const onChain: MetadataSDKType = {
    description: "old",
    denom_units: [
        { denom: "factory/bze1owner/utok", exponent: 0, aliases: ["utok"] },
        { denom: "tok", exponent: 6, aliases: ["TOKEN"] },
    ],
    base: "factory/bze1owner/utok",
    display: "tok",
    name: "Tok",
    symbol: "TOK",
    uri: "https://example.com/tok.png",
    uri_hash: "abc",
};

describe("buildUpdatedMetadata", () => {
    it("copies everything from the chain and swaps in the trimmed name and description", () => {
        expect(buildUpdatedMetadata(onChain, asset, { name: "  Tok Coin ", description: " new " })).toEqual({
            name: "Tok Coin",
            description: "new",
            denomUnits: [
                { denom: "factory/bze1owner/utok", exponent: 0, aliases: ["utok"] },
                { denom: "tok", exponent: 6, aliases: ["TOKEN"] },
            ],
            base: "factory/bze1owner/utok",
            display: "tok",
            symbol: "TOK",
            uri: "https://example.com/tok.png",
            uriHash: "abc",
        });
    });

    it("falls back to the wizard's layout when the chain has no metadata", () => {
        expect(buildUpdatedMetadata(undefined, asset, { name: "Tok", description: "" })).toEqual({
            name: "Tok",
            description: "",
            denomUnits: [
                { denom: "factory/bze1owner/utok", exponent: 0, aliases: ["utok"] },
                { denom: "tok", exponent: 6, aliases: [] },
            ],
            base: "factory/bze1owner/utok",
            display: "tok",
            symbol: "TOK",
            uri: "",
            uriHash: "",
        });
    });
});

describe("metadataChanges", () => {
    it("lists only the changed fields, comparing trimmed values", () => {
        const current = { name: "Tok", description: "old" };
        expect(metadataChanges(current, { name: " Tok ", description: "old" })).toEqual([]);
        expect(metadataChanges(current, { name: "Tok Coin", description: "" })).toEqual([
            { label: "Name", oldValue: "Tok", newValue: "Tok Coin" },
            { label: "Description", oldValue: "old", newValue: "" },
        ]);
    });
});
