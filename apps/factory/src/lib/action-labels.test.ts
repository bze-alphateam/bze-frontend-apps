import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

// One action, one name (factory forms audit R4/R5): every button or link that extends a reward
// (simple or daily prize) reads "Extend", and every one that opens or submits /denom-reward/new
// reads "Make {ticker} stakable" ("Make a token stakable" without a token). The product keeps its
// name, "Compounded reward", on cards, crumbs and page titles, so `title` lines are not scanned.
const RETIRED = [
    "Extend reward",
    "Add more days",
    "Extend daily prize",
    "Extend prize",
    "Extend →",
    "Extend before it ends",
    "Create compounded reward",
];

const srcDir = join(__dirname, "..");
const sources = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map(f => ({ file: f.split(sep).join("/"), text: readFileSync(join(srcDir, f), "utf8") }));

/** The lines of a source that can hold a label: no comments, no page or card titles. */
function labelLines(text: string): string[] {
    return text.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/^\s*title\s*[:=]/.test(l));
}

describe("action labels", () => {
    it("scans the app's sources", () => {
        expect(sources.length).toBeGreaterThan(50);
    });

    it.each(RETIRED)("no button or link says %j any more", (label) => {
        const quoted = new RegExp(`['"\`>]\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*['"\`<]`);
        const hits = sources.flatMap(({ file, text }) => labelLines(text).filter(l => quoted.test(l)).map(l => `${file}: ${l.trim()}`));
        expect(hits).toEqual([]);
    });

    it("the extend actions say Extend", () => {
        const text = (file: string) => sources.find(s => s.file === file)?.text ?? "";
        expect(text("app/reward/extend/page.tsx")).toContain('submitLabel="Extend"');
        expect(text("app/denom-reward/schedule/page.tsx")).toContain("submitLabel={isExtend ? 'Extend' : 'Start daily prize'}");
        expect(text("components/rewards/compounded-reward-card.tsx")).toContain(">Extend</ItemLink>");
        expect(text("components/rewards/simple-reward-row.tsx")).toContain(">Extend</ItemLink>");
        expect(text("components/token-page/rewards-group.tsx").match(/>Extend<\/ItemLink>/g)).toHaveLength(2);
    });

    it("the compounded-reward actions say Make … stakable", () => {
        const text = (file: string) => sources.find(s => s.file === file)?.text ?? "";
        expect(text("app/create/rewards/page.tsx")).toContain("label: 'Make a token stakable'");
        expect(text("app/denom-reward/new/page.tsx")).toContain("submitLabel={ticker ? `Make ${ticker} stakable` : 'Make a token stakable'}");
    });
});
