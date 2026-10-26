/** Shared helpers for bzejs' LCD (REST) client: pagination and error classification. */
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";

const PAGE_LIMIT = 500;
// Hard stop for a misbehaving node that keeps returning a next_key.
const MAX_PAGES = 50;

export type LcdPagination = { next_key?: string | null } | undefined;

const base64ToBytes = (value: string): Uint8Array =>
    Uint8Array.from(atob(value), c => c.charCodeAt(0));

/** Reads every page of a paginated LCD route by following `pagination.next_key`. */
export async function readAllPages<T>(
    fetchPage: (pagination: PageRequest) => Promise<{ list?: T[]; pagination?: LcdPagination }>
): Promise<T[]> {
    const all: T[] = [];
    let key: Uint8Array | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
        const response = await fetchPage(PageRequest.fromPartial({key, limit: BigInt(PAGE_LIMIT)}));
        all.push(...(response.list ?? []));
        const nextKey = response.pagination?.next_key;
        if (!nextKey) break;
        key = base64ToBytes(nextKey);
    }

    return all;
}

/** gRPC NotFound reaches REST as HTTP 404 with `code: 5` in the body. */
export function isNotFound(e: unknown): boolean {
    const response = (e as { response?: { status?: number; data?: { code?: number } } })?.response;
    return response?.status === 404 || response?.data?.code === 5;
}
