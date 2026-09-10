import type {Metadata, Viewport} from "next";
import {Inter} from "next/font/google"

import {Providers} from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dex.getbze.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "BZE DEX - Decentralized Exchange | Swap, Trade, Stake & Earn",
  description: "BZE DEX is a comprehensive decentralized exchange platform on BeeZee blockchain. Swap tokens with AMM liquidity pools, trade on order book DEX, stake your coins, and provide liquidity to earn rewards. Fast, secure, and high-performance DeFi trading.",
  keywords: "BZE, BeeZee, DEX, decentralized exchange, AMM, automated market maker, order book, DeFi, swap tokens, stake, staking, liquidity provider, liquidity pools, crypto trading, blockchain, BZE coin",
  icons: {
    icon: "/images/logo_320px.png",
  },
  openGraph: {
    type: "website",
    siteName: "BZE DEX",
    url: "/",
    title: "BZE DEX - Decentralized Exchange | Swap, Trade, Stake & Earn",
    description: "Trade on BZE DEX: Swap tokens with AMM pools, trade on order book, stake coins, and earn rewards as a liquidity provider. Built on the fast and secure BeeZee blockchain.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BZE DEX - Decentralized Exchange Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BZE DEX - Decentralized Exchange | Swap, Trade, Stake & Earn",
    description: "Trade on BZE DEX: Swap tokens with AMM pools, trade on order book, stake coins, and earn rewards as a liquidity provider.",
    images: ["/images/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
      <html className={inter.className} suppressHydrationWarning>
          <body suppressHydrationWarning>
            <Providers>{children}</Providers>
          </body>
      </html>
  )
}
