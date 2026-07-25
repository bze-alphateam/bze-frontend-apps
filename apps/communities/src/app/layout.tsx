import type {Metadata, Viewport} from "next";
import {Inter} from "next/font/google"

import {Providers} from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://communities.getbze.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Communities | BeeZee Blockchain",
  description:
    "Every token created on the BeeZee blockchain has its own community page: supply, staking rewards, burns, and a built-in way to get the token.",
  icons: {
    icon: "/images/logo_320px.png",
  },
  openGraph: {
    type: "website",
    siteName: "BeeZee Communities",
    url: "/",
    title: "Communities | BeeZee Blockchain",
    description:
      "Every token created on the BeeZee blockchain has its own community page: supply, staking rewards, burns, and a built-in way to get the token.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BeeZee Communities",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Communities | BeeZee Blockchain",
    description:
      "Every token created on the BeeZee blockchain has its own community page: supply, staking rewards, burns, and a built-in way to get the token.",
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
