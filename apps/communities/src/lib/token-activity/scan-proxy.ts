// Server side: the communities app's `/api/scan/*` route forwards the Token Activity reads to
// BZE Scan's `/api/v1` (which sends no CORS headers for this app). Only the routes the token
// site reads pass, each with its own query parameters; Scan's own Cache-Control rides along on
// a 200 (a found transaction and the module list are cached a minute), anything else is no-store.

export type Fetcher = (url: string, init: {signal: AbortSignal}) => Promise<Response>;

export interface ScanProxyOptions {
    /** BZE Scan's base URL (no trailing slash needed). */
    baseUrl: string;
    fetcher?: Fetcher;
    timeoutMs?: number;
}

const PAGE = ["cursor", "limit"];
const ADDRESS = "bze1[02-9ac-hj-np-z]{38,58}";

// Path pattern → the query parameters forwarded for it.
const ROUTES: [RegExp, string[]][] = [
    [/^token$/, ["denom"]],
    [/^token\/(transfers|events|holders)$/, ["denom", ...PAGE]],
    [new RegExp(`^accounts/${ADDRESS}$`), []],
    [new RegExp(`^accounts/${ADDRESS}/activity$`), ["denom", "category", "page", ...PAGE]],
    [/^txs\/[0-9A-Fa-f]{64}$/, []],
    [/^modules$/, []],
];

const NO_STORE = "no-store";

const json = (body: string, status: number, cacheControl: string) =>
    new Response(body, {status, headers: {"Content-Type": "application/json", "Cache-Control": cacheControl}});

const errorBody = (code: string, message: string) => JSON.stringify({error: {code, message}});

export function createScanProxyHandler(options: ScanProxyOptions) {
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    const timeoutMs = options.timeoutMs ?? 8_000;

    const GET = async (req: Request, context: {params: Promise<{path: string[]}>}): Promise<Response> => {
        const path = (await context.params).path.join("/");
        const allowed = ROUTES.find(([pattern]) => pattern.test(path))?.[1];
        if (!allowed) return json(errorBody("not_found", "not found"), 404, NO_STORE);

        const incoming = new URL(req.url).searchParams;
        const query = new URLSearchParams();
        for (const key of allowed) {
            const value = incoming.get(key);
            if (value) query.set(key, value);
        }
        const target = `${baseUrl}/api/v1/${path}${query.size ? `?${query}` : ""}`;

        let response: Response;
        let text: string;
        try {
            response = await fetcher(target, {signal: AbortSignal.timeout(timeoutMs)});
            text = await response.text();
        } catch (e) {
            console.error("[scan-proxy] error:", e);
            return json(errorBody("upstream_error", "BZE Scan unavailable"), 502, NO_STORE);
        }

        // Scan's own 400 and 404 mean something to the page (bad denom, tx not indexed yet).
        if (!response.ok) {
            const status = response.status === 400 || response.status === 404 ? response.status : 502;
            return json(text, status, NO_STORE);
        }
        return json(text, 200, response.headers.get("Cache-Control") ?? NO_STORE);
    };

    return {GET};
}
