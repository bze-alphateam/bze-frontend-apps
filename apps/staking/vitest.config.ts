import { fileURLToPath } from "node:url";

import { createAppVitestConfig } from "@bze/vitest-preset";

// Thin wrapper over the shared preset; passes this app's root directory so the
// `@/*` alias and test discovery resolve against apps/<app>/src.
export default createAppVitestConfig(fileURLToPath(new URL(".", import.meta.url)));
