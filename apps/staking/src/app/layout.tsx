import type {Metadata, Viewport} from "next";
import {Inter, JetBrains_Mono} from "next/font/google"

import {Providers} from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
  variable: "--font-mono",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://staking.getbze.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Staking | BeeZee Blockchain",
  description: "Stake your BZE tokens on the BeeZee blockchain. Delegate to validators, earn staking rewards, manage your delegations, and participate in network security.",
  icons: {
    icon: "/images/logo_320px.png",
  },
  openGraph: {
    type: "website",
    siteName: "BeeZee Staking",
    url: "/",
    title: "Staking | BeeZee Blockchain",
    description: "Stake your BZE tokens on the BeeZee blockchain. Delegate to validators, earn staking rewards, and participate in network security.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BeeZee Staking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Staking | BeeZee Blockchain",
    description: "Stake your BZE tokens on the BeeZee blockchain. Delegate to validators, earn staking rewards, and participate in network security.",
    images: ["/images/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
      <html className={`${inter.className} ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
          <body>
            <Providers>{children}</Providers>
          </body>
      </html>
  )
}
