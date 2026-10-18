import {isFinalScanStatus} from "./governance/scan";

// Server side: the staking app's `/api/scan/*` route forwards the proposal list
// and proposal pages to BZE Scan's API (which sends no CORS headers for this
// app). A decided proposal never changes, so its page, and a list page past
// the first holding only decided ones, is kept in memory for good and marked
// immutable for browsers. Anything still open is always read fresh.

export type Fetcher = (url: string, init: {signal: AbortSignal}) => Promise<Response>;

export interface ScanProxyOptions {
    /** BZE Scan's base URL (no trailing slash needed). */
    baseUrl: string;
    fetcher?: Fetcher;
    timeoutMs?: number;
    /** Most answers kept; the oldest go first. */
    maxEntries?: number;
}

const LIST_PARAMS = ["status", "cursor", "limit"];
const IMMUTABLE = "public, max-age=31536000, immutable";

const json = (body: string, status: number, cacheControl: string) =>
    new Response(body, {status, headers: {"Content-Type": "application/json", "Cache-Control": cacheControl}});

/** Whether Scan's answer can be kept forever. */
function isImmutable(body: unknown, isList: boolean, hasCursor: boolean): boolean {
    if (isList) {
        // The first page gains every new proposal; later pages only change while an item is undecided.
        const items = (body as {items?: {status: string}[]})?.items;
        return hasCursor && Array.isArray(items) && items.every((i) => isFinalScanStatus(i.status));
    }
    return isFinalScanStatus((body as {status?: string})?.status ?? "");
}

export function createScanProxyHandler(options: ScanProxyOptions) {
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    const timeoutMs = options.timeoutMs ?? 8_000;
    const maxEntries = options.maxEntries ?? 1_000;
    const cache = new Map<string, string>();

    const GET = async (req: Request, context: {params: Promise<{path: string[]}>}): Promise<Response> => {
        const path = (await context.params).path.join("/");
        const isList = path === "proposals";
        if (!isList && !/^proposals\/\d+$/.test(path)) return json('{"error":"not found"}', 404, "no-store");

        const incoming = new URL(req.url).searchParams;
        const query = new URLSearchParams();
        if (isList) {
            for (const key of LIST_PARAMS) {
                const value = incoming.get(key);
                if (value) query.set(key, value);
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
            return json('{"error":"BZE Scan unavailable"}', 502, "no-store");
        }
        if (!response.ok) return json(text, response.status === 404 ? 404 : 502, "no-store");

        let body: unknown;
        try {
            body = JSON.parse(text);
        } catch {
            return json('{"error":"BZE Scan answered with invalid JSON"}', 502, "no-store");
        }
        if (!isImmutable(body, isList, query.has("cursor"))) return json(text, 200, "no-store");

        if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
        cache.set(target, text);
        return json(text, 200, IMMUTABLE);
    };

    return {GET};
}
