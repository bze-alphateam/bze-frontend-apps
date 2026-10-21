import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

describe("next.config redirects", () => {
    it("sends the old /denom-reward directory to /rewards, exact path only, not permanent", async () => {
        const redirects = await nextConfig.redirects!();
        expect(redirects).toContainEqual({ source: "/denom-reward", destination: "/rewards", permanent: false });
        // The token page and the forms keep their routes: no redirect matches below /denom-reward.
        expect(redirects.filter(r => r.source.startsWith("/denom-reward"))).toHaveLength(1);
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
});
