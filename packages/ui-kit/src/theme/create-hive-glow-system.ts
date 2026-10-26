import { createSystem, defaultConfig, defineConfig, type SystemContext } from '@chakra-ui/react';

import {
    HIVE_GLOW_APPS,
    HIVE_GLOW_BUTTON_GLOW_ALPHA,
    HIVE_GLOW_CONTROL,
    HIVE_GLOW_DARK,
    HIVE_GLOW_FEATURED_EDGE,
    HIVE_GLOW_FONTS,
    HIVE_GLOW_INNER_FACTOR,
    HIVE_GLOW_LIGHT,
    HIVE_GLOW_LIGHT_GLOW,
    HIVE_GLOW_NOTICE,
    HIVE_GLOW_RADIUS,
    HIVE_GLOW_TYPE,
    HIVE_GLOW_WHITE,
    type HiveGlowAppColors,
    type HiveGlowAppKey,
    type HiveGlowNeutrals,
} from './hive-glow-tokens';

const px = (n: number) => `${n}px`;

/** `#RRGGBB` at `alpha`, as rgba(). */
const alpha = (hex: string, a: number): string => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** A semantic value that switches with the colour mode. */
const mode = (dark: string, light: string) => ({ value: { _dark: dark, _light: light } });
/** A semantic value read from the neutral sets. */
const neutral = (key: keyof HiveGlowNeutrals) => mode(HIVE_GLOW_DARK[key], HIVE_GLOW_LIGHT[key]);

const gradient = ([from, to]: readonly [string, string]) => `linear-gradient(135deg, ${from}, ${to})`;
/** A flat colour as a gradient, so `bgImage` switches cleanly between modes. */
const flat = (color: string) => `linear-gradient(${color}, ${color})`;

const glow = (a: HiveGlowAppColors, c1: number, c2: number, ground: string) =>
    `radial-gradient(70% 80% at ${a.glow.x} 0%, ${alpha(a.gradient[0], c1)}, ${alpha(a.gradient[1], c2)} 45%, ${alpha(ground, 0)} 75%)`;

/** Fill and edge of a status tone, at the notice alphas. */
const tone = (key: 'info' | 'warning' | 'danger' | 'success') => ({
    fill: `hg.${key}/${Math.round(HIVE_GLOW_NOTICE.fillAlpha * 100)}`,
    edge: `hg.${key}/${Math.round(HIVE_GLOW_NOTICE.edgeAlpha * 100)}`,
});

/** The slots of a Chakra slot recipe, which an extension has to repeat. */
const slotsOf = (name: string): string[] => {
    const slots = defaultConfig.theme?.slotRecipes?.[name]?.slots;
    if (!slots) throw new Error(`Chakra has no "${name}" slot recipe`);
    return [...slots];
};

function appColors(a: HiveGlowAppColors) {
    const lightText = a.inkTextOnGround ?? a.ink;
    const [c1] = a.gradient;

    return {
        // The app palette, so `colorPalette="app"` (the body default) works with every Chakra recipe.
        app: {
            solid: mode(a.button[0], a.ink),
            contrast: mode(a.buttonText, HIVE_GLOW_WHITE),
            fg: mode(a.accentText, lightText),
            muted: mode(alpha(c1, 0.24), alpha(a.ink, 0.16)),
            subtle: mode(alpha(c1, 0.12), alpha(a.ink, 0.08)),
            emphasized: mode(alpha(c1, 0.32), alpha(a.ink, 0.24)),
            border: mode(alpha(c1, 0.45), alpha(a.ink, 0.4)),
            focusRing: mode(alpha(c1, 0.6), a.ink),
            // A few navbars outline with colorPalette.500.
            500: mode(a.onDark, a.ink),
        },
        link: { DEFAULT: mode(a.accentText, lightText), hover: mode(a.accentTextHover, a.inkDark) },
        eyebrow: mode(a.onDark, a.ink),
        accent: mode(a.onDark, a.ink),
        buttonText: mode(a.buttonText, HIVE_GLOW_WHITE),
    };
}

function hiveGlowConfig(app: HiveGlowAppKey) {
    const a = HIVE_GLOW_APPS[app];
    if (!a) {
        throw new Error(`createHiveGlowSystem: "${app}" has no Hive Glow theme`);
    }
    const { app: appPalette, link, eyebrow, accent, buttonText } = appColors(a);
    const [c1, c2] = a.gradient;
    const D = HIVE_GLOW_DARK;
    const L = HIVE_GLOW_LIGHT;
    const fe = HIVE_GLOW_FEATURED_EDGE;
    const inner = HIVE_GLOW_INNER_FACTOR;

    const textStyles = Object.fromEntries(
        Object.entries(HIVE_GLOW_TYPE).map(([name, s]) => [
            name,
            {
                value: {
                    fontFamily: s.mono ? 'mono' : 'body',
                    fontSize: px(s.size),
                    fontWeight: s.weight,
                    letterSpacing: s.tracking,
                    lineHeight: s.lineHeight,
                    ...(s.transform ? { textTransform: s.transform } : {}),
                },
            },
        ]),
    );

    const radii = Object.fromEntries(Object.entries(HIVE_GLOW_RADIUS).map(([k, v]) => [k, { value: px(v) }]));

    // Inputs: inset fill, hairline edge, the app focus ring (colorPalette.focusRing).
    const field = { bg: 'hg.inset', borderColor: 'hg.hairline' };

    const badgeTones = Object.fromEntries(
        (['info', 'warning', 'danger', 'success'] as const).map((k) => {
            const t = tone(k);
            return [k, { bg: t.fill, color: `hg.${k}.text`, borderWidth: '1px', borderColor: t.edge }];
        }),
    );
    const neutralTone = { bg: 'hg.secondaryFill', color: 'hg.text.secondary', borderWidth: '1px', borderColor: 'hg.hairline' };

    return defineConfig({
        globalCss: {
            body: {
                colorPalette: 'app',
            },
            // The interchain-kit wallet picker portals here with an inline z-index of 999, which put it
            // under the wallet sidebar (overlay/modal tokens), so Connect from the sidebar was unclickable.
            // Making the root its own stacking context lifts the whole picker above the drawer.
            '#interchain-ui-overlays-manager': {
                position: 'relative',
                zIndex: 'popover',
            },
        },
        theme: {
            keyframes: {
                // The live dot of a status pill: a slow breath instead of Chakra's pulse.
                hgBreathe: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
                // Skeleton blocks: a slow left-to-right shimmer.
                hgShimmer: { from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '-100% 0' } },
            },
            tokens: {
                fonts: {
                    body: { value: `var(--font-inter), ${HIVE_GLOW_FONTS.family}` },
                    heading: { value: `var(--font-inter), ${HIVE_GLOW_FONTS.family}` },
                    mono: { value: `var(--font-mono), ${HIVE_GLOW_FONTS.mono}` },
                },
                radii: { hg: radii },
                sizes: {
                    hg: {
                        container: { value: px(1200) },
                    },
                },
            },
            semanticTokens: {
                radii: {
                    l1: { value: '0.375rem' },
                    l2: { value: '0.5rem' },
                    l3: { value: '0.75rem' },
                },
                colors: {
                    // Chakra's own names, remapped so existing pages take the Hive Glow neutrals.
                    bg: {
                        DEFAULT: neutral('ground'),
                        panel: neutral('card'),
                        subtle: neutral('inset'),
                        muted: neutral('inset'),
                        emphasized: neutral('raised'),
                        inverted: mode(D.text, L.text),
                        error: mode(alpha(D.danger, HIVE_GLOW_NOTICE.fillAlpha), alpha(L.danger, HIVE_GLOW_NOTICE.fillAlpha)),
                        warning: mode(alpha(D.warning, HIVE_GLOW_NOTICE.fillAlpha), alpha(L.warning, HIVE_GLOW_NOTICE.fillAlpha)),
                        success: mode(alpha(D.success, HIVE_GLOW_NOTICE.fillAlpha), alpha(L.success, HIVE_GLOW_NOTICE.fillAlpha)),
                        info: mode(alpha(D.info, HIVE_GLOW_NOTICE.fillAlpha), alpha(L.info, HIVE_GLOW_NOTICE.fillAlpha)),
                    },
                    fg: {
                        DEFAULT: neutral('text'),
                        muted: neutral('textMuted'),
                        subtle: neutral('textFaint'),
                        inverted: mode(D.ground, L.ground),
                        error: neutral('dangerText'),
                        warning: neutral('warningText'),
                        success: neutral('successText'),
                        info: neutral('infoText'),
                    },
                    border: {
                        DEFAULT: neutral('hairline'),
                        subtle: neutral('divider'),
                        muted: neutral('lineStrong'),
                        emphasized: neutral('lineStrong'),
                        inverted: mode(D.text, L.text),
                        error: neutral('danger'),
                        warning: neutral('warning'),
                        success: neutral('success'),
                        info: neutral('info'),
                    },
                    app: appPalette,
                    // Hive Glow names for what Chakra has none for.
                    hg: {
                        ground: neutral('ground'),
                        card: neutral('card'),
                        cardHeader: neutral('cardHeader'),
                        inset: neutral('inset'),
                        raised: neutral('raised'),
                        iconDisc: neutral('iconDisc'),
                        hairline: neutral('hairline'),
                        divider: neutral('divider'),
                        lineStrong: neutral('lineStrong'),
                        secondaryFill: neutral('secondaryFill'),
                        hoverFill: neutral('hoverFill'),
                        switchOff: neutral('switchOff'),
                        text: {
                            DEFAULT: neutral('text'),
                            secondary: neutral('textSecondary'),
                            muted: neutral('textMuted'),
                            faint: neutral('textFaint'),
                            disabled: neutral('textDisabled'),
                        },
                        up: neutral('up'),
                        down: neutral('down'),
                        flat: neutral('flat'),
                        info: { DEFAULT: neutral('info'), text: neutral('infoText') },
                        warning: { DEFAULT: neutral('warning'), text: neutral('warningText') },
                        danger: {
                            DEFAULT: neutral('danger'),
                            text: neutral('dangerText'),
                            // The pressed destructive button (CompControls).
                            solid: { value: '{colors.red.600}' },
                        },
                        success: { DEFAULT: neutral('success'), text: neutral('successText') },
                        testnet: {
                            ground: neutral('testnetGround'),
                            line: neutral('testnetLine'),
                            text: neutral('testnetText'),
                            dot: neutral('testnetDot'),
                            pillFill: neutral('testnetPillFill'),
                            pillLine: neutral('testnetPillLine'),
                        },
                        backdrop: neutral('backdrop'),
                        header: neutral('headerFill'),
                        link,
                        eyebrow,
                        accent,
                        buttonText,
                    },
                },
                gradients: {
                    app: { value: gradient(a.gradient) },
                    appButton: mode(gradient(a.button), flat(a.ink)),
                    appButtonHover: mode(gradient(a.buttonHover), flat(a.inkDark)),
                    appWord: mode(gradient(a.gradient), gradient([a.ink, a.inkDark])),
                    featuredEdge: mode(
                        `linear-gradient(${fe.angle}deg, ${alpha(c1, fe.c1Alpha)}, ${alpha(c2, fe.c2Alpha)} ${fe.c2Stop}, ${fe.restDark})`,
                        `linear-gradient(${fe.angle}deg, ${alpha(c1, fe.c1Alpha)}, ${alpha(c2, fe.c2Alpha)} ${fe.c2Stop}, ${fe.restLight})`,
                    ),
                    heroGlow: mode(
                        glow(a, a.glow.c1, a.glow.c2, D.ground),
                        glow(a, HIVE_GLOW_LIGHT_GLOW.c1, HIVE_GLOW_LIGHT_GLOW.c2, L.ground),
                    ),
                    shimmer: mode(
                        `linear-gradient(90deg, ${D.inset}, ${D.raised}, ${D.inset})`,
                        `linear-gradient(90deg, ${L.inset}, ${L.hoverFill}, ${L.inset})`,
                    ),
                    heroGlowInner: mode(
                        glow(a, a.glow.c1 * inner, a.glow.c2 * inner, D.ground),
                        glow(a, HIVE_GLOW_LIGHT_GLOW.c1 * inner, HIVE_GLOW_LIGHT_GLOW.c2 * inner, L.ground),
                    ),
                },
                shadows: {
                    hg: {
                        card: neutral('cardShadow'),
                        popover: neutral('popoverShadow'),
                        drawer: neutral('drawerShadow'),
                        primary: mode(`0 8px 24px -8px ${alpha(c1, HIVE_GLOW_BUTTON_GLOW_ALPHA)}`, `0 6px 18px -8px ${a.ink}`),
                        primaryHover: mode(`0 10px 30px -8px ${alpha(c1, 0.8)}`, `0 8px 22px -8px ${a.ink}`),
                        featured: mode(`0 30px 80px -40px ${alpha(c1, fe.glowShadowAlpha)}`, `0 24px 60px -30px ${a.ink}`),
                    },
                },
            },
            textStyles,
            recipes: {
                button: {
                    variants: {
                        size: {
                            sm: { h: px(HIVE_GLOW_CONTROL.buttonSmall), minW: px(HIVE_GLOW_CONTROL.buttonSmall) },
                            md: { h: px(HIVE_GLOW_CONTROL.buttonCompact), minW: px(HIVE_GLOW_CONTROL.buttonCompact) },
                            lg: { h: px(HIVE_GLOW_CONTROL.button), minW: px(HIVE_GLOW_CONTROL.button), textStyle: 'button' },
                            xl: { h: px(HIVE_GLOW_CONTROL.buttonHero), minW: px(HIVE_GLOW_CONTROL.buttonHero), textStyle: 'button' },
                        },
                        variant: {
                            primary: {
                                bgImage: 'appButton',
                                color: 'hg.buttonText',
                                borderColor: 'transparent',
                                borderRadius: 'hg.md',
                                fontWeight: '600',
                                boxShadow: 'hg.primary',
                                _hover: { bgImage: 'appButtonHover', boxShadow: 'hg.primaryHover' },
                                _expanded: { bgImage: 'appButtonHover' },
                                _disabled: {
                                    bgImage: 'none',
                                    bg: 'hg.inset',
                                    color: 'hg.text.faint',
                                    boxShadow: 'none',
                                    opacity: 1,
                                },
                            },
                            secondary: {
                                bg: 'hg.secondaryFill',
                                color: 'hg.text',
                                borderColor: 'hg.lineStrong',
                                borderRadius: 'hg.md',
                                fontWeight: '600',
                                _hover: { borderColor: 'app.border', bg: 'hg.hoverFill' },
                                _expanded: { bg: 'hg.hoverFill' },
                                _disabled: {
                                    bg: 'transparent',
                                    color: 'hg.text.disabled',
                                    borderColor: 'hg.divider',
                                    opacity: 1,
                                },
                            },
                            danger: {
                                bg: tone('danger').fill,
                                color: 'hg.danger.text',
                                borderColor: 'hg.danger/40',
                                borderRadius: 'hg.md',
                                fontWeight: '600',
                                _hover: { bg: 'hg.danger.solid', color: 'white', borderColor: 'transparent' },
                                _expanded: { bg: 'hg.danger.solid', color: 'white' },
                                _disabled: {
                                    bg: 'transparent',
                                    color: 'hg.text.disabled',
                                    borderColor: 'hg.divider',
                                    opacity: 1,
                                },
                            },
                        },
                    },
                },
                badge: {
                    variants: {
                        variant: { ...badgeTones, neutral: neutralTone },
                    },
                },
                input: { variants: { variant: { outline: field } } },
                textarea: { variants: { variant: { outline: field } } },
            },
            slotRecipes: {
                card: {
                    slots: slotsOf('card'),
                    base: { root: { borderRadius: 'hg.lg' } },
                    variants: {
                        variant: {
                            outline: { root: { borderColor: 'hg.hairline', boxShadow: 'hg.card' } },
                            elevated: { root: { boxShadow: 'hg.card' } },
                        },
                    },
                },
                tag: {
                    slots: slotsOf('tag'),
                    variants: {
                        variant: Object.fromEntries(
                            Object.entries({ ...badgeTones, neutral: neutralTone }).map(([k, v]) => [k, { root: v }]),
                        ),
                    },
                },
                nativeSelect: { slots: slotsOf('nativeSelect'), variants: { variant: { outline: { field } } } },
                // CompOverlays: the inset surface with a hairline, not Chakra's inverted chip.
                tooltip: {
                    slots: slotsOf('tooltip'),
                    base: {
                        content: {
                            '--tooltip-bg': 'colors.hg.inset',
                            color: 'fg',
                            borderWidth: '1px',
                            borderColor: 'hg.hairline',
                            borderRadius: '10px',
                            px: '12px',
                            py: '10px',
                            fontSize: '13px',
                            lineHeight: '1.45',
                            fontWeight: '400',
                            boxShadow: 'hg.popover',
                            maxW: '300px',
                        },
                        arrowTip: { borderColor: 'hg.hairline' },
                    },
                },
                // CompOverlays: every toast on the card surface; the status shows in the edge and the icon disc.
                toast: {
                    slots: slotsOf('toast'),
                    base: {
                        root: {
                            bg: 'hg.card',
                            color: 'fg',
                            borderWidth: '1px',
                            borderColor: 'hg.hairline',
                            borderRadius: '14px',
                            boxShadow: 'hg.popover',
                            py: '14px',
                            ps: '16px',
                            pe: '40px',
                            ...Object.fromEntries(
                                (
                                    [
                                        ['warning', 'hg.warning/30'],
                                        ['success', 'hg.success/30'],
                                        ['error', 'hg.danger/35'],
                                        ['info', 'hg.info/30'],
                                    ] as const
                                ).map(([type, edge]) => [
                                    `&[data-type=${type}]`,
                                    { bg: 'hg.card', color: 'fg', borderColor: edge, '--toast-trigger-bg': 'colors.hg.hoverFill', '--toast-border-color': 'colors.hg.lineStrong' },
                                ]),
                            ),
                        },
                        title: { fontSize: '14px', fontWeight: '600' },
                        description: { fontSize: '13px', lineHeight: '1.45', color: 'fg.muted', opacity: 1 },
                        closeTrigger: { color: 'hg.text.faint', top: '10px', insetEnd: '10px', borderRadius: '8px' },
                    },
                },
                select: { slots: slotsOf('select'), variants: { variant: { outline: { trigger: field } } } },
            },
        },
    });
}

/**
 * The Chakra system of a BZE dapp in the Hive Glow theme: Chakra's own semantic colours
 * remapped to the Hive Glow neutrals, the app's colours as the `app` palette (the body
 * default), `hg.*` tokens, gradients, text styles and the primary/secondary/danger buttons.
 * Dark and light come from the `.dark` / `.light` class next-themes sets.
 */
export function createHiveGlowSystem(app: HiveGlowAppKey): SystemContext {
    return createSystem(defaultConfig, hiveGlowConfig(app));
}
