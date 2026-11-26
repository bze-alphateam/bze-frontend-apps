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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dao.getbze.com";
const DESCRIPTION = "Browse, join and run DAOs on the BeeZee blockchain: follow proposals, vote and manage a DAO's treasury and members.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "DAOs | BeeZee DAO",
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/images/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/images/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/images/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "BeeZee DAO",
    url: "/",
    title: "DAOs | BeeZee DAO",
    description: DESCRIPTION,
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BeeZee DAO logo, dao.getbze.com",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DAOs | BeeZee DAO",
    description: DESCRIPTION,
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
