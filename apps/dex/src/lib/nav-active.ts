// Which header item is active for a route: its own page, or one of its detail pages.

/** Detail pages and the header item they belong to. */
const NAV_PARENTS: Record<string, string> = {
    "/exchange/market": "/exchange",
    "/pools/details": "/pools",
    "/assets/details": "/assets",
    "/staking/details": "/staking",
};

export function isNavItemActive(itemHref: string, pathname: string): boolean {
    return pathname === itemHref || NAV_PARENTS[pathname] === itemHref;
}
