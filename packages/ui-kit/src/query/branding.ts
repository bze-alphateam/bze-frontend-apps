import {getRestClient} from "./client";
import {isNotFound, LcdPagination, readAllPages} from "./lcd";
import type {DenomBranding, DenomBrandingRecord} from "../types/branding";

/**
 * Token brand kit queries (chain v8.2.0, x/tokenfactory). The denom travels as the `?denom=`
 * query string (factory denoms contain `/`). On a node older than v8.2.0 the routes answer 501.
 */

/**
 * The brand kit of `denom`, or `null` when none is stored (the chain answers NotFound). Any other
 * failure is thrown, so callers never mistake an error for "no brand kit".
 */
export async function getDenomBranding(denom: string): Promise<DenomBranding | null> {
    try {
        const client = await getRestClient();
        const response = await client.bze.tokenfactory.denomBranding({denom});
        return (response.branding as unknown as DenomBranding | undefined) ?? null;
    } catch (e) {
        if (isNotFound(e)) {
            return null;
        }
        throw e;
    }
}

/** Every stored brand kit. Throws when the query fails. */
export async function getAllDenomBranding(): Promise<DenomBrandingRecord[]> {
    const client = await getRestClient();
    return readAllPages<DenomBrandingRecord>(async (pagination) => {
        const response = await client.bze.tokenfactory.allDenomBranding({pagination});
        return {
            list: response.denom_brandings as unknown as DenomBrandingRecord[],
            pagination: response.pagination as unknown as LcdPagination,
        };
    });
}
