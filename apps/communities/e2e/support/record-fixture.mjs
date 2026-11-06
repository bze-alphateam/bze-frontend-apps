#!/usr/bin/env node
// Records one e2e fixture from the real testnet services (BFE-124).
//
//   node e2e/support/record-fixture.mjs '<url the app requested>' [file-name]
//
// The app's BZE Scan route (http://localhost:3004/api/scan/...) is recorded from the testnet
// explorer's /api/v1 into e2e/fixtures/scan/, keyed by the route path the app asks for.
//
// The URL is the one the e2e build asks for, as printed by a failing spec
// ("no e2e fixture for GET https://lcd.e2e.test/..."). The mocked host is swapped
// for its real source, the answer is fetched and written to
// e2e/fixtures/<lcd|agg>/<file-name>.json in the envelope mock-network.ts reads.
// Trim the body by hand afterwards when it is bigger than the specs need.
//
// Recording only reads public endpoints; it never starts the app.

import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const SOURCES = {
    "lcd.e2e.test": {dir: "lcd", origin: "https://testnet.getbze.com"},
    "agg.e2e.test": {dir: "agg", origin: "https://getbze.com"},
};

const [, , rawUrl, rawName] = process.argv;
if (!rawUrl) {
    console.error("usage: node e2e/support/record-fixture.mjs '<mocked url>' [file-name]");
    process.exit(1);
}

const url = new URL(rawUrl);
const SCAN_ROUTE = "/api/scan/";
const isScanRoute = (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.pathname.startsWith(SCAN_ROUTE);
const source = isScanRoute ? {dir: "scan", origin: "https://testnet-explorer.getbze.com"} : SOURCES[url.hostname];
if (!source) {
    console.error(`unknown host ${url.hostname}; expected one of ${Object.keys(SOURCES).join(", ")}`);
    process.exit(1);
}

// Default name: the path's last segments plus the last segment of a `denom` param,
// e.g. bze.rewards.denom_reward.noadmin.json
const defaultName = () => {
    const parts = url.pathname.split("/").filter(Boolean).slice(-3);
    const denom = url.searchParams.get("denom") ?? url.searchParams.get("market");
    if (denom) parts.push(denom.split("/").filter(Boolean).pop());
    return parts.join(".");
};

const name = (rawName ?? defaultName()).replace(/\.json$/, "");
const sourcePath = isScanRoute ? `/api/v1/${url.pathname.slice(SCAN_ROUTE.length)}` : url.pathname;
const sourceUrl = `${source.origin}${sourcePath}${url.search}`;

const response = await fetch(sourceUrl);
const text = await response.text();
let body;
try {
    body = JSON.parse(text);
} catch {
    console.error(`${sourceUrl} answered ${response.status} with a non-JSON body`);
    process.exit(1);
}

const fixture = {
    source: sourceUrl,
    recorded: new Date().toISOString().slice(0, 10),
    method: "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    status: response.status,
    body,
};

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", source.dir);
mkdirSync(fixturesDir, {recursive: true});
const file = join(fixturesDir, `${name}.json`);
writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`${response.status} ${sourceUrl}\n -> ${file}`);
