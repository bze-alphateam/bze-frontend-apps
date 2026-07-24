import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://communities.getbze.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Communities | BeeZee Blockchain",
  description:
    "Discover, join, and grow communities on the BeeZee blockchain. BeeZee Communities is coming soon.",
  icons: {
    icon: "/images/logo_320px.png",
  },
  openGraph: {
    type: "website",
    siteName: "BeeZee Communities",
    url: "/",
    title: "Communities | BeeZee Blockchain",
    description:
      "Discover, join, and grow communities on the BeeZee blockchain. BeeZee Communities is coming soon.",
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
      "Discover, join, and grow communities on the BeeZee blockchain. BeeZee Communities is coming soon.",
    images: ["/images/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
