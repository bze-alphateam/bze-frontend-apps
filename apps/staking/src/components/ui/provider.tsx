"use client"

import { ChakraProvider } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

import { ChainProvider, InterchainWalletModal } from "@interchain-kit/react"
import { keplrWallet } from "@interchain-kit/keplr-extension";
import { leapWallet } from "@interchain-kit/leap-extension";
import { WCWallet } from "@interchain-kit/core";

import {getAssetLists, getWalletChainsNames, EvmProvider, createEvmConfig, createHiveGlowSystem} from "@bze/bze-ui-kit";

const evmConfig = createEvmConfig({
    projectId: '7e8510ae772ef527bd711c9bc02f0cb7',
    appName: 'BeeZee Staking',
    appUrl: 'https://staking.getbze.com',
    appIcon: 'https://staking.getbze.com/images/app-icon-512.png',
});

const walletConnect = new WCWallet(
    undefined,
    {
        projectId: '7e8510ae772ef527bd711c9bc02f0cb7',
        metadata: {
            name: "BeeZee Staking",
            description: "Stake BZE tokens and earn rewards",
            url: "https://staking.getbze.com",
            icons: [
                "https://staking.getbze.com/images/app-icon-512.png",
            ],
        },
    }
);

const system = createHiveGlowSystem('staking')

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
                        <InterchainWalletModal />
                        {children}
                    </ColorModeProvider>
                </ChakraProvider>
            </EvmProvider>
        </ChainProvider>
      )
}
