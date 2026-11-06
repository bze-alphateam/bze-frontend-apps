import {afterEach, describe, it, expect, vi} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";

import {isTestnetBuild, SITE_OG_IMAGE, SITE_OG_IMAGE_VERSION} from "./site-head";

// Vitest runs from the app's directory (jsdom gives no file URL for import.meta.url).
const OG_IMAGE_FILE = join(process.cwd(), "public/images/og-image.png");

describe("SITE_OG_IMAGE", () => {
    // Share previews are cached by image URL: an image swapped under an unchanged URL keeps
    // showing the old one on X, Telegram and the rest. This fails until the version is bumped.
    it("is versioned with the hash of the image file it serves", () => {
        const hash = createHash("sha256").update(readFileSync(OG_IMAGE_FILE)).digest("hex").slice(0, 8);

        expect(SITE_OG_IMAGE_VERSION).toBe(hash);
        expect(SITE_OG_IMAGE.url).toBe(`/images/og-image.png?v=${hash}`);
    });
});

describe("isTestnetBuild", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is on for a testnet build only", () => {
        for (const [raw, want] of [["true", true], ["1", true], ["false", false], ["", false]] as const) {
            vi.stubEnv("NEXT_PUBLIC_CHAIN_IS_TESTNET", raw);
            expect(isTestnetBuild()).toBe(want);
        }
    });
});
