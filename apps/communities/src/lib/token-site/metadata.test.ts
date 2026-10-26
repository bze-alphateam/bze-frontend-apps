import {describe, it, expect, vi} from "vitest";

import {SITE_DESCRIPTION, SITE_OG_IMAGE, SITE_TITLE} from "@/lib/site-head";

import {restTokenHeadSource, type TokenHeadData, type TokenHeadSource, tokenPageMetadata, tokenPagePath} from "./metadata";

const VDL = "factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl";
const VDL_URL = "/token?denom=factory%2Fbze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk%2Fuvdl";

const source = (head?: TokenHeadData): TokenHeadSource & {get: ReturnType<typeof vi.fn>} => ({get: vi.fn().mockResolvedValue(head)});

const response = (status: number, body: unknown) => new Response(JSON.stringify(body), {status});

describe("tokenPagePath", () => {
    it("encodes the denom's slashes in the query value", () => {
        expect(tokenPagePath(VDL)).toBe(VDL_URL);
    });
});

describe("tokenPageMetadata", () => {
    it("gives a known token its own title, description and URL", async () => {
        const meta = await tokenPageMetadata(VDL, source({name: "Vidulum", ticker: "VDL", description: "Vidulum App Token"}));

        expect(meta.title).toBe("Vidulum (VDL) | BeeZee Communities");
        expect(meta.description).toBe("Vidulum App Token. Stake, earn and burn VDL on the BeeZee blockchain.");
        expect(meta.alternates?.canonical).toBe(VDL_URL);
        expect(meta.openGraph).toMatchObject({url: VDL_URL, title: meta.title, description: meta.description, images: [SITE_OG_IMAGE]});
        expect(meta.twitter).toMatchObject({title: meta.title, description: meta.description});
        expect(meta.robots).toBeUndefined();
    });

    it("writes a description when the token has none", async () => {
        const meta = await tokenPageMetadata(VDL, source({name: "Vidulum", ticker: "VDL", description: ""}));

        expect(meta.description).toBe("Vidulum (VDL) on BeeZee Communities. Stake, earn and burn VDL on the BeeZee blockchain.");
    });

    it("shortens a long description", async () => {
        const meta = await tokenPageMetadata(VDL, source({name: "Vidulum", ticker: "VDL", description: "word ".repeat(80)}));

        expect(meta.description).toHaveLength(200);
        expect(meta.description).toMatch(/…$/);
    });

    it("keeps the site-wide texts, with the page's own URL, when the token has no metadata", async () => {
        const meta = await tokenPageMetadata(VDL, source(undefined));

        expect(meta.title).toBeUndefined();
        expect(meta.alternates?.canonical).toBe(VDL_URL);
        expect(meta.openGraph).toMatchObject({url: VDL_URL, title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_OG_IMAGE]});
        expect(meta.robots).toBeUndefined();
    });

    it("keeps pages without a factory denom out of search, without asking the node", async () => {
        for (const denom of [undefined, "", "ubze", "ibc/ABC"]) {
            const src = source();
            expect(await tokenPageMetadata(denom, src)).toEqual({robots: {index: false, follow: true}});
            expect(src.get).not.toHaveBeenCalled();
        }
    });
});

describe("restTokenHeadSource", () => {
    it("reads bank metadata by query string, cached", async () => {
        const fetchFn = vi.fn().mockResolvedValue(response(200, {
            metadata: {name: "Vidulum", symbol: "VDL", display: "VDL", description: "Vidulum App Token"},
        }));

        const head = await restTokenHeadSource("https://rest.example/", {fetchFn}).get(VDL);

        expect(head).toEqual({name: "Vidulum", ticker: "VDL", description: "Vidulum App Token"});
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`https://rest.example/cosmos/bank/v1beta1/denoms_metadata_by_query_string?denom=${encodeURIComponent(VDL)}`);
        expect(init.next).toEqual({revalidate: 300});
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("falls back to the display unit for the ticker", async () => {
        const fetchFn = vi.fn().mockResolvedValue(response(200, {metadata: {name: "Page", symbol: "", display: "page"}}));

        expect(await restTokenHeadSource("https://rest.example", {fetchFn}).get(VDL)).toEqual({name: "Page", ticker: "PAGE", description: ""});
    });

    it("returns nothing when the node has no usable metadata or fails", async () => {
        const cases = [
            vi.fn().mockResolvedValue(response(404, {code: 5})),
            vi.fn().mockResolvedValue(response(200, {metadata: {name: "", symbol: "", display: ""}})),
            vi.fn().mockRejectedValue(new Error("timeout")),
        ];

        for (const fetchFn of cases) {
            expect(await restTokenHeadSource("https://rest.example", {fetchFn}).get(VDL)).toBeUndefined();
        }
    });

    it("never calls out without a REST endpoint", async () => {
        const fetchFn = vi.fn();

        expect(await restTokenHeadSource("", {fetchFn}).get(VDL)).toBeUndefined();
        expect(fetchFn).not.toHaveBeenCalled();
    });
});
