import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createDaoSourceUsageReader, EMPTY_DAO_SOURCE_USAGE} from "./dao_source_usage";

// The reader goes through the app's `/api/scan/*` proxy with a plain fetch; a router stands in for it.
type Answer = {status?: number; body?: unknown} | Error;
let routes: Record<string, Answer | (() => Answer)>;
let fetchMock: ReturnType<typeof vi.fn>;

const answerFor = (url: string): Answer => {
    const u = new URL(url, "http://app.test");
    const key = `${u.pathname.replace("/api/scan/", "")}?${[...u.searchParams.keys()].filter((k) => k !== "limit" && k !== "cursor").join("&")}`;
    const hit = routes[key];
    if (!hit) throw new Error(`no route for ${key}`);
    return typeof hit === "function" ? hit() : hit;
};

beforeEach(() => {
    routes = {
        // a Scan with the filters refuses an invalid member address
        "daos?member": {status: 400, body: {error: "member is not a bze1 address"}},
    };
    fetchMock = vi.fn(async (url: string) => {
        const answer = answerFor(url);
        if (answer instanceof Error) throw answer;
        return new Response(JSON.stringify(answer.body ?? {}), {status: answer.status ?? 200});
    });
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const dao = (id: number, name: string) => ({id, name, type: "stake"});
const proposal = (id: number, daoId: number, title = `P${id}`) => ({id, dao_id: daoId, title, status: "voting", voting_end: "2026-12-01T00:00:00Z", dao: {id: daoId, name: `DAO ${daoId}`, type: "stake"}});

describe("DAO source usage reader", () => {
    it("is empty when no DAO uses the source", async () => {
        routes["daos?source"] = {body: {items: [], next_cursor: null}};
        expect(await createDaoSourceUsageReader().read("sr/1")).toEqual(EMPTY_DAO_SOURCE_USAGE);
    });

    it("lists the DAOs of a source with no open proposal", async () => {
        routes["daos?source"] = {body: {items: [dao(3, "Club")], next_cursor: null}};
        routes["dao-proposals?status"] = {body: {items: [proposal(9, 77)], next_cursor: null}};

        expect(await createDaoSourceUsageReader().read("sr/1")).toEqual({daos: [{id: "3", name: "Club"}], openProposals: []});
    });

    it("lists the open proposals of the DAOs that use the source, and no others", async () => {
        routes["daos?source"] = {body: {items: [dao(3, "Club")], next_cursor: null}};
        routes["dao-proposals?status"] = {body: {items: [proposal(10, 3, "First"), proposal(11, 4), proposal(12, 3, "Second")], next_cursor: null}};

        const usage = await createDaoSourceUsageReader().read("dr/ubze");

        expect(usage.openProposals.map((p) => [p.id, p.title, p.daoId])).toEqual([["10", "First", "3"], ["12", "Second", "3"]]);
        expect(usage.openProposals[0].votingEnd).toBe("2026-12-01T00:00:00Z");
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("source=dr%2Fubze"));
    });

    it("reads every page of the open proposals", async () => {
        routes["daos?source"] = {body: {items: [dao(3, "Club")], next_cursor: null}};
        let page = 0;
        routes["dao-proposals?status"] = () => ({body: ++page === 1
            ? {items: [proposal(1, 9)], next_cursor: "c2"}
            : {items: [proposal(2, 3)], next_cursor: null}});

        expect((await createDaoSourceUsageReader().read("sr/1")).openProposals.map((p) => p.id)).toEqual(["2"]);
        expect(page).toBe(2);
    });

    it("is empty on a Scan without the DAO routes (404 or supported:false)", async () => {
        routes["daos?member"] = {status: 404, body: {}};
        expect(await createDaoSourceUsageReader().read("sr/1")).toEqual(EMPTY_DAO_SOURCE_USAGE);

        routes["daos?member"] = {status: 400, body: {}};
        routes["daos?source"] = {body: {items: [], next_cursor: null, supported: false}};
        expect(await createDaoSourceUsageReader().read("sr/1")).toEqual(EMPTY_DAO_SOURCE_USAGE);
    });

    it("is empty on a Scan that predates the source filter, which would answer every DAO", async () => {
        routes["daos?member"] = {status: 200, body: {items: [dao(1, "Unrelated")], next_cursor: null}};
        routes["daos?source"] = {body: {items: [dao(1, "Unrelated")], next_cursor: null}};

        expect(await createDaoSourceUsageReader().read("sr/1")).toEqual(EMPTY_DAO_SOURCE_USAGE);
    });

    it("is empty on a network error or a Scan failure, and asks again next time", async () => {
        routes["daos?source"] = new Error("down");
        const reader = createDaoSourceUsageReader();
        expect(await reader.read("sr/1")).toEqual(EMPTY_DAO_SOURCE_USAGE);

        routes["daos?source"] = {status: 502, body: {}};
        expect(await reader.read("sr/1")).toEqual(EMPTY_DAO_SOURCE_USAGE);

        routes["daos?source"] = {body: {items: [dao(3, "Club")], next_cursor: null}};
        routes["dao-proposals?status"] = {body: {items: [], next_cursor: null}};
        expect((await reader.read("sr/1")).daos).toHaveLength(1);
    });

    it("keeps an answer for a minute per source", async () => {
        routes["daos?source"] = {body: {items: [dao(3, "Club")], next_cursor: null}};
        routes["dao-proposals?status"] = {body: {items: [], next_cursor: null}};
        let now = 1_000;
        const reader = createDaoSourceUsageReader({now: () => now});

        await reader.read("sr/1");
        await reader.read("sr/1");
        const calls = fetchMock.mock.calls.length;
        await reader.read("sr/2");
        expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);

        const afterOther = fetchMock.mock.calls.length;
        await reader.read("sr/1");
        expect(fetchMock.mock.calls.length).toBe(afterOther);

        now += 61_000;
        await reader.read("sr/1");
        expect(fetchMock.mock.calls.length).toBeGreaterThan(afterOther);
    });
});
