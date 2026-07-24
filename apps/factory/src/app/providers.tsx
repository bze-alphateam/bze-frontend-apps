'use client';

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo, getAppName} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";

setStorageKeyVersion('5');
setDefaultTxMemo('factory.getbze.com');

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <Provider>
          <SettingsProvider>
          <AssetsProvider>
              <BlockchainListenerWrapper />
              <TopNavBar appLabel={getAppName()} />
                {children}
              <Toaster />
              <TestnetBanner />
          </AssetsProvider>
          </SettingsProvider>
        </Provider>
    );
}
