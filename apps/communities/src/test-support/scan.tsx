import React from "react";
import {vi} from "vitest";
import {render} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

import {ScanClientProvider} from "@/hooks/token-activity";
import {type ScanClient, ScanError} from "@/lib/token-activity";

/** A Scan client whose every read fails as Scan being down, unless `reads` answers it. */
export function scanClient(reads: Partial<ScanClient> = {}): ScanClient {
    const down = () => vi.fn(async () => {
        throw new ScanError("BZE Scan unreachable", 0);
    });

    return {
        token: down(),
        tokenTransfers: down(),
        tokenEvents: down(),
        tokenHolders: down(),
        account: down(),
        accountActivity: down(),
        tx: down(),
        modules: down(),
        ...reads,
    } as ScanClient;
}

/**
 * Renders `ui` with Chakra, a fresh QueryClient and `client` as the Scan client. The Scan hooks
 * keep their own retries (twice on a failure), so retries run without a delay here.
 */
export function renderWithScan(ui: React.ReactElement, client: ScanClient) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false, retryDelay: 0}}});

    return render(
        <ChakraProvider value={defaultSystem}>
            <QueryClientProvider client={queryClient}>
                <ScanClientProvider client={client}>{ui}</ScanClientProvider>
            </QueryClientProvider>
        </ChakraProvider>,
    );
}
