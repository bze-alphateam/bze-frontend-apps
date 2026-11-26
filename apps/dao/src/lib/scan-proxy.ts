// Server side: the DAO app's `/api/scan/*` route forwards the DAO routes of BZE
// Scan's API (Scan sends no CORS headers for this app). Only the routes below
// are forwarded, each with its own list of query parameters (repeatable ones
// stay repeated). Every answer is read fresh, except a finished DAO proposal:
// its page never changes again once the chain has cleaned it up (a settled one
// still gains its cleanup, its votes and a retry), so only a cleaned-up one is
// kept in memory for good and marked immutable for browsers.

export type Fetcher = (url: string, init: {signal: AbortSignal}) => Promise<Response>;

export interface ScanProxyOptions {
    /** BZE Scan's base URL (no trailing slash needed). */
    baseUrl: string;
    fetcher?: Fetcher;
    timeoutMs?: number;
    /** Most answers kept; the oldest go first. */
    maxEntries?: number;
}

const PAGE = ["cursor", "limit"];

interface Route {
    pattern: RegExp;
    /** Query parameters forwarded (all their values). */
    params: string[];
}

/** The DAO routes of Scan's /api/v1 the app reads. */
const ROUTES: Route[] = [
    {pattern: /^daos$/, params: ["type", "q", "member", "source", "pending_admin", "admin", ...PAGE]},
    {pattern: /^daos\/\d+$/, params: []},
    {pattern: /^daos\/\d+\/history$/, params: PAGE},
    {pattern: /^daos\/\d+\/proposals$/, params: ["status", ...PAGE]},
    {pattern: /^dao-proposals$/, params: ["status", ...PAGE]},
    {pattern: /^dao-proposals\/\d+$/, params: []},
    {pattern: /^dao-proposals\/\d+\/votes$/, params: ["option", ...PAGE]},
    {pattern: /^dao-votes$/, params: ["voter", ...PAGE]},
];

const IMMUTABLE = "public, max-age=31536000, immutable";
const NO_STORE = "no-store";

/** A DAO proposal that can still change: voting, or execution failed and may be retried. */
const OPEN_STATUSES = new Set(["voting", "execution_failed"]);

const json = (body: string, status: number, cacheControl: string) =>
    new Response(body, {status, headers: {"Content-Type": "application/json", "Cache-Control": cacheControl}});

/** Whether Scan's answer can be kept forever: a single DAO proposal that is finished and cleaned up. */
function isImmutable(path: string, body: unknown): boolean {
    if (!/^dao-proposals\/\d+$/.test(path)) return false;
    const {status, cleaned_height: cleaned} = (body ?? {}) as {status?: unknown; cleaned_height?: unknown};
    return typeof status === "string" && status !== "" && !OPEN_STATUSES.has(status) && typeof cleaned === "number" && cleaned > 0;
}

export function createScanProxyHandler(options: ScanProxyOptions) {
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    const timeoutMs = options.timeoutMs ?? 8_000;
    const maxEntries = options.maxEntries ?? 1_000;
    const cache = new Map<string, string>();

    const GET = async (req: Request, context: {params: Promise<{path: string[]}>}): Promise<Response> => {
        const path = (await context.params).path.join("/");
        const route = ROUTES.find((r) => r.pattern.test(path));
        if (!route) return json('{"error":"not found"}', 404, NO_STORE);

        const incoming = new URL(req.url).searchParams;
        const query = new URLSearchParams();
        for (const key of route.params) {
            for (const value of incoming.getAll(key)) {
                if (value) query.append(key, value);
            }
        }
        const target = `${baseUrl}/api/v1/${path}${query.size ? `?${query}` : ""}`;

        const cached = cache.get(target);
        if (cached !== undefined) return json(cached, 200, IMMUTABLE);

        let response: Response;
        let text: string;
        try {
            response = await fetcher(target, {signal: AbortSignal.timeout(timeoutMs)});
            text = await response.text();
        } catch (e) {
            console.error("[scan-proxy] error:", e);
            return json('{"error":"BZE Scan unavailable"}', 502, NO_STORE);
        }
        if (!response.ok) {
            // 400 is Scan refusing the request (an invalid address, an unknown status): the app reads it.
            const status = response.status === 404 || response.status === 400 ? response.status : 502;
            return json(text, status, NO_STORE);
        }

        let body: unknown;
        try {
            body = JSON.parse(text);
        } catch {
            return json('{"error":"BZE Scan answered with invalid JSON"}', 502, NO_STORE);
        }
        if (!isImmutable(path, body)) return json(text, 200, NO_STORE);

        if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
        cache.set(target, text);
        return json(text, 200, IMMUTABLE);
    };

    return {GET};
}
