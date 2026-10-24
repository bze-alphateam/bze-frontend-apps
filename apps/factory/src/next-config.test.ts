import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

describe("next.config redirects", () => {
    it("sends the old /denom-reward directory and token page to /rewards, not permanent", async () => {
        const redirects = await nextConfig.redirects!();
        expect(redirects).toContainEqual({ source: "/denom-reward", destination: "/rewards", permanent: false });
        // Next keeps the query: /denom-reward/token?denom=x lands on /rewards?denom=x (BFE-272).
        expect(redirects).toContainEqual({ source: "/denom-reward/token", destination: "/rewards", permanent: false });
        // The new and schedule forms keep their routes: only the airdrop form moved.
        expect(redirects.filter(r => r.source.startsWith("/denom-reward")).map(r => r.source))
            .toEqual(["/denom-reward", "/denom-reward/token", "/denom-reward/airdrop"]);
    });

    it("moves Manage to Tokens for good, the token page included (Next keeps the query)", async () => {
        const redirects = await nextConfig.redirects!();
        expect(redirects).toContainEqual({ source: "/manage", destination: "/tokens", permanent: true });
        expect(redirects).toContainEqual({ source: "/manage/token", destination: "/tokens/token", permanent: true });
    });

    it("sends the retired playbooks page home", async () => {
        const redirects = await nextConfig.redirects!();
        expect(redirects).toContainEqual({ source: "/playbooks", destination: "/", permanent: true });
    });

    it("sends every old airdrop-like form to the Airdrop wizard for good (Next keeps the query)", async () => {
        const redirects = await nextConfig.redirects!();
        expect(redirects).toContainEqual({ source: "/multisend", destination: "/airdrop?to=list", permanent: true });
        expect(redirects).toContainEqual({ source: "/reach", destination: "/airdrop", permanent: true });
        expect(redirects).toContainEqual({ source: "/denom-reward/airdrop", destination: "/airdrop", permanent: true });
        expect(redirects).toContainEqual({ source: "/reward/distribute", destination: "/airdrop", permanent: true });
    });
});
