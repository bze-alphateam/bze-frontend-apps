import {getRestClient} from "./client";
import {isNotFound, LcdPagination, readAllPages} from "./lcd";
import {BRANDING_COLOR_KEYS, BRANDING_PALETTES} from "../constants/branding";
import type {BrandingColors, DenomBranding, DenomBrandingRecord} from "../types/branding";
import {isValidBrandingColor, isValidBrandingFont} from "../utils/branding";

/**
 * Token brand kit queries (chain v8.2.0, x/tokenfactory). The denom travels as the `?denom=`
 * query string (factory denoms contain `/`). On a node older than v8.2.0 the routes answer 501.
 */

/**
 * A kit rebuilt from the node's answer with only the fields we know, or `null` when any of them
 * breaks the chain's rules. The chain never stores such a kit, but the answer comes from whatever
 * endpoint the user configured, and its values end up in CSS, so it is not trusted blindly.
 */
function readBranding(raw: unknown): DenomBranding | null {
    const kit = raw as Partial<Record<keyof DenomBranding, unknown>> | null | undefined;
    if (!kit || typeof kit.font !== 'string' || !isValidBrandingFont(kit.font)) {
        return null;
    }

    const result = {font: kit.font} as DenomBranding;
    for (const palette of BRANDING_PALETTES) {
        const colors = kit[palette] as Partial<Record<keyof BrandingColors, unknown>> | null | undefined;
        if (!colors) {
            return null;
        }
        const read = {} as BrandingColors;
        for (const key of BRANDING_COLOR_KEYS) {
            const value = colors[key];
            if (typeof value !== 'string' || !isValidBrandingColor(value)) {
                return null;
            }
            read[key] = value;
        }
        result[palette] = read;
    }

    return result;
}

/**
 * The brand kit of `denom`, or `null` when none is stored (the chain answers NotFound) or the
 * answer is not a valid kit. Any other failure is thrown, so callers never mistake an error for
 * "no brand kit".
 */
export async function getDenomBranding(denom: string): Promise<DenomBranding | null> {
    try {
        const client = await getRestClient();
        const response = await client.bze.tokenfactory.denomBranding({denom});
        return readBranding(response.branding);
    } catch (e) {
        if (isNotFound(e)) {
            return null;
        }
        throw e;
    }
}

/** Every stored brand kit; records that are not a valid kit are dropped. Throws when the query fails. */
export async function getAllDenomBranding(): Promise<DenomBrandingRecord[]> {
    const client = await getRestClient();
    const records = await readAllPages<{denom?: unknown; branding?: unknown}>(async (pagination) => {
        const response = await client.bze.tokenfactory.allDenomBranding({pagination});
        return {
            list: response.denom_brandings as unknown as {denom?: unknown; branding?: unknown}[],
            pagination: response.pagination as unknown as LcdPagination,
        };
    });

    return records.flatMap((record) => {
        const branding = readBranding(record.branding);
        return typeof record.denom === 'string' && branding ? [{denom: record.denom, branding}] : [];
    });
}
