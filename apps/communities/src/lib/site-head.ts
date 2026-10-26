/** The site-wide head texts, shared by the root layout and the pages that refine them. */
export const SITE_NAME = "BeeZee Communities";
export const SITE_TITLE = "Communities | BeeZee Blockchain";
export const SITE_DESCRIPTION =
    "Every token created on the BeeZee blockchain has its own community page: supply, staking rewards, burns, and a built-in way to get the token.";
export const HIDDEN_SITE_DESCRIPTION =
    "Discover, join, and grow communities on the BeeZee blockchain. BeeZee Communities is coming soon.";
export const SITE_OG_IMAGE = {
    url: "/images/og-image.png",
    width: 1200,
    height: 630,
    alt: "BeeZee Communities logo, communities.getbze.com",
};

/**
 * A testnet build (`NEXT_PUBLIC_CHAIN_IS_TESTNET`, inlined at build time) asks search engines not to
 * index it, so testnet pages never compete with mainnet ones.
 */
export function isTestnetBuild(): boolean {
    const raw = process.env.NEXT_PUBLIC_CHAIN_IS_TESTNET;
    return raw === "true" || raw === "1";
}
