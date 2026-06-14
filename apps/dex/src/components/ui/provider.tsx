"use client"

import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

import { ChainProvider } from "@interchain-kit/react"
import { keplrWallet } from "@interchain-kit/keplr-extension";
import { leapWallet } from "@interchain-kit/leap-extension";
import { WCWallet } from "@interchain-kit/core";

import {getAssetLists, getWalletChainsNames, EvmProvider, createEvmConfig} from "@bze/bze-ui-kit";

const evmConfig = createEvmConfig({
    projectId: '7e8510ae772ef527bd711c9bc02f0cb7',
    appName: 'BeeZee DEX',
    appUrl: 'https://dex.getbze.com',
    appIcon: 'https://dex.getbze.com/images/logo_320px.png',
});

const walletConnect = new WCWallet(
    undefined,
    {
        projectId: '7e8510ae772ef527bd711c9bc02f0cb7',
        metadata: {
            name: "BeeZee DEX",
            description: "DEX & More",
            url: "https://dex.getbze.com",
            icons: [
                "https://dex.getbze.com/images/logo_320px.png",
            ],
        },
    }
);

const system = createSystem(defaultConfig, {
  globalCss: {
    body: {
      colorPalette: 'blue',
    },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: 'var(--font-inter)' },
      },
    },
    semanticTokens: {
      radii: {
        l1: { value: '0.375rem' },
        l2: { value: '0.5rem' },
        l3: { value: '0.75rem' },
      },
    },
  },
})

export function Provider({ children, ...props }: ColorModeProviderProps & { children: React.ReactNode }) {
    return (
        <ChainProvider
            wallets={[keplrWallet, leapWallet, walletConnect]}
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
                        {children}
                    </ColorModeProvider>
                </ChakraProvider>
            </EvmProvider>
        </ChainProvider>
      )
}
