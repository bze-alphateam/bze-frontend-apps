import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";

const nodeRequire = createRequire(import.meta.url);

// Wagmi's `wagmi/connectors` barrel re-exports every connector (metaMask, porto, safe,
// coinbase, baseAccount, walletConnect, injected). We only use `injected` and
// `walletConnect`. The unused connector SDKs — plus solana code paths reached
// transitively via @base-org/account → @coinbase/cdp-sdk — would otherwise cause
// "module not found" errors. Alias them to an empty stub so the bundler skips them.
const UNUSED_DEPS = [
    '@metamask/connect-evm',
    'porto',
    'porto/internal',
    '@safe-global/safe-apps-sdk',
    '@safe-global/safe-apps-provider',
    '@coinbase/wallet-sdk',
    '@solana/kit',
    '@base-org/account',
];

// React-context singletons that MUST resolve to a single instance. In the pnpm monorepo,
// @bze/bze-ui-kit resolves its own duplicate copies of these (same version, but a separate
// peer-dependency context), so a provider rendered by the app isn't seen by the hook called
// inside ui-kit (e.g. "useInterChainWalletContext must be used within a InterChainProvider").
// Forcing them to this app's single copy collapses the duplicate instances. (react, react-dom,
// @chakra-ui/react and @tanstack/react-query already dedupe to one, so they're omitted.)
const SINGLETONS = [
    '@interchain-kit/react',
    '@interchain-kit/core',
    'wagmi',
    '@wagmi/core',
];
const singletonAlias: Record<string, string> = Object.fromEntries(
    SINGLETONS.flatMap((pkg) => {
        try {
            return [[pkg, path.dirname(nodeRequire.resolve(`${pkg}/package.json`))]];
        } catch {
            return [];
        }
    })
);

const nextConfig: NextConfig = {
    // Self-contained server build for the production Docker image; trace from the
    // monorepo root so workspace deps (ui-kit) land in the standalone output.
    output: "standalone",
    outputFileTracingRoot: path.join(path.dirname(new URL(import.meta.url).pathname), "../.."),
    experimental: {
        optimizePackageImports: ["@chakra-ui/react", "@bze/bze-ui-kit"]
    },
    transpilePackages: ["@bze/bze-ui-kit"],
    // Old URLs keep working; Next carries the query string over on every redirect.
    async redirects() {
        return [
            // The compounded rewards directory moved to /rewards (BFE-153), and so did the page of one
            // token's compounded reward (BFE-272: `?denom=` carries over and opens its card). The
            // schedule, airdrop and new forms keep their /denom-reward/* routes.
            { source: "/denom-reward", destination: "/rewards", permanent: false },
            { source: "/denom-reward/token", destination: "/rewards", permanent: false },
            // The Manage area became Tokens (BFE-260).
            { source: "/manage", destination: "/tokens", permanent: true },
            { source: "/manage/token", destination: "/tokens/token", permanent: true },
            // Playbooks left the app for docs.getbze.com (BFE-260, BFE-276).
            { source: "/playbooks", destination: "/", permanent: true },
        ];
    },
    turbopack: {
        resolveAlias: {
            ...Object.fromEntries(UNUSED_DEPS.map((dep) => [dep, './stubs/empty.js'])),
            ...singletonAlias,
        },
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            ...Object.fromEntries(UNUSED_DEPS.map((dep) => [dep, false])),
            ...singletonAlias,
        };
        return config;
    },
};

export default nextConfig;
