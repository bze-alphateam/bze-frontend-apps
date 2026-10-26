// Opt-in guard for test files that must never reach the network:
//
//   import { forbidNetwork } from "@bze/vitest-preset/no-network";
//   forbidNetwork();
//
// Every XMLHttpRequest (the LCD client goes through axios -> XHR in jsdom) and every fetch is
// recorded and left pending forever instead of being sent, and the test that made it fails
// with the list of URLs. Pending (rather than failed) requests matter: a failed request makes
// the query layer log an error, and a log landing after the file's tests are done crashes the
// Vitest worker ("Closing rpc while onUserConsoleLog was pending").
//
// Typical cause of a failure: a test seeds a ui-kit localStorage cache under a key or shape the
// query layer no longer reads, so the query falls through to the network.

import { afterAll, afterEach, beforeAll } from "vitest";

export function forbidNetwork(): void {
    const attempts: string[] = [];
    const requestUrls = new WeakMap<XMLHttpRequest, string>();
    let restore: (() => void) | undefined;

    beforeAll(() => {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalFetch = globalThis.fetch;

        XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
            requestUrls.set(this, `${method.toUpperCase()} ${String(url)}`);
            // @ts-expect-error — forwarding the original (async, user, password) overloads verbatim.
            return originalOpen.call(this, method, url, ...rest);
        } as typeof XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.send = function (this: XMLHttpRequest) {
            attempts.push(requestUrls.get(this) ?? "XHR <unknown url>");
        };
        globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            attempts.push(`${(init?.method ?? "GET").toUpperCase()} ${url}`);
            return new Promise<Response>(() => {});
        }) as typeof fetch;

        restore = () => {
            XMLHttpRequest.prototype.open = originalOpen;
            XMLHttpRequest.prototype.send = originalSend;
            globalThis.fetch = originalFetch;
        };
    });

    afterEach(() => {
        if (attempts.length === 0) return;
        const made = attempts.splice(0);
        throw new Error(`this test made network requests (forbidNetwork):\n${made.join("\n")}`);
    });

    afterAll(() => {
        restore?.();
    });
}
