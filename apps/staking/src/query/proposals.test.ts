import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import detail48 from "@/lib/governance/fixtures/scan-proposal-48.json";
import page from "@/lib/governance/fixtures/scan-proposals-page.json";

// The proposal sources against a fake /api/scan and mocked chain queries:
// Scan first, the chain when Scan is down, and decided proposals kept.
const chain = vi.hoisted(() => ({ getOpenProposals: vi.fn(), getProposal: vi.fn() }));
vi.mock("@bze/bze-ui-kit", () => chain);

type Module = typeof import("./proposals");
let mod: Module;
const fetchMock = vi.fn<typeof fetch>();

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response("{}", { status: code });
const urls = () => fetchMock.mock.calls.map(([url]) => String(url));
const restProposal = (id: string, s: string) => ({ id, status: s, title: `P${id}`, messages: [], failed_reason: "" });

beforeEach(async () => {
    fetchMock.mockReset();
    chain.getOpenProposals.mockReset();
    chain.getProposal.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // The decided-proposal cache is module-wide: a fresh copy per test.
    vi.resetModules();
    mod = await import("./proposals");
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("loadOpenProposals", () => {
    it("lists the voting proposals from Scan, never the chain's slow status filter", async () => {
        fetchMock.mockResolvedValue(ok({ items: page.items.slice(0, 1), next_cursor: null }));
        const open = await mod.loadOpenProposals();

        expect(urls()).toEqual(["/api/scan/proposals?status=voting_period&limit=50"]);
        expect(open.map((p) => [p.id, p.status, p.kind])).toEqual([["48", "PROPOSAL_STATUS_VOTING_PERIOD", "software_upgrade"]]);
        expect(chain.getOpenProposals).not.toHaveBeenCalled();
    });

    it.each([
        ["answers an error", () => fetchMock.mockResolvedValue(status(502))],
        ["is unreachable", () => fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))],
    ])("reads them from the chain when Scan %s", async (_case, fail) => {
        fail();
        chain.getOpenProposals.mockResolvedValue([restProposal("48", "PROPOSAL_STATUS_VOTING_PERIOD")]);

        expect((await mod.loadOpenProposals()).map((p) => p.id)).toEqual(["48"]);
        expect(chain.getOpenProposals).toHaveBeenCalledTimes(1);
    });
});

describe("loadFinishedProposals", () => {
    it("keeps the decided ones and refills a short page from the cursor", async () => {
        fetchMock
            .mockResolvedValueOnce(ok({ items: page.items, next_cursor: "NDY" }))
            .mockResolvedValueOnce(ok({ items: [{ ...page.items[2], id: 45 }], next_cursor: null }));
        const result = await mod.loadFinishedProposals();

        expect(urls()).toEqual(["/api/scan/proposals?limit=10", "/api/scan/proposals?limit=10&cursor=NDY"]);
        expect(result.proposals.map((p) => p.id)).toEqual(["47", "46", "45"]);
        expect(result.nextCursor).toBeNull();
    });

    it("continues from a cursor", async () => {
        fetchMock.mockImplementation(async () => ok({ items: page.items.slice(1), next_cursor: "NDU" }));
        await mod.loadFinishedProposals("NDc");

        expect(urls()[0]).toBe("/api/scan/proposals?limit=10&cursor=NDc");
    });

    it("throws when Scan is down: the decided list has no chain fallback", async () => {
        fetchMock.mockResolvedValue(status(502));

        await expect(mod.loadFinishedProposals()).rejects.toThrow("502");
    });
});

describe("loadProposal", () => {
    it("reads an open proposal from Scan every time", async () => {
        fetchMock.mockImplementation(async () => ok(detail48));
        const p = await mod.loadProposal("48");
        await mod.loadProposal("48");

        expect(p?.proposer).toBe("bze1dte8cgjyxnsg4zmrlhfv4h4hnxv5vy8khzfx4f");
        expect(urls()).toEqual(["/api/scan/proposals/48", "/api/scan/proposals/48"]);
        expect(chain.getProposal).not.toHaveBeenCalled();
    });

    it("keeps a decided proposal for the session", async () => {
        fetchMock.mockImplementation(async () => ok({ ...detail48, id: 47, status: "passed" }));
        await mod.loadProposal("47");
        const again = await mod.loadProposal("47");

        expect(again?.status).toBe("PROPOSAL_STATUS_PASSED");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reads it from the chain when Scan is down", async () => {
        fetchMock.mockResolvedValue(status(502));
        chain.getProposal.mockResolvedValue(restProposal("48", "PROPOSAL_STATUS_VOTING_PERIOD"));

        expect((await mod.loadProposal("48"))?.id).toBe("48");
        expect(chain.getProposal).toHaveBeenCalledWith("48");
    });

    it("asks the chain about a proposal Scan doesn't have yet", async () => {
        fetchMock.mockResolvedValue(status(404));
        chain.getProposal.mockResolvedValue(null);

        expect(await mod.loadProposal("99")).toBeNull();
        expect(chain.getProposal).toHaveBeenCalledWith("99");
    });

    it("adds the chain's failure reason to a failed proposal", async () => {
        fetchMock.mockResolvedValue(ok({ ...detail48, id: 30, status: "failed" }));
        chain.getProposal.mockResolvedValue({ ...restProposal("30", "PROPOSAL_STATUS_FAILED"), failed_reason: "out of gas" });

        expect((await mod.loadProposal("30"))?.failed_reason).toBe("out of gas");
    });
});
