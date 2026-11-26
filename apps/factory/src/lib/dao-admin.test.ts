import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dao } from "@bze/bze-ui-kit";
import {
    daoControllerLine, daoLabel, daoPageHref, daoTypeLine, lookupDaoAdmin, type DaoAdminServices,
} from "./dao-admin";

const ADDRESS = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";
const DAO = { id: "7", name: "Honey Guild", type: "DAO_TYPE_STATIC_LIST", electorate: null } as unknown as Dao;

const services = (over: Partial<DaoAdminServices> = {}): DaoAdminServices => ({
    isSupported: vi.fn(async () => true),
    byAddress: vi.fn(async () => DAO),
    controller: vi.fn(async () => null),
    ...over,
});

beforeEach(() => localStorage.clear());

describe("lookupDaoAdmin", () => {
    it("finds the DAO behind an address", async () => {
        expect(await lookupDaoAdmin(ADDRESS, services())).toEqual({ status: "dao", dao: DAO });
    });

    it("a plain address (the chain's 404 → null) is none", async () => {
        expect(await lookupDaoAdmin(ADDRESS, services({ byAddress: async () => null }))).toEqual({ status: "none" });
    });

    it("a node without x/dao (501) is unsupported and is not asked for the address", async () => {
        const s = services({ isSupported: async () => false });
        expect(await lookupDaoAdmin(ADDRESS, s)).toEqual({ status: "unsupported" });
        expect(s.byAddress).not.toHaveBeenCalled();
    });

    it("a network error is failed, and is not cached", async () => {
        const byAddress = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(DAO);
        const s = services({ byAddress });
        expect(await lookupDaoAdmin(ADDRESS, s)).toEqual({ status: "failed" });
        expect(await lookupDaoAdmin(ADDRESS, s)).toEqual({ status: "dao", dao: DAO });
    });

    it("answers a repeat from the cache, DAO and plain address alike", async () => {
        const s = services();
        await lookupDaoAdmin(ADDRESS, s);
        await lookupDaoAdmin(ADDRESS, s);
        expect(s.byAddress).toHaveBeenCalledTimes(1);

        const plain = services({ byAddress: vi.fn(async () => null) });
        await lookupDaoAdmin("bze1plain", plain);
        expect(await lookupDaoAdmin("bze1plain", plain)).toEqual({ status: "none" });
        expect(plain.byAddress).toHaveBeenCalledTimes(1);
    });

    it("forgets the answer after five minutes", async () => {
        vi.useFakeTimers();
        try {
            const s = services();
            await lookupDaoAdmin(ADDRESS, s);
            vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
            await lookupDaoAdmin(ADDRESS, s);
            expect(s.byAddress).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("wording", () => {
    it("names the DAO", () => expect(daoLabel(DAO)).toBe("DAO Honey Guild (#7)"));

    it("says who votes", () => {
        expect(daoTypeLine(DAO)).toBe("Voted by its members");
        const stake = { type: "DAO_TYPE_STAKE", electorate: { sr_ids: [], dr_denom: "factory/x/u" } } as unknown as Dao;
        expect(daoTypeLine(stake, () => "HONEY")).toBe("Voted by the stakers of HONEY");
        expect(daoTypeLine(stake)).toBe("Voted by the stakers of its staking rewards");
    });

    it("says who controls it", () => {
        const c = (end_reason: "ACCOUNT" | "SELF_OWNED" | "CYCLE" | "DEPTH_CAP") => ({ controller: ADDRESS, end_reason, path: [] });
        expect(daoControllerLine(c("SELF_OWNED"))).toBe("Controlled by its voters");
        expect(daoControllerLine(c("ACCOUNT"))).toBe("Controlled by bze1sx…s3tg0");
        expect(daoControllerLine(c("CYCLE"))).toBe("Controlled by DAO bze1sx…s3tg0 (its admins form a loop)");
        expect(daoControllerLine(c("DEPTH_CAP"))).toBe("Controlled through a chain of more than 16 DAOs");
    });

    it("links the DAO's page without a double slash", () => {
        expect(daoPageHref("https://dao.getbze.com/", "7")).toBe("https://dao.getbze.com/dao/7");
    });
});
