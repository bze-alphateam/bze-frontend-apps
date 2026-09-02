import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    // Self-contained server build for the production Docker image; trace from the
    // monorepo root so workspace deps (ui-kit) land in the standalone output.
    output: "standalone",
    outputFileTracingRoot: path.join(path.dirname(new URL(import.meta.url).pathname), "../.."),
};

export default nextConfig;
