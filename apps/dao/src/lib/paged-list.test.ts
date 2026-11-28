import {describe, expect, it, vi} from "vitest";
import {createPagingMemory, isLaterPage, pastEndPage, readScanPage} from "./paged-list";

describe("readScanPage", () => {
    it("asks by page while the client answers totals, and never reads next_cursor then", async () => {
        const memory = createPagingMemory();
        const read = vi.fn(async () => ({total: 41, next_cursor: "ignored"}));
        expect(await readScanPage(memory, {}, {page: 3, cursor: "c"}, read)).toMatchObject({mode: "pages", total: 41, next: null});
        expect(read).toHaveBeenCalledWith({page: 3});
    });

    it("an answer without a total is cursor mode, and the client is read by cursor from then on", async () => {
        const memory = createPagingMemory();
        const client = {};
        const read = vi.fn(async () => ({next_cursor: "c1"}));
        expect(await readScanPage(memory, client, {page: 4}, read)).toMatchObject({mode: "cursor", total: null, next: "c1"});
        expect(read).toHaveBeenLastCalledWith({page: 4});
        await readScanPage(memory, client, {page: 4, cursor: "c1"}, read);
        expect(read).toHaveBeenLastCalledWith({cursor: "c1"});
        await readScanPage(memory, client, {page: 1}, read);
        expect(read).toHaveBeenLastCalledWith({cursor: null});
    });

    it("an answer that says nothing about paging (tellsPaging false) leaves the client numbered", async () => {
        const memory = createPagingMemory();
        const client = {};
        const read = vi.fn(async () => ({total: null, next_cursor: null, supported: false}));
        expect(await readScanPage(memory, client, {page: 1}, read, (a) => a.supported)).toMatchObject({mode: "cursor"});
        await readScanPage(memory, client, {page: 2}, read, (a) => a.supported);
        expect(read).toHaveBeenLastCalledWith({page: 2});
    });

    it("remembers per client and per memory", async () => {
        const memory = createPagingMemory();
        const old = {};
        await readScanPage(memory, old, {page: 1}, async () => ({total: null, next_cursor: null}));
        const read = vi.fn(async () => ({total: 3, next_cursor: null}));
        await readScanPage(memory, {}, {page: 1}, read);
        await readScanPage(createPagingMemory(), old, {page: 1}, read);
        expect(read.mock.calls).toEqual([[{page: 1}], [{page: 1}]]);
    });
});

describe("pastEndPage", () => {
    it("is the last page for an empty numbered page past the end", () => {
        expect(pastEndPage({mode: "pages", returned: 0, total: 23}, 9, 20)).toBe(2);
    });

    it("is null otherwise", () => {
        expect(pastEndPage({mode: "pages", returned: 3, total: 23}, 2, 20)).toBeNull();
        expect(pastEndPage({mode: "pages", returned: 0, total: 0}, 2, 20)).toBeNull();
        expect(pastEndPage({mode: "pages", returned: 0, total: 23}, 1, 20)).toBeNull();
        expect(pastEndPage({mode: "cursor", returned: 0, total: null}, 3, 20)).toBeNull();
        expect(pastEndPage(null, 3, 20)).toBeNull();
    });
});

describe("isLaterPage", () => {
    it("is any page after the first, by number or by cursor", () => {
        expect([{page: 1}, {page: 2}, {page: 1, cursor: "c"}, {page: 1, cursor: null}].map(isLaterPage)).toEqual([false, true, true, false]);
    });
});
