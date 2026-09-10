import type {Metadata, Viewport} from "next";
import {Inter} from "next/font/google"

import {Providers} from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://factory.getbze.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Factory | BeeZee Blockchain",
  description: "The BeeZee creation workshop. Create tokens, DEX markets, liquidity pools, and staking rewards on the BeeZee blockchain — all in guided flows.",
  icons: {
    icon: "/images/logo_320px.png",
  },
  openGraph: {
    type: "website",
    siteName: "BeeZee Factory",
    url: "/",
    title: "Factory | BeeZee Blockchain",
    description: "Create tokens, DEX markets, liquidity pools, and staking rewards on the BeeZee blockchain.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BeeZee Factory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Factory | BeeZee Blockchain",
    description: "Create tokens, DEX markets, liquidity pools, and staking rewards on the BeeZee blockchain.",
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
          <body>
            <Providers>{children}</Providers>
          </body>
      </html>
  )
}
