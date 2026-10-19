import type {Metadata, Viewport} from "next";
import {Inter, JetBrains_Mono} from "next/font/google"

import {Providers} from "./providers";
import {UnderConstruction} from "@/components/under-construction/under-construction";
import {isCommunitiesEnabled} from "@/lib/app-gate";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://communities.getbze.com";

// Release gate (NEXT_PUBLIC_COMMUNITIES_ENABLED, inlined at build time, hidden unless `true`): a hidden build
// serves the "under construction" placeholder on every route and never mounts the app
// providers, so no wallet / RPC / WebSocket code runs on a deployment that isn't public yet.
const APP_ENABLED = isCommunitiesEnabled();

const DESCRIPTION = APP_ENABLED
  ? "Every token created on the BeeZee blockchain has its own community page: supply, staking rewards, burns, and a built-in way to get the token."
  : "Discover, join, and grow communities on the BeeZee blockchain. BeeZee Communities is coming soon.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Communities | BeeZee Blockchain",
  description: DESCRIPTION,
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
      <html className={`${inter.className} ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
          <body>
            {APP_ENABLED ? <Providers>{children}</Providers> : <UnderConstruction/>}
          </body>
      </html>
  )
}
