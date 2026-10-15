import { describe, it, expect } from "vitest";
import { buildStakeLink, isValidOperatorAddress } from "./stake-link";

// Real operator addresses from the BZE testnet genesis.
const VALID = [
    "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu",
    "bzevaloper1fhkcj8e67jxm27e2hx4m9nq7p2jftfnuy4kvhr",
];

describe("isValidOperatorAddress", () => {
    it.each(VALID)("accepts %s", (address) => {
        expect(isValidOperatorAddress(address)).toBe(true);
    });

    it("rejects a typo that breaks the checksum", () => {
        expect(isValidOperatorAddress("bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnv")).toBe(false);
    });

    it("rejects an account address", () => {
        expect(isValidOperatorAddress("bze130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu")).toBe(false);
    });

    it.each([
        "",
        "hello",
        "BZEVALOPER130K7XUF6TGESSH76KPDR0Z4J6FNDHQJAG8HJNU",
        "bzevaloper1",
        "bzevaloper1bbbbbb",
        "bzevaloper1o0k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu",
    ])("rejects %j", (value) => {
        expect(isValidOperatorAddress(value)).toBe(false);
    });
});

describe("buildStakeLink", () => {
    it("builds the explorer link shape", () => {
        expect(buildStakeLink("https://staking.getbze.com", VALID[0])).toBe(
            `https://staking.getbze.com/?stake=${VALID[0]}`,
        );
    });
});
