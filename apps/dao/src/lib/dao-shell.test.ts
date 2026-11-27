import {describe, expect, it} from "vitest";
import type {DaoProposal} from "@bze/bze-ui-kit";
import {createdOnLine, descriptionOverflows, DESCRIPTION_CLAMP_CHARS, proposalCounter} from "./dao-shell";

const chain = (n: number) => ({ok: true as const, value: Array.from({length: n}, () => ({}) as DaoProposal)});
const down = {ok: false as const};

describe("proposalCounter", () => {
    it("full data: Scan's open and total, '1/9'", () => {
        expect(proposalCounter({proposals_open: 1, proposals_total: 9}, chain(3))).toEqual({
            open: 1, total: 9, label: "1/9", title: "1 voting now, 9 proposals in all",
        });
        expect(proposalCounter({proposals_open: 0, proposals_total: 1}, chain(0))?.title).toBe("0 voting now, 1 proposal in all");
    });

    it("an older Scan without the total: only the open count, Scan's first", () => {
        expect(proposalCounter({proposals_open: 2}, chain(5))).toMatchObject({open: 2, total: null, label: "2", title: "2 voting now"});
    });

    it("Scan down or without counts: the chain's open proposals", () => {
        expect(proposalCounter(undefined, chain(3))).toMatchObject({open: 3, total: null, label: "3"});
        expect(proposalCounter(null, chain(0))).toMatchObject({label: "0"});
        expect(proposalCounter({}, chain(1))).toMatchObject({label: "1"});
    });

    it("a total without an open count from Scan takes the chain's open count", () => {
        expect(proposalCounter({proposals_total: 4}, chain(1))?.label).toBe("1/4");
    });

    it("nothing known: no pill", () => {
        expect(proposalCounter(undefined, down)).toBeNull();
        expect(proposalCounter({proposals_total: 4}, down)).toBeNull();
    });

    it("values that are not counts are treated as missing", () => {
        const odd = {proposals_open: "1", proposals_total: -2} as unknown as {proposals_open: number; proposals_total: number};
        expect(proposalCounter(odd, chain(2))).toMatchObject({open: 2, total: null});
    });
});

describe("createdOnLine", () => {
    it("the chain's created_at first, then Scan's created_time", () => {
        expect(createdOnLine({created_at: "1793000000"}, {created_time: "2020-01-01T00:00:00Z"})).toBe("Created on 26 Oct 2026");
        expect(createdOnLine({created_at: "0"}, {created_time: "2026-11-02T10:00:00Z"})).toBe("Created on 2 Nov 2026");
    });

    it("no line when neither is known", () => {
        expect(createdOnLine({created_at: ""}, null)).toBeNull();
        expect(createdOnLine({created_at: "0"}, {created_time: null})).toBeNull();
    });
});

describe("descriptionOverflows", () => {
    it("a short text on up to 3 lines fits", () => {
        expect(descriptionOverflows("One line.")).toBe(false);
        expect(descriptionOverflows("a\nb\nc")).toBe(false);
    });

    it("more than 3 lines or a long text does not", () => {
        expect(descriptionOverflows("a\nb\nc\nd")).toBe(true);
        expect(descriptionOverflows("x".repeat(DESCRIPTION_CLAMP_CHARS + 1))).toBe(true);
    });
});
