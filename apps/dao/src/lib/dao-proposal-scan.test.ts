import {describe, expect, it, vi} from "vitest";
import {createDaoProposalScan, ScanRefusedError} from "./dao-proposal-scan";
import {ScanUnavailableError, type ScanGetter} from "./dao-scan";

const scanWith = (answer: {status: number; body: unknown} | Error) => {
    const get = vi.fn<ScanGetter>(async () => {
        if (answer instanceof Error) throw answer;
        return answer;
    });
    return {get, scan: createDaoProposalScan(get)};
};

describe("listForDao", () => {
    it("asks for one status by cursor, and has no total or counts then", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [{id: 1}], next_cursor: "c2"}});
        expect(await scan.listForDao("4", {statuses: ["voting"], cursor: "c1", limit: 50})).toEqual({items: [{id: 1}], next_cursor: "c2", total: null, status_counts: null});
        expect(get).toHaveBeenCalledWith("daos/4/proposals", [["status", "voting"], ["cursor", "c1"], ["limit", "50"]]);
    });

    it("asks for no status without one, and reads an empty cursor as the last page", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [], next_cursor: ""}});
        expect((await scan.listForDao("4", {limit: 20})).next_cursor).toBeNull();
        expect(get).toHaveBeenCalledWith("daos/4/proposals", [["limit", "20"]]);
    });

    it("repeats the status, sends a page (never with a cursor) and reads the total and the counts", async () => {
        const counts = {voting: 2, execution_failed: 1, executed: 8, rejected: 3, expired: 2, cancelled: 1};
        const {get, scan} = scanWith({status: 200, body: {items: [], next_cursor: null, total: 3, status_counts: {...counts, odd: "x"}}});
        const page = await scan.listForDao("4", {statuses: ["voting", "execution_failed"], page: 2, cursor: "ignored", limit: 20});
        expect(get).toHaveBeenCalledWith("daos/4/proposals", [["status", "voting"], ["status", "execution_failed"], ["page", "2"], ["limit", "20"]]);
        expect(page.total).toBe(3);
        expect(page.status_counts).toEqual(counts);
    });

    it("is refused on a 400 (an older Scan that does not know the status)", async () => {
        await expect(scanWith({status: 400, body: {error: "unknown status"}}).scan.listForDao("4", {statuses: ["active"], page: 1, limit: 20})).rejects.toBeInstanceOf(ScanRefusedError);
    });

    it.each([[{status: 502, body: null}], [{status: 404, body: {}}], [{status: 200, body: {nope: 1}}], [new Error("offline")]])("is unavailable on %j", async (answer) => {
        await expect(scanWith(answer).scan.listForDao("4", {limit: 20})).rejects.toBeInstanceOf(ScanUnavailableError);
    });
});

describe("detail", () => {
    it("is the proposal, null on 404, unavailable otherwise", async () => {
        expect(await scanWith({status: 200, body: {id: 7}}).scan.detail("7")).toEqual({id: 7});
        expect(await scanWith({status: 404, body: {}}).scan.detail("7")).toBeNull();
        await expect(scanWith({status: 500, body: null}).scan.detail("7")).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(scanWith(new Error("offline")).scan.detail("7")).rejects.toBeInstanceOf(ScanUnavailableError);
    });
});

describe("votes", () => {
    it("filters by option and pages by cursor, without a total or counts then", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [{voter: "bze1"}], next_cursor: "n", weight_denom: {denom: "ubze", symbol: "BZE", exponent: 6}}});
        const page = await scan.votes("7", {option: "yes", cursor: "c1", limit: 20});
        expect(page).toMatchObject({items: [{voter: "bze1"}], next_cursor: "n", weight_denom: {denom: "ubze"}, total: null, option_counts: null});
        expect(get).toHaveBeenCalledWith("dao-proposals/7/votes", [["option", "yes"], ["cursor", "c1"], ["limit", "20"]]);
    });

    it("asks for a numbered page (never with a cursor) and reads the total and the counts per option", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [], next_cursor: null, weight_denom: null, total: 214, option_counts: {yes: 150, no: 50, abstain: 14}}});
        const page = await scan.votes("7", {option: null, page: 3, cursor: "ignored", limit: 20});
        expect(page).toMatchObject({total: 214, option_counts: {yes: 150, no: 50, abstain: 14}});
        expect(get).toHaveBeenCalledWith("dao-proposals/7/votes", [["page", "3"], ["limit", "20"]]);
    });

    it("drops counts that are not whole numbers for every option", async () => {
        const {scan} = scanWith({status: 200, body: {items: [], next_cursor: null, total: 2, option_counts: {yes: 2, no: "x"}}});
        expect((await scan.votes("7", {option: null, page: 1, limit: 20}))?.option_counts).toBeNull();
    });

    it("null for a proposal Scan does not know", async () => {
        expect(await scanWith({status: 404, body: {}}).scan.votes("7", {option: null, page: 1, limit: 20})).toBeNull();
    });
});
