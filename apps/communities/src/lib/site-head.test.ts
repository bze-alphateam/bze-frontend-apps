import {afterEach, describe, it, expect, vi} from "vitest";

import {isTestnetBuild} from "./site-head";

describe("isTestnetBuild", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is on for a testnet build only", () => {
        for (const [raw, want] of [["true", true], ["1", true], ["false", false], ["", false]] as const) {
            vi.stubEnv("NEXT_PUBLIC_CHAIN_IS_TESTNET", raw);
            expect(isTestnetBuild()).toBe(want);
        }
    });
});
