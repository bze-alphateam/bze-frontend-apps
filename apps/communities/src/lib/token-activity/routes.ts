import {DENOM_PARAM, tokenPagePath} from "@/lib/token-directory";

// The token site's Token Activity pages. Like the token page, the denom (and the address or
// hash) ride in the query string, never in the path: factory denoms contain `/`.

export const ACTIVITY_PATH = "/token/activity";
export const HOLDER_PATH = "/token/holder";
export const TX_PATH = "/token/tx";

/** The id of the "Activity · T right now" section on the token page. */
export const ACTIVITY_SECTION_ID = "activity";

const withQuery = (path: string, query: Record<string, string>): string => `${path}?${new URLSearchParams(query)}`;

/** The token's Activity page. */
export const tokenActivityPath = (denom: string): string => withQuery(ACTIVITY_PATH, {[DENOM_PARAM]: denom});

/** One holder of the token. */
export const tokenHolderPath = (denom: string, address: string): string =>
    withQuery(HOLDER_PATH, {[DENOM_PARAM]: denom, address});

/** One transaction, seen from the token's site. */
export const tokenTxPath = (denom: string, hash: string): string => withQuery(TX_PATH, {[DENOM_PARAM]: denom, hash});

/** A section of the token page from another page of the token site. */
export const tokenSectionPath = (denom: string, sectionId: string): string => `${tokenPagePath(denom)}#${sectionId}`;
