'use client';

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo, getAppName} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";
import {BetaWarningToast} from "@/components/beta-warning-toast";
import {GoogleTagManager} from "@next/third-parties/google";

setStorageKeyVersion('3');
setDefaultTxMemo('dex.getbze.com');

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <>
            <GoogleTagManager gtmId="G-7DRJTECDTV"/>
            <Provider>
              <SettingsProvider>
              <AssetsProvider>
                  <BlockchainListenerWrapper />
                  <TopNavBar appLabel={getAppName()} />
                    {children}
                  <Toaster />
                  <BetaWarningToast />
                  <TestnetBanner />
              </AssetsProvider>
              </SettingsProvider>
            </Provider>
        </>
    );
}
