/**
 * Release gate for the Communities app.
 *
 * `NEXT_PUBLIC_COMMUNITIES_ENABLED` decides whether a build serves the real app or
 * the "under construction" placeholder. It lets `develop` merge into `main` while the
 * public mainnet deployment stays hidden: the mainnet flavor sets it to `false`, every
 * other flavor leaves it unset (or `true`).
 *
 * Only the literal string `false` (any casing, surrounding whitespace ignored) hides the
 * app — the default is enabled, so a missing or misspelled value never accidentally
 * takes the app offline. Read via a static `process.env.NEXT_PUBLIC_*` access so Next.js
 * inlines it at build time.
 */
export function isCommunitiesEnabled(): boolean {
    const raw = process.env.NEXT_PUBLIC_COMMUNITIES_ENABLED;
    if (raw === undefined) {
        return true;
    }

    return raw.trim().toLowerCase() !== "false";
}
