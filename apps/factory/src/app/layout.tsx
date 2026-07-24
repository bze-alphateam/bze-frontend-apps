'use client';

import { Inter } from "next/font/google"

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo, getAppName} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";

setStorageKeyVersion('5');
setDefaultTxMemo('factory.getbze.com');

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
      <html className={inter.className} suppressHydrationWarning>
          <head>
              <title>Factory | BeeZee Blockchain</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="description" content="The BeeZee creation workshop. Create tokens, DEX markets, liquidity pools, and staking rewards on the BeeZee blockchain — all in guided flows."/>
              <link rel="icon" href="/images/logo_320px.png"/>

              {/* Open Graph / Facebook */}
              <meta property="og:type" content="website" />
              <meta property="og:title" content="Factory | BeeZee Blockchain" />
              <meta property="og:description" content="Create tokens, DEX markets, liquidity pools, and staking rewards on the BeeZee blockchain." />
              <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/logo_320px.png`} />
              <meta property="og:url" content={process.env.NEXT_PUBLIC_SITE_URL} />
              <meta property="og:site_name" content="BeeZee Factory" />

              {/* Twitter */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content="Factory | BeeZee Blockchain" />
              <meta name="twitter:description" content="Create tokens, DEX markets, liquidity pools, and staking rewards on the BeeZee blockchain." />
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
                  <TestnetBanner />
              </AssetsProvider>
              </SettingsProvider>
            </Provider>
          </body>
      </html>
  )
}
