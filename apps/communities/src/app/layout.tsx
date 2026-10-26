import type {Metadata, Viewport} from "next";
import {Inter, JetBrains_Mono} from "next/font/google"

import {Providers} from "./providers";
import {UnderConstruction} from "@/components/under-construction/under-construction";
import {isCommunitiesEnabled} from "@/lib/app-gate";
import {HIDDEN_SITE_DESCRIPTION, isTestnetBuild, SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE} from "@/lib/site-head";

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

const DESCRIPTION = APP_ENABLED ? SITE_DESCRIPTION : HIDDEN_SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: DESCRIPTION,
  robots: isTestnetBuild() ? {index: false, follow: false} : undefined,
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
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: DESCRIPTION,
    images: [SITE_OG_IMAGE.url],
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
