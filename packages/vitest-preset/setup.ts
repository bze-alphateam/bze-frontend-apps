// Shared Vitest setup for the Next.js apps. Runs inside each app's Vitest
// process (referenced via `setupFiles` in the preset), so its imports resolve
// from the consuming app's node_modules — every app declares these devDeps.

// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.).
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount rendered trees between tests so the jsdom DOM never leaks state.
afterEach(() => {
    cleanup();
});

// jsdom can't parse Chakra's modern CSS (@layer, color-mix, …) and emits a noisy
// "Could not parse CSS stylesheet" jsdomError (with a full stack) to stderr for
// every injected sheet. It's harmless — tests still pass — but it drowns CI logs.
// Filter just those writes; everything else on stderr passes through untouched.
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (typeof chunk === "string" && chunk.includes("Could not parse CSS stylesheet")) {
        return true;
    }
    // @ts-expect-error — forwarding the original (encoding, cb) overloads verbatim.
    return originalStderrWrite(chunk, ...rest);
}) as typeof process.stderr.write;
