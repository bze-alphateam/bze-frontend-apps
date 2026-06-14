'use client';

import { Inter } from "next/font/google"

import {Provider} from "@/components/ui/provider";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {Toaster, TestnetBanner, HubConnectorInit, SettingsProvider, setStorageKeyVersion, setDefaultTxMemo, getAppName} from "@bze/bze-ui-kit";
import {AssetsProvider} from "@/contexts/assets_context";
import {BlockchainListenerWrapper} from "@/components/blockchain-listener-wrapper";
import {BetaWarningToast} from "@/components/beta-warning-toast";
import {GoogleTagManager} from "@next/third-parties/google";

setStorageKeyVersion('3');
setDefaultTxMemo('dex.getbze.com');

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
      <html className={inter.className} suppressHydrationWarning>
          <head>
              <title>BZE DEX - Decentralized Exchange | Swap, Trade, Stake & Earn</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="description" content="BZE DEX is a comprehensive decentralized exchange platform on BeeZee blockchain. Swap tokens with AMM liquidity pools, trade on order book DEX, stake your coins, and provide liquidity to earn rewards. Fast, secure, and high-performance DeFi trading."/>
              <meta name="keywords" content="BZE, BeeZee, DEX, decentralized exchange, AMM, automated market maker, order book, DeFi, swap tokens, stake, staking, liquidity provider, liquidity pools, crypto trading, blockchain, BZE coin"/>

              {/* OpenGraph tags */}
              <meta property="og:title" content="BZE DEX - Decentralized Exchange | Swap, Trade, Stake & Earn" />
              <meta property="og:description" content="Trade on BZE DEX: Swap tokens with AMM pools, trade on order book, stake coins, and earn rewards as a liquidity provider. Built on the fast and secure BeeZee blockchain." />
              <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/DEX.png`} />
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
              <meta property="og:image:alt" content="BZE DEX - Decentralized Exchange Platform" />
              <meta property="og:url" content={process.env.NEXT_PUBLIC_SITE_URL} />
              <meta property="og:type" content="website" />
              <meta property="og:site_name" content="BZE DEX" />

              {/* Twitter Card tags */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content="BZE DEX - Decentralized Exchange | Swap, Trade, Stake & Earn" />
              <meta name="twitter:description" content="Trade on BZE DEX: Swap tokens with AMM pools, trade on order book, stake coins, and earn rewards as a liquidity provider." />
              <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL}/images/DEX.png`} />
              <meta name="twitter:image:alt" content="BZE DEX - Decentralized Exchange Platform" />

              <link rel="icon" href="/images/logo_320px.png"/>
          </head>
          <body suppressHydrationWarning>
            <GoogleTagManager gtmId="G-7DRJTECDTV"/>
            <Provider>
              <SettingsProvider>
              <AssetsProvider>
                  <BlockchainListenerWrapper />
                  <TopNavBar appLabel={getAppName()} />
                    {children}
                  <Toaster />
                  <HubConnectorInit />
                  <BetaWarningToast />
                  <TestnetBanner />
              </AssetsProvider>
              </SettingsProvider>
            </Provider>
          </body>
      </html>
  )
}