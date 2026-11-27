// Server side: the DEX app's `/api/scan/*` route forwards the two DAO reads of the staking
// dialogs to BZE Scan's API (which sends no CORS headers for this app): the DAOs that vote with
// a staking source and the open DAO proposals. Only those routes pass, each with its own query
// parameters (a repeated one stays repeated). Every answer is read fresh.

export type Fetcher = (url: string, init: {signal: AbortSignal}) => Promise<Response>;

export interface ScanProxyOptions {
    /** BZE Scan's base URL (no trailing slash needed). */
    baseUrl: string;
    fetcher?: Fetcher;
    timeoutMs?: number;
}

const PAGE = ["cursor", "limit"];

// Path pattern → the query parameters forwarded for it.
// `member` on the DAO list is only the probe for a Scan that has the `source` filter.
const ROUTES: [RegExp, string[]][] = [
    [/^daos$/, ["source", "member", ...PAGE]],
    [/^dao-proposals$/, ["status", ...PAGE]],
];

const NO_STORE = "no-store";

const json = (body: string, status: number) =>
    new Response(body, {status, headers: {"Content-Type": "application/json", "Cache-Control": NO_STORE}});

export function createScanProxyHandler(options: ScanProxyOptions) {
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    const timeoutMs = options.timeoutMs ?? 8_000;

    const GET = async (req: Request, context: {params: Promise<{path: string[]}>}): Promise<Response> => {
        const path = (await context.params).path.join("/");
        const allowed = ROUTES.find(([pattern]) => pattern.test(path))?.[1];
        if (!allowed) return json('{"error":"not found"}', 404);

        const incoming = new URL(req.url).searchParams;
        const query = new URLSearchParams();
        for (const key of allowed) {
            for (const value of incoming.getAll(key)) {
                if (value) query.append(key, value);
            }
        }
        const target = `${baseUrl}/api/v1/${path}${query.size ? `?${query}` : ""}`;

        let response: Response;
        let text: string;
        try {
            response = await fetcher(target, {signal: AbortSignal.timeout(timeoutMs)});
            text = await response.text();
        } catch (e) {
            console.error("[scan-proxy] error:", e);
            return json('{"error":"BZE Scan unavailable"}', 502);
        }
        if (!response.ok) {
            // 400 is Scan refusing the request (the probe's invalid member address): the app reads it.
            return json(text, response.status === 400 || response.status === 404 ? response.status : 502);
        }
        return json(text, 200);
    };

    return {GET};
}
