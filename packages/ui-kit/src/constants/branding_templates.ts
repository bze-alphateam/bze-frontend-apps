import type {BrandingColors, BrandingTemplate, BrandingTemplateMood, DenomBranding} from "../types/branding";

/** The moods in the order an editor lists them, with their labels. */
export const BRANDING_TEMPLATE_MOODS: {mood: BrandingTemplateMood; label: string}[] = [
    {mood: 'neutral', label: 'Neutral'},
    {mood: 'warm', label: 'Warm'},
    {mood: 'cool', label: 'Cool'},
    {mood: 'vivid', label: 'Vivid'},
    {mood: 'pastel', label: 'Pastel'},
    {mood: 'earthy', label: 'Earthy'},
    {mood: 'contrast', label: 'High contrast'},
];

type Hexes = [background: string, text: string, primary: string, secondary: string];

const colors = ([background, text, primary, secondary]: Hexes): BrandingColors => ({background, text, primary, secondary});

const template = (id: string, name: string, mood: BrandingTemplateMood, font: string, light: Hexes, dark: Hexes): BrandingTemplate => ({
    id,
    name,
    mood,
    branding: {font, light: colors(light), dark: colors(dark)},
});

/**
 * Ready-made brand kits (BFE-293). Each one is the same brand in light and dark, and in both
 * modes text, primary and secondary on the background, and black or white (whichever reads
 * better) on primary, reach WCAG AA (4.5:1); the ui-kit tests hold every template to that.
 */
export const BRANDING_TEMPLATES: BrandingTemplate[] = [
    template('graphite', 'Graphite', 'neutral', 'inter', ['#FFFFFF', '#18181B', '#27272A', '#52525B'], ['#18181B', '#FAFAFA', '#E4E4E7', '#A1A1AA']),
    template('ink-paper', 'Ink & Paper', 'neutral', 'space-grotesk', ['#FBF8F1', '#1F1B16', '#1E3A8A', '#6B6358'], ['#16130F', '#F3EEE4', '#93C5FD', '#A8A092']),
    template('honey', 'Honey', 'warm', 'poppins', ['#FFFBEB', '#1C1917', '#B45309', '#78716C'], ['#1C1609', '#FEF3C7', '#FBBF24', '#A8A29E']),
    template('sunset', 'Sunset', 'warm', 'poppins', ['#FFF7ED', '#1F1410', '#C2410C', '#9F1239'], ['#1A0F0B', '#FFEDD5', '#FB923C', '#F9A8D4']),
    template('ember', 'Ember', 'warm', 'montserrat', ['#FFFFFF', '#1A1A1A', '#B91C1C', '#57534E'], ['#170B0B', '#FEE2E2', '#F87171', '#A8A29E']),
    template('ocean', 'Ocean', 'cool', 'inter', ['#F0F9FF', '#0C1A2B', '#0369A1', '#475569'], ['#071722', '#E0F2FE', '#38BDF8', '#94A3B8']),
    template('midnight', 'Midnight', 'cool', 'montserrat', ['#F5F7FF', '#111633', '#4338CA', '#5B6280'], ['#0B0D1F', '#E0E7FF', '#A5B4FC', '#8A90B8']),
    template('mint', 'Mint', 'cool', 'inter', ['#F0FDFA', '#0F2A26', '#0F766E', '#4B6B66'], ['#062320', '#CCFBF1', '#2DD4BF', '#7FA8A2']),
    template('neon', 'Neon', 'vivid', 'space-grotesk', ['#FFFFFF', '#0A0A0A', '#A21CAF', '#4B5563'], ['#0A0A0F', '#F5F5F5', '#E879F9', '#22D3EE']),
    template('electric', 'Electric', 'vivid', 'space-grotesk', ['#F8FAFF', '#0B1020', '#1D4ED8', '#4D7C0F'], ['#05070F', '#EEF2FF', '#60A5FA', '#A3E635']),
    template('terminal', 'Terminal', 'vivid', 'jetbrains-mono', ['#F7FFF9', '#04130A', '#047857', '#3F5F4E'], ['#000000', '#E6FFEE', '#34F5A0', '#7FB89A']),
    template('royal', 'Royal', 'vivid', 'montserrat', ['#FFFDF7', '#1E1433', '#5B21B6', '#7A5F12'], ['#140E22', '#F5F0FF', '#C4B5FD', '#E5C46B']),
    template('lavender', 'Lavender', 'pastel', 'poppins', ['#FAF5FF', '#2E1F47', '#7E22CE', '#6B5B85'], ['#1A1326', '#F3E8FF', '#D8B4FE', '#A898C2']),
    template('blossom', 'Blossom', 'pastel', 'poppins', ['#FFF5F8', '#3A1626', '#BE185D', '#7D5466'], ['#24111A', '#FCE7F3', '#F9A8D4', '#C094A8']),
    template('sage', 'Sage', 'pastel', 'inter', ['#F6F8F3', '#263024', '#3F6212', '#66705F'], ['#161B14', '#EEF2E8', '#BEF264', '#9AA592']),
    template('forest', 'Forest', 'earthy', 'montserrat', ['#F4F8F2', '#14231A', '#166534', '#556B5D'], ['#0C1610', '#E3F0E6', '#4ADE80', '#8FA898']),
    template('terracotta', 'Terracotta', 'earthy', 'montserrat', ['#FBF5EF', '#2B1D16', '#9A3412', '#7A5C48'], ['#1D1410', '#F5E6D8', '#F4A27A', '#B89A84']),
    template('coffee', 'Coffee', 'earthy', 'roboto', ['#FAF6F1', '#24180F', '#7C4A21', '#6F5E50'], ['#1A120C', '#F2E6DA', '#D9A06A', '#AC9886']),
    template('mono', 'Mono', 'contrast', 'inter', ['#FFFFFF', '#000000', '#000000', '#3F3F3F'], ['#000000', '#FFFFFF', '#FFFFFF', '#C8C8C8']),
    template('signal', 'Signal', 'contrast', 'roboto', ['#FFE600', '#000000', '#000000', '#3D3500'], ['#000000', '#FFE600', '#FFE600', '#FFF5A0']),
];

/** The kit a template sets, as a fresh copy an editor may change without touching the template. */
export function brandingFromTemplate(t: BrandingTemplate): DenomBranding {
    return {font: t.branding.font, light: {...t.branding.light}, dark: {...t.branding.dark}};
}
