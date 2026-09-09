import {afterEach, describe, expect, it, vi} from "vitest";

import {isCommunitiesEnabled} from "./app-gate";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("isCommunitiesEnabled", () => {
    it("defaults to enabled when the env var is not set", () => {
        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", undefined);
        expect(isCommunitiesEnabled()).toBe(true);
    });

    it("is enabled for 'true'", () => {
        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", "true");
        expect(isCommunitiesEnabled()).toBe(true);
    });

    it("is disabled only for 'false', ignoring case and whitespace", () => {
        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", "false");
        expect(isCommunitiesEnabled()).toBe(false);

        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", " FALSE ");
        expect(isCommunitiesEnabled()).toBe(false);
    });

    it("treats any other value (empty, typo, 0) as enabled — never hides the app by accident", () => {
        for (const value of ["", "0", "no", "flase"]) {
            vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", value);
            expect(isCommunitiesEnabled(), `value=${JSON.stringify(value)}`).toBe(true);
        }
    });
});
