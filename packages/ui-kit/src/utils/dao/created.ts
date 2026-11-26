// Reads the id and address of a new DAO from the transaction that created it
// (`bze.dao.EventDaoCreated`, a typed event: its attribute values are JSON, so a
// string comes quoted: `"\"7\""`).

export interface DaoCreated {
    id: string;
    address: string;
    txHash: string;
}

interface RawEvent {
    type?: string;
    attributes?: {key?: string; value?: string}[];
}

const unquote = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'string' || typeof parsed === 'number' ? String(parsed) : undefined;
    } catch {
        return value;
    }
}

/** The created DAO named by the events of a transaction, or null when none is there. */
export const daoCreatedFromEvents = (events: unknown, txHash: string): DaoCreated | null => {
    if (!Array.isArray(events)) return null;
    for (const event of events as RawEvent[]) {
        if (!event?.type?.endsWith('EventDaoCreated')) continue;
        const attr = (name: string) => unquote(event.attributes?.find(a => a.key === name)?.value);
        const id = attr('id');
        const address = attr('address');
        if (id && /^\d+$/.test(id) && address) return {id, address, txHash};
    }
    return null;
}

/** Looks the events of a transaction up by hash (the node's REST gateway). */
export type FetchTxEvents = (txHash: string) => Promise<unknown>;

/**
 * The created DAO of a successful transaction response: from the response's own events, else from
 * the transaction as the node stored it. Null when neither names it.
 */
export const readDaoCreated = async (
    response: {txhash: string; events?: unknown},
    fetchTxEvents: FetchTxEvents,
): Promise<DaoCreated | null> => {
    const own = daoCreatedFromEvents(response.events, response.txhash);
    if (own) return own;
    try {
        return daoCreatedFromEvents(await fetchTxEvents(response.txhash), response.txhash);
    } catch {
        return null;
    }
}
