/**
 * Release gate for the Communities app.
 *
 * `NEXT_PUBLIC_COMMUNITIES_ENABLED` decides whether a build serves the real app or
 * the "under construction" placeholder. It lets `develop` merge into `main` while the
 * public mainnet deployment stays hidden.
 *
 * Hidden by default: only the literal string `true` (any casing, surrounding whitespace
 * ignored) enables the app. A missing or misspelled value therefore never exposes the app
 * by accident — each flavor that should be live (testnet, local dev) opts in explicitly.
 * Read via a static `process.env.NEXT_PUBLIC_*` access so Next.js inlines it at build time.
 */
export function isCommunitiesEnabled(): boolean {
    const raw = process.env.NEXT_PUBLIC_COMMUNITIES_ENABLED;
    if (raw === undefined) {
        return false;
    }

    return raw.trim().toLowerCase() === "true";
}
