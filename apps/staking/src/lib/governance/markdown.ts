// Helpers for Markdown that anyone can write on chain. Ported from BZE Scan's
// ui/src/lib/markdown.ts.

/**
 * A URL a link may point to: http(s) and mailto only, else "" (the link is
 * dropped). Relative URLs are dropped too: they would resolve against this app.
 */
export function safeUrl(url: string): string {
    const u = url.trim();
    return /^(https?:\/\/|mailto:)/i.test(u) && !/[\s<>"]/.test(u) ? u : "";
}
