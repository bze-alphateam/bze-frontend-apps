import type {Metadata, Viewport} from "next";
import {Inter} from "next/font/google"

import {Providers} from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://burner.getbze.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "🔥Burner | BeeZee Blockchain",
  description: "BZE is a community-driven network committed to reducing supply through regular token burns, often executed via governance proposals. Taxes from token creation, trading, and other on-chain activity are directed to the community pool or burn address. The Burner App also features burning raffles, where users can voluntarily contribute tokens for a chance to win a share of the burned amount — combining deflationary impact with gamified incentives.",
  icons: {
    icon: "/images/logo_320px.png",
  },
  openGraph: {
    type: "website",
    siteName: "BeeZee Burner",
    url: "/",
    title: "🔥Burner | BeeZee Blockchain",
    description: "BZE is a community-driven network committed to reducing supply through regular token burns. Features burning raffles where users can contribute tokens for a chance to win.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BeeZee Burner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "🔥Burner | BeeZee Blockchain",
    description: "BZE is a community-driven network committed to reducing supply through regular token burns. Features burning raffles where users can contribute tokens for a chance to win.",
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
