import { describe, expect, it } from 'vitest';

import { createHiveGlowSystem } from './create-hive-glow-system';
import { HIVE_GLOW_APPS, HIVE_GLOW_DARK, HIVE_GLOW_LIGHT, type HiveGlowAppKey } from './hive-glow-tokens';

const APPS = Object.keys(HIVE_GLOW_APPS) as HiveGlowAppKey[];

/** The dark and light values of a semantic token, as the system resolved them. */
const modes = (app: HiveGlowAppKey, name: string) => {
    const token = createHiveGlowSystem(app).tokens.getByName(name);
    expect(token, name).toBeDefined();
    const { _dark, _light } = token!.extensions.conditions as { _dark: string; _light: string };
    return { dark: _dark, light: _light };
};

describe('createHiveGlowSystem', () => {
    it.each(APPS)('%s: the app palette uses its button colour, button text and accent on dark', (app) => {
        const a = HIVE_GLOW_APPS[app];
        expect(modes(app, 'colors.app.solid').dark).toBe(a.button[0]);
        expect(modes(app, 'colors.app.contrast').dark).toBe(a.buttonText);
        expect(modes(app, 'colors.app.fg').dark).toBe(a.accentText);
    });

    it.each(APPS)('%s: the app palette uses Ink with white text on light', (app) => {
        const a = HIVE_GLOW_APPS[app];
        expect(modes(app, 'colors.app.solid').light).toBe(a.ink);
        expect(modes(app, 'colors.app.contrast').light).toBe('#FFFFFF');
        expect(modes(app, 'colors.app.focusRing').light).toBe(a.ink);
    });

    it.each(APPS)('%s: Chakra bg/fg/border resolve to the Hive Glow neutrals', (app) => {
        expect(modes(app, 'colors.bg')).toEqual({ dark: HIVE_GLOW_DARK.ground, light: HIVE_GLOW_LIGHT.ground });
        expect(modes(app, 'colors.bg.panel')).toEqual({ dark: HIVE_GLOW_DARK.card, light: HIVE_GLOW_LIGHT.card });
        expect(modes(app, 'colors.bg.muted')).toEqual({ dark: HIVE_GLOW_DARK.inset, light: HIVE_GLOW_LIGHT.inset });
        expect(modes(app, 'colors.bg.emphasized')).toEqual({ dark: HIVE_GLOW_DARK.raised, light: HIVE_GLOW_LIGHT.raised });
        expect(modes(app, 'colors.fg')).toEqual({ dark: HIVE_GLOW_DARK.text, light: HIVE_GLOW_LIGHT.text });
        expect(modes(app, 'colors.fg.muted')).toEqual({ dark: HIVE_GLOW_DARK.textMuted, light: HIVE_GLOW_LIGHT.textMuted });
        expect(modes(app, 'colors.fg.subtle')).toEqual({ dark: HIVE_GLOW_DARK.textFaint, light: HIVE_GLOW_LIGHT.textFaint });
        expect(modes(app, 'colors.border')).toEqual({ dark: HIVE_GLOW_DARK.hairline, light: HIVE_GLOW_LIGHT.hairline });
        expect(modes(app, 'colors.border.subtle')).toEqual({ dark: HIVE_GLOW_DARK.divider, light: HIVE_GLOW_LIGHT.divider });
        expect(modes(app, 'colors.border.muted')).toEqual({ dark: HIVE_GLOW_DARK.lineStrong, light: HIVE_GLOW_LIGHT.lineStrong });
    });

    it('gives Staking its deeper button pair while the glow keeps the icon pair', () => {
        expect(modes('staking', 'gradients.appButton').dark).toBe('linear-gradient(135deg, #9D5BD2, #7B3AA6)');
        expect(modes('staking', 'colors.app.contrast').dark).toBe('#FFFFFF');
        expect(createHiveGlowSystem('staking').tokens.getByName('gradients.app')?.value).toBe(
            'linear-gradient(135deg, #B57EDC, #8E44AD)',
        );
        expect(modes('staking', 'gradients.heroGlow').dark).toContain('rgba(181,126,220,0.26)');
    });

    it('uses #8A5F00 for Factory links and small text on the light ground', () => {
        expect(modes('factory', 'colors.hg.link').light).toBe('#8A5F00');
        expect(modes('factory', 'colors.app.fg').light).toBe('#8A5F00');
        // The button keeps Factory's Ink.
        expect(modes('factory', 'colors.app.solid').light).toBe('#9A6A00');
    });

    it.each(APPS.filter((a) => a !== 'factory'))('%s: light links use Ink', (app) => {
        expect(modes(app, 'colors.hg.link').light).toBe(HIVE_GLOW_APPS[app].ink);
    });

    it('renders the hero word as Ink to dark Ink on light', () => {
        expect(modes('dex', 'gradients.appWord')).toEqual({
            dark: 'linear-gradient(135deg, #12C1E1, #1694D2)',
            light: 'linear-gradient(135deg, #0E74AD, #0A5A87)',
        });
    });

    it('halves the glow for inner pages', () => {
        const { dark, light } = modes('dex', 'gradients.heroGlowInner');
        expect(dark).toBe('radial-gradient(70% 80% at 30% 0%, rgba(18,193,225,0.13), rgba(22,148,210,0.04) 45%, rgba(10,12,16,0) 75%)');
        expect(light).toBe('radial-gradient(70% 80% at 30% 0%, rgba(18,193,225,0.08), rgba(22,148,210,0.025) 45%, rgba(245,247,250,0) 75%)');
    });

    it('sets the app palette as the body default and loads the fonts from CSS variables', () => {
        const system = createHiveGlowSystem('burner');
        expect(system._config.globalCss?.body).toMatchObject({ colorPalette: 'app' });
        expect(system.tokens.getByName('fonts.body')?.value).toMatch(/^var\(--font-inter\), Inter/);
        expect(system.tokens.getByName('fonts.mono')?.value).toMatch(/^var\(--font-mono\), 'JetBrains Mono'/);
    });

    it('keeps the l1/l2/l3 radii and adds the Hive Glow radii', () => {
        const system = createHiveGlowSystem('dex');
        expect(system.tokens.getByName('radii.l2')?.value).toBe('0.5rem');
        expect(system.tokens.getByName('radii.hg.lg')?.value).toBe('16px');
        expect(system.tokens.getByName('radii.hg.pill')?.value).toBe('999px');
    });

    it('adds the Hive Glow button variants next to the Chakra ones', () => {
        const recipe = createHiveGlowSystem('communities').getRecipe('button');
        expect(Object.keys(recipe.variants?.variant ?? {})).toEqual(
            expect.arrayContaining(['solid', 'outline', 'ghost', 'primary', 'secondary', 'danger']),
        );
        expect(recipe.variants?.size?.lg).toMatchObject({ h: '44px' });
        expect(recipe.variants?.size?.xl).toMatchObject({ h: '48px' });
        expect(recipe.variants?.size?.sm).toMatchObject({ h: '32px' });
    });

    it('adds status tones to badges', () => {
        const recipe = createHiveGlowSystem('dex').getRecipe('badge');
        expect(Object.keys(recipe.variants?.variant ?? {})).toEqual(
            expect.arrayContaining(['subtle', 'info', 'warning', 'danger', 'success', 'neutral']),
        );
    });

    it('turns the explorer away', () => {
        // @ts-expect-error the explorer is not a dapp
        expect(() => createHiveGlowSystem('explorer')).toThrow(/no Hive Glow theme/);
    });
});
