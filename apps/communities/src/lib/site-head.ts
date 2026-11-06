/** The site-wide head texts, shared by the root layout and the pages that refine them. */
export const SITE_NAME = "BeeZee Communities";
export const SITE_TITLE = "Communities | BeeZee Blockchain";
export const SITE_DESCRIPTION =
    "Every token created on the BeeZee blockchain has its own community page: supply, staking rewards, burns, and a built-in way to get the token.";
export const HIDDEN_SITE_DESCRIPTION =
    "Discover, join, and grow communities on the BeeZee blockchain. BeeZee Communities is coming soon.";
/**
 * The share image's version: the first 8 hex digits of the file's SHA-256 (site-head.test.ts checks it).
 * X, Telegram, Discord, Facebook and LinkedIn cache a share image by its URL, so a new image under the
 * old URL keeps showing the old one for weeks; the version gives every image its own URL.
 * Replacing `public/images/og-image.png` means updating this value too.
 */
export const SITE_OG_IMAGE_VERSION = "f8cc6a4e";

export const SITE_OG_IMAGE = {
    url: `/images/og-image.png?v=${SITE_OG_IMAGE_VERSION}`,
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
