import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {test as base, expect, type Route} from "@playwright/test";

// Network mock for the factory e2e suite (BFE-143).
//
// The e2e build (.env.e2e) points every chain and aggregator call at fake *.e2e.test hosts.
// This fixture answers those hosts from the JSON files in e2e/fixtures/<lcd|agg>/ and fails
// the test, naming every URL, when the app asks for something no fixture covers. The RPC host
// has no fixtures: its WebSocket is closed on connect and the app must render without it.
// Requests to any other non-local host (logos, wallet SDKs) are aborted so no spec depends
// on the internet; they are listed in the test's annotations.

export const MOCKED_HOSTS = {
    lcd: "lcd.e2e.test",
    agg: "agg.e2e.test",
    rpc: "rpc.e2e.test",
} as const;

export type MockedHost = keyof typeof MOCKED_HOSTS;

/** One recorded answer; the envelope written by e2e/support/record-fixture.mjs. */
export interface Fixture {
    method?: string;
    path: string;
    query?: Record<string, string>;
    status: number;
    body: unknown;
}

const FIXTURES_DIR = join(__dirname, "..", "fixtures");

const CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
};

/** Method + path + query sorted by key, so the order the app writes params in never matters. */
const fixtureKey = (method: string, path: string, query: Iterable<[string, string]>): string => {
    const sorted = [...query].sort(([a], [b]) => a.localeCompare(b));
    const search = new URLSearchParams(sorted).toString();
    return `${method.toUpperCase()} ${path}${search ? `?${search}` : ""}`;
};

const keyOf = (fixture: Fixture): string =>
    fixtureKey(fixture.method ?? "GET", fixture.path, Object.entries(fixture.query ?? {}));

const loadFixtures = (host: MockedHost): Map<string, Fixture> => {
    const fixtures = new Map<string, Fixture>();
    let files: string[];
    try {
        files = readdirSync(join(FIXTURES_DIR, host)).filter((file) => file.endsWith(".json"));
    } catch {
        return fixtures;
    }

    for (const file of files) {
        const fixture = JSON.parse(readFileSync(join(FIXTURES_DIR, host, file), "utf8")) as Fixture;
        const key = keyOf(fixture);
        if (fixtures.has(key)) {
            throw new Error(`e2e/fixtures/${host}/${file}: another fixture already answers ${key}`);
        }
        fixtures.set(key, fixture);
    }

    return fixtures;
};

// Loaded once per worker; specs change answers through `network.use`, never by editing these.
const RECORDED: Record<MockedHost, Map<string, Fixture>> = {
    lcd: loadFixtures("lcd"),
    agg: loadFixtures("agg"),
    rpc: loadFixtures("rpc"),
};

const hostByName = new Map<string, MockedHost>(
    (Object.entries(MOCKED_HOSTS) as [MockedHost, string][]).map(([host, name]) => [name, host]),
);

const isLocal = (hostname: string): boolean =>
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export interface MockNetwork {
    /** Answer `fixture` on `host` for the rest of this test, ahead of the recorded fixtures. */
    use(host: MockedHost, fixture: Fixture): void;
    /**
     * The requests no fixture answered so far ("METHOD url"), and forget them so they no longer
     * fail the test. Only for specs that probe a missing route on purpose.
     */
    takeUnmatched(): string[];
}

export const test = base.extend<{ network: MockNetwork }>({
    network: [
        async ({context}, use, testInfo) => {
            const overrides: Record<MockedHost, Map<string, Fixture>> = {lcd: new Map(), agg: new Map(), rpc: new Map()};
            const unmatched = new Set<string>();
            const blocked = new Set<string>();

            const answer = async (route: Route, host: MockedHost, url: URL) => {
                const request = route.request();
                if (request.method() === "OPTIONS") {
                    await route.fulfill({status: 204, headers: CORS_HEADERS});
                    return;
                }

                const key = fixtureKey(request.method(), url.pathname, url.searchParams.entries());
                const fixture = overrides[host].get(key) ?? RECORDED[host].get(key);
                if (!fixture) {
                    unmatched.add(`${request.method()} ${url.href}`);
                    await route.fulfill({
                        status: 500,
                        headers: CORS_HEADERS,
                        contentType: "application/json",
                        body: JSON.stringify({code: 2, message: `no e2e fixture for ${key}`}),
                    });
                    return;
                }

                await route.fulfill({
                    status: fixture.status,
                    headers: CORS_HEADERS,
                    contentType: "application/json",
                    body: JSON.stringify(fixture.body),
                });
            };

            await context.route("**/*", async (route) => {
                const url = new URL(route.request().url());
                if (url.protocol !== "http:" && url.protocol !== "https:") {
                    await route.continue();
                    return;
                }

                const host = hostByName.get(url.hostname);
                if (host) {
                    await answer(route, host, url);
                    return;
                }

                if (isLocal(url.hostname)) {
                    await route.continue();
                    return;
                }

                blocked.add(`${route.request().method()} ${url.href}`);
                await route.abort("blockedbyclient");
            });

            // RPC subscriptions (block/tx listeners) never connect; anything else external is cut too.
            await context.routeWebSocket((url) => !isLocal(url.hostname), (ws) => ws.close());

            await use({
                use: (host, fixture) => {
                    overrides[host].set(keyOf(fixture), fixture);
                },
                takeUnmatched: () => {
                    const taken = [...unmatched];
                    unmatched.clear();
                    return taken;
                },
            });

            // Let requests started by the last step land before judging them, so a missing
            // fixture is reported by the spec that triggered it.
            for (const page of context.pages()) {
                await page.waitForLoadState("networkidle", {timeout: 5_000}).catch(() => undefined);
            }

            for (const url of blocked) {
                testInfo.annotations.push({type: "blocked external request", description: url});
            }

            expect(
                [...unmatched],
                `requests to mocked hosts without a fixture (record them with e2e/support/record-fixture.mjs):\n${[...unmatched].join("\n")}`,
            ).toEqual([]);
        },
        {auto: true},
    ],
});

export {expect};
