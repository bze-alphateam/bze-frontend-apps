import {getSettings} from "../storage/settings";

/** Who controls a factory denom and whether it can still be minted. */
export interface FactoryDenomAuthority {
    /** '' when the admin was renounced. */
    admin: string;
    mintable: boolean;
}

/**
 * Tokenfactory authority of a denom. v8.3.0 nodes always answer `mintable` (false included); a
 * v8.2.0 node has no such field, where an admin-held denom can mint and a renounced one cannot.
 * Undefined when the query failed — callers that show trust badges must not confuse that with a
 * renounced denom. Raw route (not bzejs) until the SDK carries the field.
 */
export async function getFactoryDenomAuthority(denom: string): Promise<FactoryDenomAuthority | undefined> {
    try {
        const rest = getSettings().endpoints.restEndpoint.replace(/\/+$/, '');
        const res = await fetch(`${rest}/bze/tokenfactory/denom_authority?denom=${encodeURIComponent(denom)}`);
        if (!res.ok) throw new Error(`denom_authority answered ${res.status}`);
        const body = await res.json() as { denomAuthority?: { admin?: string; mintable?: boolean } };
        const admin = body.denomAuthority?.admin ?? '';

        const flag = body.denomAuthority?.mintable;

        return {admin, mintable: typeof flag === 'boolean' ? flag : admin !== ''};
    } catch (e) {
        console.error('failed to fetch authority of', denom, e);

        return undefined;
    }
}

/**
 * Current tokenfactory admin of a denom. Resolves to '' when the admin was
 * renounced and to undefined when the query failed — callers that show trust
 * badges must not confuse the two.
 */
export async function getFactoryDenomAdmin(denom: string): Promise<string | undefined> {
    return (await getFactoryDenomAuthority(denom))?.admin;
}

/** Legacy variant: a failed lookup collapses to '' (looks renounced). Prefer getFactoryDenomAdmin. */
export async function getFactoryDenomAdminAddress(denom: string): Promise<string> {
    return (await getFactoryDenomAdmin(denom)) ?? ''
}
