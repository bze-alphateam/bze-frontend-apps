/**
 * The BZE apps a link or button can point at, keyed like getEcosystemApps().
 * The Website carries the main BZ mark and no app colour (getbze.com has no
 * app glyph on purpose); every other app has its own icon and accent.
 */
export type AppKey = 'website' | 'dex' | 'staking' | 'burner' | 'factory' | 'communities' | 'explorer';

/** The apps with their own glyph and accent: every app but the Website. */
export type BrandedAppKey = Exclude<AppKey, 'website'>;

export interface AppAccent {
    /** Ink: text and borders on a light background. */
    light: string;
    /** Light end of the app gradient: text and borders on a dark background. */
    dark: string;
}

export interface AppIdentity {
    accent: AppAccent;
}

/**
 * Accent per app, from the colour table in the branding repo
 * (bze-alphateam/Official-BZEdge-Graphics, beezee/apps/README.md):
 * the "Ink" column on light, the "On dark" column on dark.
 */
export const appIdentity: Record<BrandedAppKey, AppIdentity> = {
    dex:         { accent: { light: '#0E74AD', dark: '#12C1E1' } },
    staking:     { accent: { light: '#8E44AD', dark: '#B57EDC' } },
    burner:      { accent: { light: '#C24A00', dark: '#FF8A1F' } },
    factory:     { accent: { light: '#9A6A00', dark: '#FFC933' } },
    communities: { accent: { light: '#1A7A43', dark: '#3DD07A' } },
    explorer:    { accent: { light: '#0B74A8', dark: '#22C4E2' } },
};

/**
 * The colour of a link or outline pointing at `app`, as a Chakra value that
 * switches with the colour mode in CSS. The Website keeps the page's own text
 * colour.
 */
export const appAccentColor = (app: AppKey): string | { base: string; _dark: string } => {
    if (app === 'website') return 'fg';
    const { light, dark } = appIdentity[app].accent;
    return { base: light, _dark: dark };
};
