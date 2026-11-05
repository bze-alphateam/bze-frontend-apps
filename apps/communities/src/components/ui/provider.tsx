"use client"

import { ChakraProvider } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

import { ChainProvider } from "@interchain-kit/react"
import { beePocketWallet } from "@bze/beepocket-connector";
import { keplrWallet } from "@interchain-kit/keplr-extension";
import { leapWallet } from "@interchain-kit/leap-extension";
import { WCWallet } from "@interchain-kit/core";

import {getAssetLists, getWalletChainsNames, EvmProvider, createEvmConfig, createHiveGlowSystem, splitComingSoonWallets, WalletPickModal} from "@bze/bze-ui-kit";

const evmConfig = createEvmConfig({
    projectId: '7e8510ae772ef527bd711c9bc02f0cb7',
    appName: 'BeeZee Communities',
    appUrl: 'https://communities.getbze.com',
    appIcon: 'https://communities.getbze.com/images/app-icon-512.png',
});

const walletConnect = new WCWallet(
    undefined,
    {
        projectId: '7e8510ae772ef527bd711c9bc02f0cb7',
        metadata: {
            name: "BeeZee Communities",
            description: "Dedicated pages for the token communities of the BeeZee blockchain",
            url: "https://communities.getbze.com",
            icons: [
                "https://communities.getbze.com/images/app-icon-512.png",
            ],
        },
    }
);

// BeePocket stays "Coming soon" (listed, not connectable) unless NEXT_PUBLIC_BEEPOCKET_ENABLED=true.
const {wallets, comingSoon} = splitComingSoonWallets([beePocketWallet, keplrWallet, leapWallet, walletConnect])

const system = createHiveGlowSystem('communities')

export function Provider({ children, ...props }: ColorModeProviderProps & { children: React.ReactNode }) {
    return (
        <ChainProvider
            wallets={wallets}
            signerOptions={{
                preferredSignType: () => {
                    return 'amino';
                }
            }}
            chains={getWalletChainsNames()}
            assetLists={getAssetLists()}
        >
            <EvmProvider config={evmConfig}>
                <ChakraProvider value={system}>
                    <ColorModeProvider {...props} >
                        <WalletPickModal comingSoonWallets={comingSoon} />
                        {children}
                    </ColorModeProvider>
                </ChakraProvider>
            </EvmProvider>
        </ChainProvider>
      )
}
