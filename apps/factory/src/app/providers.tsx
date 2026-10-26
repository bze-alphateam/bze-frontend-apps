'use client';

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";
import {PendingTxProvider} from "@/contexts/pending-tx";

setStorageKeyVersion('5');
setDefaultTxMemo('factory.getbze.com');

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <Provider>
          <SettingsProvider>
          <AssetsProvider>
          <PendingTxProvider>
              <BlockchainListenerWrapper />
              <TopNavBar />
                {children}
              <Toaster />
              <TestnetBanner />
          </PendingTxProvider>
          </AssetsProvider>
          </SettingsProvider>
        </Provider>
    );
}
