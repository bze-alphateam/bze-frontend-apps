'use client';

import React, {createContext, useContext} from "react";

import {createScanClient, type ScanClient} from "@/lib/token-activity";

// The Scan client the Token Activity hooks read through. The app uses the default (the app's
// `/api/scan` route); tests wrap the tree in a provider with a mock.
const ScanClientContext = createContext<ScanClient>(createScanClient());

export function ScanClientProvider({client, children}: { client: ScanClient; children: React.ReactNode }) {
    return <ScanClientContext.Provider value={client}>{children}</ScanClientContext.Provider>;
}

export const useScanClient = (): ScanClient => useContext(ScanClientContext);
