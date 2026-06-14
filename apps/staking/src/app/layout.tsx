'use client';

import { Inter } from "next/font/google"

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, HubConnectorInit, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo, getAppName} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";

setStorageKeyVersion('4');
setDefaultTxMemo('staking.getbze.com');

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
      <html className={inter.className} suppressHydrationWarning>
          <head>
              <title>Staking | BeeZee Blockchain</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="description" content="Stake your BZE tokens on the BeeZee blockchain. Delegate to validators, earn staking rewards, manage your delegations, and participate in network security."/>
              <link rel="icon" href="/images/logo_320px.png"/>

              {/* Open Graph / Facebook */}
              <meta property="og:type" content="website" />
              <meta property="og:title" content="Staking | BeeZee Blockchain" />
              <meta property="og:description" content="Stake your BZE tokens on the BeeZee blockchain. Delegate to validators, earn staking rewards, and participate in network security." />
              <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/logo_320px.png`} />
              <meta property="og:url" content={process.env.NEXT_PUBLIC_SITE_URL} />
              <meta property="og:site_name" content="BeeZee Staking" />

              {/* Twitter */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content="Staking | BeeZee Blockchain" />
              <meta name="twitter:description" content="Stake your BZE tokens on the BeeZee blockchain. Delegate to validators, earn staking rewards, and participate in network security." />
              <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/logo_320px.png`} />
          </head>
          <body>
            <Provider>
              <SettingsProvider>
              <AssetsProvider>
                  <BlockchainListenerWrapper />
                  <TopNavBar appLabel={getAppName()} />
                    {children}
                  <Toaster />
                  <HubConnectorInit />
                  <TestnetBanner />
              </AssetsProvider>
              </SettingsProvider>
            </Provider>
          </body>
      </html>
  )
}
