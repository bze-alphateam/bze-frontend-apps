import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Hive Glow rule for the Burner: no emoji in any UI string (headings, buttons, toasts, the
// raffle waiting lines, the page title). Scans every source file of the app.
const SRC = fileURLToPath(new URL(".", import.meta.url));
const EMOJI = /\p{Extended_Pictographic}/u;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
    });
}

describe("Burner copy", () => {
    it("has no emoji in any source file", () => {
        const offenders = sourceFiles(SRC).flatMap((file) =>
            readFileSync(file, "utf8")
                .split("\n")
                .map((line, i) => ({ file: file.slice(SRC.length), line: i + 1, text: line }))
                .filter(({ text }) => EMOJI.test(text)),
        );

        expect(offenders).toEqual([]);
    });
});
