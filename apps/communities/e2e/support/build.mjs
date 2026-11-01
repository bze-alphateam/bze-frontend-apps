#!/usr/bin/env node
// `pnpm e2e:build`: production build of the app with the NEXT_PUBLIC_* values of .env.e2e
// (BFE-124). The values go into the environment of `next build` (which wins over any local
// .env), not into NODE_OPTIONS: Next forwards node flags to its workers, which reject
// --env-file.

import {spawnSync} from "node:child_process";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.loadEnvFile(join(appDir, ".env.e2e"));

// The shared chain feed worker (BFE-291) is served from public/; fail the build when it is missing.
const copy = spawnSync("node", [join(appDir, "..", "..", "packages", "ui-kit", "scripts", "copy-chain-feed-worker.mjs")], {cwd: appDir, stdio: "inherit"});
if (copy.status !== 0) process.exit(copy.status ?? 1);

const result = spawnSync("next", ["build", "--webpack"], {cwd: appDir, stdio: "inherit", env: process.env, shell: process.platform === "win32"});
process.exit(result.status ?? 1);
