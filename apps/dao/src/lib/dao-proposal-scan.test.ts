import {describe, expect, it, vi} from "vitest";
import {createDaoProposalScan} from "./dao-proposal-scan";
import {ScanUnavailableError, type ScanGetter} from "./dao-scan";

const scanWith = (answer: {status: number; body: unknown} | Error) => {
    const get = vi.fn<ScanGetter>(async () => {
        if (answer instanceof Error) throw answer;
        return answer;
    });
    return {get, scan: createDaoProposalScan(get)};
};

describe("listForDao", () => {
    it("asks for one status and a page", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [{id: 1}], next_cursor: "c2"}});
        expect(await scan.listForDao("4", "voting", "c1", 50)).toEqual({items: [{id: 1}], next_cursor: "c2"});
        expect(get).toHaveBeenCalledWith("daos/4/proposals", [["status", "voting"], ["cursor", "c1"], ["limit", "50"]]);
    });

    it("asks for no status without one, and reads an empty cursor as the last page", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [], next_cursor: ""}});
        expect((await scan.listForDao("4", null, null, 20)).next_cursor).toBeNull();
        expect(get).toHaveBeenCalledWith("daos/4/proposals", [["limit", "20"]]);
    });

    it.each([[{status: 502, body: null}], [{status: 404, body: {}}], [{status: 200, body: {nope: 1}}], [new Error("offline")]])("is unavailable on %j", async (answer) => {
        await expect(scanWith(answer).scan.listForDao("4", null, null, 20)).rejects.toBeInstanceOf(ScanUnavailableError);
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
    it("filters by option and pages", async () => {
        const {get, scan} = scanWith({status: 200, body: {items: [{voter: "bze1"}], next_cursor: "n", weight_denom: {denom: "ubze", symbol: "BZE", exponent: 6}}});
        const page = await scan.votes("7", "yes", null, 20);
        expect(page).toMatchObject({items: [{voter: "bze1"}], next_cursor: "n", weight_denom: {denom: "ubze"}});
        expect(get).toHaveBeenCalledWith("dao-proposals/7/votes", [["option", "yes"], ["limit", "20"]]);
    });

    it("null for a proposal Scan does not know", async () => {
        expect(await scanWith({status: 404, body: {}}).scan.votes("7", null, null, 20)).toBeNull();
    });
});
