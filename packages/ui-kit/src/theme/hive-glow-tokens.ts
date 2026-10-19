// Values from Official-BZEdge-Graphics: beezee/apps/theme/tokens.json (Hive Glow). Change them there first, then copy here.
import type { BrandedAppKey } from '../constants/app-identity';

/** The five dapps that carry a Hive Glow theme. The explorer has its own look. */
export type HiveGlowAppKey = Exclude<BrandedAppKey, 'explorer'>;

export type ColorPair = readonly [string, string];

export interface HiveGlowAppColors {
    /** The icon pair: hero glow, hero word, icon tiles, featured edge. */
    gradient: ColorPair;
    /** App name and eyebrow on dark. */
    onDark: string;
    /** Primary button gradient (Staking's deeper pair, the icon pair elsewhere). */
    button: ColorPair;
    /** Text on the button gradient (dark mode). */
    buttonText: string;
    buttonHover: ColorPair;
    /** Links and tinted text on dark. */
    accentText: string;
    accentTextHover: string;
    /** Light mode: buttons (white text), links, eyebrow, gradient word start. */
    ink: string;
    /** Light mode: pressed state and gradient word end. */
    inkDark: string;
    /** Light mode: small text and links on the ground (Factory only; Ink elsewhere). */
    inkTextOnGround?: string;
    /** Hero glow: horizontal centre and the strength of each stop on dark. */
    glow: { x: string; c1: number; c2: number };
}
export const HIVE_GLOW_APPS: Record<HiveGlowAppKey, HiveGlowAppColors> = {
    dex: {
        gradient: ['#12C1E1', '#1694D2'],
        onDark: '#12C1E1',
        button: ['#12C1E1', '#1694D2'],
        buttonText: '#04131C',
        buttonHover: ['#3FD0EA', '#22A4E0'],
        accentText: '#7FD8EE',
        accentTextHover: '#B5EAF6',
        ink: '#0E74AD',
        inkDark: '#0A5A87',
        glow: { x: '30%', c1: 0.26, c2: 0.08 },
    },
    staking: {
        gradient: ['#B57EDC', '#8E44AD'],
        onDark: '#B57EDC',
        button: ['#9D5BD2', '#7B3AA6'],
        buttonText: '#FFFFFF',
        buttonHover: ['#A86BDA', '#8645B3'],
        accentText: '#D2AEEC',
        accentTextHover: '#E6D0F5',
        ink: '#8E44AD',
        inkDark: '#6B2F87',
        glow: { x: '30%', c1: 0.26, c2: 0.09 },
    },
    burner: {
        gradient: ['#FF8A1F', '#E85A00'],
        onDark: '#FF8A1F',
        button: ['#FF8A1F', '#E85A00'],
        buttonText: '#1A0A00',
        buttonHover: ['#FFA040', '#F06E10'],
        accentText: '#FFB27A',
        accentTextHover: '#FFD2B0',
        ink: '#C24A00',
        inkDark: '#943800',
        glow: { x: '50%', c1: 0.24, c2: 0.09 },
    },
    factory: {
        gradient: ['#FFC933', '#E09B00'],
        onDark: '#FFC933',
        button: ['#FFC933', '#E09B00'],
        buttonText: '#1A1200',
        buttonHover: ['#FFD65C', '#EDAE10'],
        accentText: '#FFD970',
        accentTextHover: '#FFE8A8',
        ink: '#9A6A00',
        inkDark: '#745000',
        inkTextOnGround: '#8A5F00',
        glow: { x: '50%', c1: 0.2, c2: 0.07 },
    },
    communities: {
        gradient: ['#3DD07A', '#1E9150'],
        onDark: '#3DD07A',
        button: ['#3DD07A', '#1E9150'],
        buttonText: '#03170B',
        buttonHover: ['#5EDB91', '#2AA862'],
        accentText: '#7FE3A8',
        accentTextHover: '#B3F0CB',
        ink: '#1A7A43',
        inkDark: '#125C32',
        glow: { x: '50%', c1: 0.2, c2: 0.08 },
    },
};

export interface HiveGlowNeutrals {
    ground: string;
    card: string;
    cardHeader: string;
    inset: string;
    raised: string;
    iconDisc: string;
    hairline: string;
    divider: string;
    lineStrong: string;
    secondaryFill: string;
    hoverFill: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    textFaint: string;
    textDisabled: string;
    up: string;
    down: string;
    flat: string;
    info: string;
    infoText: string;
    warning: string;
    warningText: string;
    danger: string;
    dangerText: string;
    success: string;
    successText: string;
    testnetGround: string;
    testnetLine: string;
    testnetText: string;
    testnetDot: string;
    testnetPillFill: string;
    testnetPillLine: string;
    backdrop: string;
    /** The sticky header's translucent ground (Header board), blurred behind. */
    headerFill: string;
    drawerShadow: string;
    /** Menus, tooltips and toasts (CompOverlays, SurfAppsMenu). */
    popoverShadow: string;
    cardShadow: string;
    switchOff: string;
}

export const HIVE_GLOW_DARK: HiveGlowNeutrals = {
    ground: '#0A0C10',
    card: '#12151B',
    cardHeader: '#161A21',
    inset: '#1B2128',
    raised: '#232A33',
    iconDisc: '#1B2128',
    hairline: 'rgba(255,255,255,0.08)',
    divider: 'rgba(255,255,255,0.06)',
    lineStrong: 'rgba(255,255,255,0.14)',
    secondaryFill: 'rgba(255,255,255,0.04)',
    hoverFill: 'rgba(255,255,255,0.06)',
    text: '#E8ECF2',
    textSecondary: '#C9D0DA',
    textMuted: '#A3ACB9',
    textFaint: '#8A94A3',
    textDisabled: '#5C6573',
    up: '#34D399',
    down: '#F87171',
    flat: '#8A94A3',
    info: '#60A5FA',
    infoText: '#93C5FD',
    warning: '#FBBF24',
    warningText: '#FCD34D',
    danger: '#F87171',
    dangerText: '#FCA5A5',
    success: '#34D399',
    successText: '#6EE7B7',
    testnetGround: '#2A0F12',
    testnetLine: 'rgba(239,68,68,0.45)',
    testnetText: '#FFB4B4',
    testnetDot: '#F87171',
    testnetPillFill: 'rgba(239,68,68,0.14)',
    testnetPillLine: 'rgba(239,68,68,0.35)',
    backdrop: 'rgba(0,0,0,0.6)',
    headerFill: 'rgba(10,12,16,0.72)',
    drawerShadow: '-24px 0 60px -20px rgba(0,0,0,0.8)',
    popoverShadow: '0 20px 40px -20px rgba(0,0,0,0.9)',
    cardShadow: 'none',
    switchOff: '#2A313C',
};

export const HIVE_GLOW_LIGHT: HiveGlowNeutrals = {
    ground: '#F5F7FA',
    card: '#FFFFFF',
    cardHeader: '#F8FAFC',
    inset: '#EEF1F5',
    raised: '#FFFFFF',
    iconDisc: '#0F1318',
    hairline: 'rgba(20,23,28,0.10)',
    divider: 'rgba(20,23,28,0.08)',
    lineStrong: 'rgba(20,23,28,0.14)',
    secondaryFill: '#FFFFFF',
    hoverFill: 'rgba(20,23,28,0.05)',
    text: '#14171C',
    textSecondary: '#3A424E',
    textMuted: '#5B6472',
    textFaint: '#6B7482',
    textDisabled: '#9AA3AE',
    up: '#0E8A5A',
    down: '#C93636',
    flat: '#6B7482',
    info: '#2563EB',
    infoText: '#2563EB',
    warning: '#B45309',
    warningText: '#B45309',
    danger: '#C93636',
    dangerText: '#C93636',
    success: '#0E8A5A',
    successText: '#0E8A5A',
    testnetGround: '#FDECEC',
    testnetLine: 'rgba(220,38,38,0.35)',
    testnetText: '#B42318',
    testnetDot: '#DC2626',
    testnetPillFill: 'rgba(220,38,38,0.08)',
    testnetPillLine: 'rgba(220,38,38,0.30)',
    backdrop: 'rgba(20,23,28,0.45)',
    headerFill: 'rgba(255,255,255,0.86)',
    drawerShadow: '-24px 0 60px -24px rgba(20,23,28,0.35)',
    popoverShadow: '0 20px 40px -20px rgba(20,23,28,0.35)',
    cardShadow: '0 1px 2px rgba(20,23,28,0.06)',
    switchOff: '#D5DAE1',
};

/** Light mode glow strength (about 60 % of dark); inner pages use half of either. */
export const HIVE_GLOW_LIGHT_GLOW = { c1: 0.16, c2: 0.05 } as const;
export const HIVE_GLOW_INNER_FACTOR = 0.5;

/** Notices: status colour at 8 % fill, 30 % edge, 12 px radius, 16 px icon. */
export const HIVE_GLOW_NOTICE = { fillAlpha: 0.08, edgeAlpha: 0.3, radius: 12, icon: 16 } as const;

export const HIVE_GLOW_FONTS = {
    family: "Inter, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export interface HiveGlowTextStyle {
    size: number;
    weight: number;
    tracking: string;
    lineHeight: number;
    transform?: 'uppercase';
    mono?: boolean;
}

export type HiveGlowTextStyleName = 'hero' | 'pageTitle' | 'section' | 'cardTitle' | 'subtitle' | 'body' | 'small' | 'caption' | 'button' | 'eyebrow' | 'tableHead' | 'meta';

export const HIVE_GLOW_TYPE: Record<HiveGlowTextStyleName, HiveGlowTextStyle> = {
    hero: { size: 52, weight: 800, tracking: '-0.03em', lineHeight: 1.05 },
    pageTitle: { size: 36, weight: 800, tracking: '-0.02em', lineHeight: 1.1 },
    section: { size: 22, weight: 700, tracking: '0', lineHeight: 1.3 },
    cardTitle: { size: 17, weight: 700, tracking: '0', lineHeight: 1.35 },
    subtitle: { size: 18, weight: 400, tracking: '0', lineHeight: 1.55 },
    body: { size: 16, weight: 400, tracking: '0', lineHeight: 1.55 },
    small: { size: 14, weight: 400, tracking: '0', lineHeight: 1.5 },
    caption: { size: 13, weight: 400, tracking: '0', lineHeight: 1.5 },
    button: { size: 15, weight: 600, tracking: '0', lineHeight: 1 },
    eyebrow: { size: 12, weight: 700, tracking: '0.14em', lineHeight: 1.2, transform: 'uppercase' },
    tableHead: { size: 11, weight: 700, tracking: '0.08em', lineHeight: 1.2, transform: 'uppercase' },
    meta: { size: 13, weight: 500, tracking: '0', lineHeight: 1.5, mono: true },
};

/** Radii in px. */
export const HIVE_GLOW_RADIUS = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, hero: 24, pill: 999 } as const;

/** The spacing scale in px. */
export const HIVE_GLOW_SPACE = [4, 8, 12, 16, 20, 24, 32, 40, 56, 72] as const;

/** Layout sizes in px. */
export const HIVE_GLOW_LAYOUT = { container: 1200, gutter: 24, gutterPhone: 16, header: 72, headerPhone: 64, drawer: 400, testnetRibbon: 28 } as const;

/** Control heights in px: button 44 default, 40 compact, 48 hero, 32 small; inputs 48. */
export const HIVE_GLOW_CONTROL = { button: 44, buttonCompact: 40, buttonHero: 48, buttonSmall: 32, input: 48 } as const;

/** The 1 px gradient edge of the one featured card per page. */
export const HIVE_GLOW_FEATURED_EDGE = {
    angle: 160,
    c1Alpha: 0.75,
    c2Alpha: 0.18,
    c2Stop: '45%',
    restDark: 'rgba(255,255,255,0.06)',
    restLight: 'rgba(20,23,28,0.08)',
    glowShadowAlpha: 0.5,
} as const;

/** Strength of the primary button's glow shadow on dark. */
export const HIVE_GLOW_BUTTON_GLOW_ALPHA = 0.6;

/** White, for text on the Ink button in light mode. */
export const HIVE_GLOW_WHITE = '#FFFFFF';
