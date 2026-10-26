/** The token site's colours: the `--ts-*` variables set by `TokenSiteTheme` (Business Logic R1). */
export const ts = {
    bg: "var(--ts-bg)",
    fg: "var(--ts-fg)",
    pri: "var(--ts-pri)",
    /** The primary 25 % darker: the end of the gradient. */
    pri2: "var(--ts-pri2)",
    sec: "var(--ts-sec)",
    onPri: "var(--ts-on-pri)",
    onSec: "var(--ts-on-sec)",
    muted: "var(--ts-muted)",
    card: "var(--ts-card)",
    border: "var(--ts-border)",
    /** A recessed block inside a card (stat tiles, the position column). */
    inset: "var(--ts-inset)",
    danger: "var(--ts-danger)",
    font: "var(--ts-font)",
    /** Hive Glow in the kit's colours (`tokenSiteGlow`): buttons, featured edge, hero word, glow. */
    gradient: "var(--ts-gradient)",
    heroGradient: "var(--ts-hero-gradient)",
    glow: "var(--ts-glow)",
} as const;

/** The 24h change colours: the shared up/down data colours, grey when flat (never the kit's). */
export const tsChangeColor = (change: number) => (change > 0 ? "hg.up" : change < 0 ? "hg.down" : ts.muted);

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

/** Section eyebrow: the small label above a section title, a little wider and bolder. */
export const tsEyebrow = {
    ...tsLabel,
    letterSpacing: "0.14em",
    fontWeight: 700,
} as const;

/** Page width and side padding shared by the header, sections and footer (the Hive Glow container). */
export const tsContainer = {
    maxW: "1200px",
    mx: "auto",
    px: {base: "16px", md: "24px"},
} as const;
