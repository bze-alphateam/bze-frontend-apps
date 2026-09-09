import {afterEach, describe, expect, it, vi} from "vitest";

import {isCommunitiesEnabled} from "./app-gate";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("isCommunitiesEnabled", () => {
    it("defaults to hidden when the env var is not set", () => {
        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", undefined);
        expect(isCommunitiesEnabled()).toBe(false);
    });

    it("is enabled only for 'true', ignoring case and whitespace", () => {
        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", "true");
        expect(isCommunitiesEnabled()).toBe(true);

        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", " TRUE ");
        expect(isCommunitiesEnabled()).toBe(true);
    });

    it("is hidden for 'false'", () => {
        vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", "false");
        expect(isCommunitiesEnabled()).toBe(false);
    });

    it("treats any other value (empty, typo, 1, yes) as hidden — never exposes the app by accident", () => {
        for (const value of ["", "1", "yes", "ture"]) {
            vi.stubEnv("NEXT_PUBLIC_COMMUNITIES_ENABLED", value);
            expect(isCommunitiesEnabled(), `value=${JSON.stringify(value)}`).toBe(false);
        }
    });
});
