import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import type { UserConfig } from "vitest/config";

// This file's own directory, resolved from its URL so the shared setup path is
// correct no matter which app imports the preset.
const presetDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Shared Vitest preset for the Next.js apps (dex, staking, burner, factory,
 * communities). Each app's `vitest.config.ts` calls this with its own root dir:
 *
 *   import { fileURLToPath } from "node:url";
 *   import { createAppVitestConfig } from "@bze/vitest-preset";
 *   export default createAppVitestConfig(fileURLToPath(new URL(".", import.meta.url)));
 *
 * It wires up the React plugin (JSX/TSX), a jsdom DOM for component tests, the
 * `@/*` -> `src/*` path alias every app uses, and the jest-dom matcher setup.
 *
 * Tests import { describe, it, expect } from "vitest" explicitly (no globals),
 * matching the ui-kit convention — this keeps ESLint happy without extra config
 * and avoids polluting the apps' `next build` type-check with test globals.
 *
 * `UserConfig` is a type-only import, so this module's only runtime dependency
 * is `@vitejs/plugin-react`; `vitest`, `jsdom` and the Testing Library packages
 * are resolved from the consuming app (which declares them as devDependencies).
 */
export function createAppVitestConfig(appDir: string): UserConfig {
    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.join(appDir, "src"),
            },
        },
        test: {
            environment: "jsdom",
            include: ["src/**/*.test.{ts,tsx}"],
            setupFiles: [path.join(presetDir, "setup.ts")],
            // Apps that haven't written any tests yet still expose a `test`
            // script (so `turbo run test` covers them); don't fail on zero tests.
            passWithNoTests: true,
        },
    };
}
