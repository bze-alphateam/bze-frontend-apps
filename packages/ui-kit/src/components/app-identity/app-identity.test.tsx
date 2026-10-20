// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

import type { EcosystemApp } from '../../constants/ecosystem';
import { ECOSYSTEM_MENU_LABEL } from '../../constants/ecosystem';
import { appIdentity, type BrandedAppKey } from '../../constants/app-identity';
import { rulesFor } from '../../test-support/css-rules';
import { AppIconButton, AppLink } from './app-button';
import { AppIcon } from './app-icon';
import { AppsMenu } from './apps-menu';
import { APP_ICON_DATA } from './icon-data';

// The menu positions itself with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

afterEach(() => {
    cleanup();
});

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

describe('AppIcon', () => {
    it.each([16, 20, 32])('uses the small cut at %i px', (size) => {
        const { container } = render(<AppIcon app="burner" size={size} />, { wrapper });
        const icon = screen.getByTestId('app-icon');
        expect(icon.getAttribute('data-cut')).toBe('small');
        expect(container.querySelector('path')?.getAttribute('d')).toBe(APP_ICON_DATA.burner.small);
        expect(container.querySelector('svg')?.getAttribute('width')).toBe(String(size));
    });

    it.each([33, 48, 64])('uses the full icon at %i px', (size) => {
        const { container } = render(<AppIcon app="burner" size={size} />, { wrapper });
        expect(screen.getByTestId('app-icon').getAttribute('data-cut')).toBe('full');
        expect(container.querySelector('path')?.getAttribute('d')).toBe(APP_ICON_DATA.burner.full);
    });

    it('gives every icon its own gradient ids', () => {
        const { container } = render(<><AppIcon app="dex" size={20} /><AppIcon app="staking" size={20} /></>, { wrapper });
        const ids = [...container.querySelectorAll('linearGradient')].map(g => g.id);
        expect(ids).toHaveLength(4);
        expect(new Set(ids).size).toBe(4);
        // The glyph points at its own icon's gradient.
        const paths = [...container.querySelectorAll('path')].map(p => p.getAttribute('fill'));
        expect(paths[0]).not.toBe(paths[1]);
    });

    it('shows the main BZ mark for the Website', () => {
        render(<AppIcon app="website" size={20} />, { wrapper });
        const icon = screen.getByTestId('app-icon');
        expect(icon.tagName).toBe('IMG');
        expect(icon.getAttribute('src')).toBe('/images/bze_alternative_512x512.png');
    });

    it('is decorative', () => {
        render(<AppIcon app="explorer" size={20} />, { wrapper });
        expect(screen.getByTestId('app-icon').getAttribute('aria-hidden')).toBe('true');
    });
});

/** The CSS rules Chakra emitted for the element's atomic class. */
function rulesOf(el: HTMLElement): string {
    const cls = [...el.classList].find(c => c.startsWith('css-'));
    if (!cls) return '';
    const css = [...document.querySelectorAll('style')].map(s => s.textContent ?? '').join('\n');
    return css.split('}').filter(chunk => chunk.includes(`.${cls}`)).join('}\n');
}

describe('AppIconButton', () => {
    it('names itself with its aria-label, carries the app and has no border', () => {
        render(<AppIconButton app="explorer" href="https://explorer.getbze.com/accounts/bze1x" aria-label="View on Explorer" />, { wrapper });
        const link = screen.getByRole('link', { name: 'View on Explorer' });
        expect(link.getAttribute('data-app')).toBe('explorer');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(within(link).getByTestId('app-icon')).toBeTruthy();
        expect(rulesOf(link)).not.toMatch(/border-color:\s*#/i);
    });
});

describe('AppLink', () => {
    it('flush pulls its padding into the margin, so the icon lines up with the text above', () => {
        render(<AppLink app="explorer" href="https://explorer.getbze.com" flush>Explorer</AppLink>, { wrapper });
        expect(rulesFor(screen.getByRole('link', { name: 'Explorer' }))).toMatch(/margin-inline-start:\s*calc\(var\(--chakra-spacing-1\\?\.5\) \* -1\)/);
        cleanup();
        render(<AppLink app="explorer" href="https://explorer.getbze.com">Explorer</AppLink>, { wrapper });
        expect(rulesFor(screen.getByRole('link', { name: 'Explorer' }))).not.toMatch(/margin-inline-start/);
    });

    it('is the app icon, the app name and an external mark, opening in a new tab', () => {
        render(<AppLink app="explorer" href="https://explorer.getbze.com/txs/ABC">Explorer</AppLink>, { wrapper });
        const link = screen.getByRole('link', { name: 'Explorer' });
        expect(link.getAttribute('href')).toBe('https://explorer.getbze.com/txs/ABC');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link.getAttribute('data-testid')).toBe('app-link');
        expect(link.getAttribute('data-app')).toBe('explorer');
        const icon = within(link).getByTestId('app-icon');
        expect(icon.getAttribute('data-app')).toBe('explorer');
        expect(icon.getAttribute('data-cut')).toBe('small');
        expect(icon.querySelector('svg')?.getAttribute('width')).toBe('16');
        // The external-link mark is the last child, after the name.
        expect(link.lastElementChild?.tagName.toLowerCase()).toBe('svg');
        expect(link.lastElementChild?.getAttribute('aria-hidden')).toBe('true');
    });

    it('is ghost: the app accent on the text, no border and no fill', () => {
        render(<AppLink app="staking" href="https://staking.getbze.com">Staking</AppLink>, { wrapper });
        const rules = rulesOf(screen.getByRole('link', { name: 'Staking' }));
        expect(rules).toMatch(/color:\s*#8E44AD/i);
        expect(rules).toMatch(/color:\s*#B57EDC/i);
        expect(rules).not.toMatch(/border(-color|-width)?:/i);
        expect(rules).not.toMatch(/background(-color)?:\s*#/i);
    });

    it.each(Object.keys(appIdentity) as BrandedAppKey[])('keeps the %s accent readable as plain text (WCAG AA)', (app) => {
        const { light, dark } = appIdentity[app].accent;
        expect(contrast(light, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
        expect(contrast(dark, '#111111')).toBeGreaterThanOrEqual(4.5);
    });
});

/** WCAG 2 contrast ratio of two #RRGGBB colours. */
function contrast(a: string, b: string): number {
    const lum = (hex: string) => {
        const [r, g, bl] = [1, 3, 5]
            .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const APPS: EcosystemApp[] = [
    { key: 'website', name: 'Website', href: 'https://getbze.com', disabled: false },
    { key: 'dex', name: 'DEX', href: 'https://dex.getbze.com', disabled: false },
    { key: 'factory', name: 'Factory', href: 'https://factory.getbze.com', disabled: true },
    { key: 'explorer', name: 'Explorer', href: 'https://testnet-explorer.getbze.com', disabled: false },
];

describe('AppsMenu', () => {
    it('is labelled "Apps"', () => {
        expect(ECOSYSTEM_MENU_LABEL).toBe('Apps');
        render(<AppsMenu apps={APPS} />, { wrapper });
        expect(screen.getByRole('button', { name: 'Apps' })).toBeTruthy();
    });

    it('lists every app with its icon in the inline (mobile) list', () => {
        render(<AppsMenu apps={APPS} />, { wrapper });
        const list = screen.getByTestId('apps-menu-mobile');
        const entries = [...list.querySelectorAll('[data-app]')].filter(e => e.getAttribute('data-testid') !== 'app-icon');
        expect(entries.map(e => e.getAttribute('data-app'))).toEqual(['website', 'dex', 'factory', 'explorer']);
        for (const entry of entries) {
            const icon = within(entry as HTMLElement).getByTestId('app-icon');
            expect(icon.getAttribute('data-app')).toBe(entry.getAttribute('data-app'));
        }
        const explorer = within(list).getByRole('link', { name: 'Explorer' });
        expect(explorer.getAttribute('href')).toBe('https://testnet-explorer.getbze.com');
        expect(explorer.getAttribute('target')).toBe('_blank');
    });

    it('shows a disabled app as "(coming soon)", not as a link', () => {
        render(<AppsMenu apps={APPS} />, { wrapper });
        const list = screen.getByTestId('apps-menu-mobile');
        expect(within(list).queryByRole('link', { name: /Factory/ })).toBeNull();
        expect(within(list).getByText('(coming soon)')).toBeTruthy();
    });

    it('opens the dropdown with an icon per item', async () => {
        render(<AppsMenu apps={APPS} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
        const menu = await screen.findByRole('menu');
        await waitFor(() => expect(within(menu).getAllByRole('menuitem')).toHaveLength(4));
        expect(within(menu).getAllByTestId('app-icon')).toHaveLength(4);
        expect(within(menu).getByText('Explorer')).toBeTruthy();
    });

    it('leaves out an excluded app (getEcosystemApps honours NEXT_PUBLIC_ECOSYSTEM_EXCLUDED)', () => {
        process.env.NEXT_PUBLIC_ECOSYSTEM_EXCLUDED = 'dex'
        try {
            render(<AppsMenu />, { wrapper });
            const list = screen.getByTestId('apps-menu-mobile');
            expect(within(list).queryByRole('link', { name: 'DEX' })).toBeNull();
            expect(within(list).getByRole('link', { name: 'Explorer' })).toBeTruthy();
        } finally {
            delete process.env.NEXT_PUBLIC_ECOSYSTEM_EXCLUDED
        }
    });

    it('calls onLinkClick when an entry is clicked', () => {
        let clicks = 0;
        render(<AppsMenu apps={APPS} onLinkClick={() => clicks++} />, { wrapper });
        fireEvent.click(within(screen.getByTestId('apps-menu-mobile')).getByRole('link', { name: 'DEX' }));
        expect(clicks).toBe(1);
    });

    it('renders nothing without apps', () => {
        const { container } = render(<AppsMenu apps={[]} />, { wrapper });
        expect(container.textContent).toBe('');
    });
});
