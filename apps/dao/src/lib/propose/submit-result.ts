interface EventAttribute {
    key?: unknown;
    value?: unknown;
}

interface TxEvent {
    type?: unknown;
    attributes?: unknown;
}

const decodeBase64 = (text: string): string | null => {
    try {
        return typeof atob === 'function' ? atob(text) : null;
    } catch {
        return null;
    }
};

const unquote = (text: string): string => text.replace(/^"|"$/g, '');

/**
 * The id of the proposal a submit transaction created, from its `EventProposalSubmitted` event (the
 * typed event writes its values as JSON, so the id arrives quoted). Null when the response carries no
 * such event; the caller then sends the user to the DAO's proposals instead of a guessed page.
 */
export function proposalIdFromTx(response: object | null | undefined): string | null {
    const events: unknown = (response as {events?: unknown} | null | undefined)?.events;
    if (!Array.isArray(events)) return null;

    for (const event of events as TxEvent[]) {
        if (typeof event?.type !== 'string' || !event.type.endsWith('EventProposalSubmitted') || !Array.isArray(event.attributes)) continue;
        for (const attribute of event.attributes as EventAttribute[]) {
            if (typeof attribute?.key !== 'string' || typeof attribute.value !== 'string') continue;
            const plain = attribute.key === 'id';
            const encoded = !plain && decodeBase64(attribute.key) === 'id';
            if (!plain && !encoded) continue;
            const value = unquote(plain ? attribute.value : (decodeBase64(attribute.value) ?? attribute.value));
            if (/^\d+$/.test(value)) return value;
        }
    }
    return null;
}
