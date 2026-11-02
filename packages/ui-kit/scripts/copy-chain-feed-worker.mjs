#!/usr/bin/env node
// Copies the built SharedWorker bundle of the chain feed (ui-kit dist) to <cwd>/public so the
// app serves it as /chain-feed-worker.js. Run from an app directory before `next build`/`next dev`.
// Exits non-zero when the bundle is missing: a broken build must fail here, not ship a 404.

import {copyFileSync, existsSync, mkdirSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const source = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "chain-feed-worker.global.js");
const targetDir = join(process.cwd(), "public");

if (!existsSync(source)) {
    console.error(`chain feed worker bundle not found at ${source}; build @bze/bze-ui-kit first`);
    process.exit(1);
}

mkdirSync(targetDir, {recursive: true});
copyFileSync(source, join(targetDir, "chain-feed-worker.js"));
