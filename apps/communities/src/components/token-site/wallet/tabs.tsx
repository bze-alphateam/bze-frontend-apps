'use client';

import React from "react";
import type {Asset} from "@bze/bze-ui-kit";

import type {WalletTab} from "@/hooks/token-site/useTokenWallet";

import {SendForm} from "./send-form";

interface WalletTabDefinition {
    value: WalletTab;
    label: (asset: Asset) => string;
    render: (asset: Asset) => React.ReactNode;
}

/**
 * The drawer's action tabs, in display order; the first one is shown when the requested tab
 * isn't available. Get (BFE-129) and Burn (BFE-131) each add one entry here.
 */
export const WALLET_TABS: WalletTabDefinition[] = [
    {value: "send", label: () => "Send", render: (asset) => <SendForm asset={asset}/>},
];
