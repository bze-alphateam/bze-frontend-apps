'use client';

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";

setStorageKeyVersion('4');
setDefaultTxMemo('staking.getbze.com');

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <Provider>
          <SettingsProvider>
          <AssetsProvider>
              <BlockchainListenerWrapper />
              <TopNavBar />
                {children}
              <Toaster />
              <TestnetBanner />
          </AssetsProvider>
          </SettingsProvider>
        </Provider>
    );
}
