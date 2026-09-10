import {getRestClient} from "./client";

/**
 * Current tokenfactory admin of a denom. Resolves to '' when the admin was
 * renounced and to undefined when the query failed — callers that show trust
 * badges must not confuse the two.
 */
export async function getFactoryDenomAdmin(denom: string): Promise<string | undefined> {
    try {
        const client = await getRestClient();
        const res = await client.bze.tokenfactory.denomAuthority({denom: denom});

        return res.denomAuthority?.admin ?? ''
    } catch (e) {
        console.error('failed to fetch admin of', denom, e);

        return undefined;
    }
}

/** Legacy variant: a failed lookup collapses to '' (looks renounced). Prefer getFactoryDenomAdmin. */
export async function getFactoryDenomAdminAddress(denom: string): Promise<string> {
    return (await getFactoryDenomAdmin(denom)) ?? ''
}
