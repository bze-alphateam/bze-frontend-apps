/** The token site's colours: the `--ts-*` variables set by `TokenSiteTheme` (Business Logic R1). */
export const ts = {
    bg: "var(--ts-bg)",
    fg: "var(--ts-fg)",
    pri: "var(--ts-pri)",
    sec: "var(--ts-sec)",
    onPri: "var(--ts-on-pri)",
    onSec: "var(--ts-on-sec)",
    muted: "var(--ts-muted)",
    card: "var(--ts-card)",
    border: "var(--ts-border)",
    font: "var(--ts-font)",
} as const;

/** `color` mixed into the page background (or `base`), for the few tints the design uses. */
export const tsMix = (color: string, percent: number, base: string = ts.bg) =>
    `color-mix(in oklab, ${color} ${percent}%, ${base})`;

/** Small uppercase label used above stats and section titles. */
export const tsLabel = {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 600,
    color: ts.muted,
} as const;

/** Page width and side padding shared by the header, sections and footer. */
export const tsContainer = {
    maxW: "1240px",
    mx: "auto",
    px: {base: "20px", md: "32px"},
} as const;
