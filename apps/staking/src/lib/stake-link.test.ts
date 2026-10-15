import { describe, it, expect } from "vitest";
import { buildStakeLink } from "./stake-link";

describe("buildStakeLink", () => {
    it("builds the explorer link shape", () => {
        const operator = "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu";
        expect(buildStakeLink("https://staking.getbze.com", operator)).toBe(
            `https://staking.getbze.com/?stake=${operator}`,
        );
    });
});
