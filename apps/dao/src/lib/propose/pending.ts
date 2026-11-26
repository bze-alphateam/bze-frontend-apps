import {draftKey, type DraftStorage} from './draft';
import {proposalIdFromTx} from './submit-result';

// The transaction a submit sent whose result was not seen (a confirmation timeout). It is remembered per DAO
// so a reload cannot turn into a second submit: the page keeps submit locked, shows the hash and asks the node.

const VERSION = 1;
const HASH = /^[0-9A-Fa-f]{64}$/;

export const pendingKey = (daoId: string): string => `${draftKey(daoId)}:pending`;

export function savePending(storage: DraftStorage | null, daoId: string, hash: string): void {
    try {
        storage?.setItem(pendingKey(daoId), JSON.stringify({v: VERSION, hash}));
    } catch {
        // the lock still holds in this page
    }
}

export function clearPending(storage: DraftStorage | null, daoId: string): void {
    try {
        storage?.removeItem(pendingKey(daoId));
    } catch {
        // nothing to clear
    }
}

/** The hash of an unconfirmed submit for this DAO; null when there is none or the entry is not a valid record. */
export function loadPending(storage: DraftStorage | null, daoId: string): string | null {
    try {
        const raw = storage?.getItem(pendingKey(daoId));
        if (!raw) return null;
        const data: unknown = JSON.parse(raw);
        if (typeof data !== 'object' || data === null) return null;
        const {v, hash} = data as {v?: unknown; hash?: unknown};
        return v === VERSION && typeof hash === 'string' && HASH.test(hash) ? hash : null;
    } catch {
        return null;
    }
}

/** Looks the events of a transaction up by hash (the node's REST gateway). */
export type FetchTxEvents = (txHash: string) => Promise<unknown>;

/**
 * The id of the proposal a transaction created: from the response's own events, else from the
 * transaction as the node stored it. Null when neither names it.
 */
export async function readProposalId(response: object, txHash: string, fetchTxEvents: FetchTxEvents): Promise<string | null> {
    const own = proposalIdFromTx(response);
    if (own) return own;
    try {
        return proposalIdFromTx({events: await fetchTxEvents(txHash)});
    } catch {
        return null;
    }
}
