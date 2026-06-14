'use client';

import { Inter } from "next/font/google"

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, HubConnectorInit, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo, getAppName} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";
import {GoogleTagManager} from "@next/third-parties/google";

setStorageKeyVersion('2');
setDefaultTxMemo('burner.getbze.com');

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
      <html className={inter.className} suppressHydrationWarning>
          <head>
              <title>🔥Burner | BeeZee Blockchain</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="description" content="BZE is a community-driven network committed to reducing supply through regular token burns, often executed via governance proposals. Taxes from token creation, trading, and other on-chain activity are directed to the community pool or burn address. The Burner App also features burning raffles, where users can voluntarily contribute tokens for a chance to win a share of the burned amount — combining deflationary impact with gamified incentives."/>
              <link rel="icon" href="/images/logo_320px.png"/>

              {/* Open Graph / Facebook */}
              <meta property="og:type" content="website" />
              <meta property="og:title" content="🔥Burner | BeeZee Blockchain" />
              <meta property="og:description" content="BZE is a community-driven network committed to reducing supply through regular token burns. Features burning raffles where users can contribute tokens for a chance to win." />
              <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/bee-burning-coins.png`} />
              <meta property="og:url" content={process.env.NEXT_PUBLIC_SITE_URL} />
              <meta property="og:site_name" content="BeeZee Burner" />

              {/* Twitter */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content="🔥Burner | BeeZee Blockchain" />
              <meta name="twitter:description" content="BZE is a community-driven network committed to reducing supply through regular token burns. Features burning raffles where users can contribute tokens for a chance to win." />
              <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/bee-burning-coins.png`} />
          </head>
          <body>
            <GoogleTagManager gtmId="G-7DRJTECDTV"/>
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