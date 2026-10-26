import type {Metadata} from "next";

import {SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE} from "@/lib/site-head";

/** What a token page's head needs from the chain's bank denom metadata. */
export interface TokenHeadData {
    name: string;
    ticker: string;
    description: string;
}

/** Where the token page reads its head data from. `undefined` = no metadata for the denom (or the lookup failed). */
export interface TokenHeadSource {
    get(denom: string): Promise<TokenHeadData | undefined>;
}

const DESCRIPTION_MAX = 200;

/** The page's own URL, relative to `metadataBase`; the denom is a query value, so its slashes are encoded. */
export const tokenPagePath = (denom: string) => `/token?denom=${encodeURIComponent(denom)}`;

interface BankMetadata {
    name?: string;
    symbol?: string;
    display?: string;
    description?: string;
}

/**
 * Reads bank denom metadata over REST: `denoms_metadata_by_query_string`, because factory denoms
 * carry slashes that break the path-param form. The answer is cached for `revalidate` seconds so
 * shared links don't hit the node on every view, and a slow node gives up after `timeoutMs`.
 */
export function restTokenHeadSource(
    restUrl: string,
    {fetchFn = fetch, revalidate = 300, timeoutMs = 3000}: {fetchFn?: typeof fetch; revalidate?: number; timeoutMs?: number} = {},
): TokenHeadSource {
    const base = restUrl.replace(/\/+$/, "");

    return {
        async get(denom) {
            if (!base) {
                return undefined;
            }

            try {
                const resp = await fetchFn(
                    `${base}/cosmos/bank/v1beta1/denoms_metadata_by_query_string?denom=${encodeURIComponent(denom)}`,
                    {next: {revalidate}, signal: AbortSignal.timeout(timeoutMs)} as RequestInit,
                );
                if (!resp.ok) {
                    return undefined;
                }

                const meta = ((await resp.json()) as {metadata?: BankMetadata}).metadata;
                const ticker = (meta?.symbol || meta?.display || "").toUpperCase();
                if (!meta?.name || !ticker) {
                    return undefined;
                }

                return {name: meta.name, ticker, description: (meta.description ?? "").trim()};
            } catch {
                return undefined;
            }
        },
    };
}

function pageDescription({name, ticker, description}: TokenHeadData): string {
    const pitch = `Stake, earn and burn ${ticker} on the BeeZee blockchain.`;
    if (!description) {
        return `${name} (${ticker}) on BeeZee Communities. ${pitch}`;
    }

    const text = `${description.replace(/[.\s]+$/, "")}. ${pitch}`;
    return text.length <= DESCRIPTION_MAX ? text : `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

/**
 * The token page's head. A known token gets its own title, description and canonical URL (OG and
 * Twitter follow); anything that isn't a factory denom has no site and is kept out of search; a
 * factory denom without metadata keeps the site-wide texts with its own URL.
 */
export async function tokenPageMetadata(denom: string | undefined, source: TokenHeadSource): Promise<Metadata> {
    if (!denom || !denom.startsWith("factory/")) {
        return {robots: {index: false, follow: true}};
    }

    const url = tokenPagePath(denom);
    const head = await source.get(denom);
    if (!head) {
        // openGraph replaces the layout's whole block, so it repeats the site-wide texts.
        return {
            alternates: {canonical: url},
            openGraph: {type: "website", siteName: SITE_NAME, url, title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_OG_IMAGE]},
        };
    }

    const title = `${head.name} (${head.ticker}) | ${SITE_NAME}`;
    const description = pageDescription(head);

    return {
        title,
        description,
        alternates: {canonical: url},
        openGraph: {
            type: "website",
            siteName: SITE_NAME,
            url,
            title,
            description,
            images: [SITE_OG_IMAGE],
        },
        twitter: {card: "summary_large_image", title, description, images: [SITE_OG_IMAGE.url]},
    };
}
