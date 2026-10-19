import type {MetadataRoute} from "next";

// The web app manifest: the app's icons (BZE disc, Factory ring and glyph), its dark gradient end as theme colour.
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "BeeZee Factory",
        short_name: "Factory",
        start_url: "/",
        display: "standalone",
        theme_color: "#E09B00",
        background_color: "#0F1318",
        icons: [
            {src: "/images/app-icon-192.png", sizes: "192x192", type: "image/png"},
            {src: "/images/app-icon-512.png", sizes: "512x512", type: "image/png"},
            {src: "/images/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
        ],
    };
}
