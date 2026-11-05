// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

const chain = vi.hoisted(() => ({ testnet: false }));
vi.mock('../constants/chain', async (importActual) => ({
    ...(await importActual<typeof import('../constants/chain')>()),
    isTestnetChain: () => chain.testnet,
}));

import { createHiveGlowSystem } from '../theme';
import { HaltedBadge, HaltedNotice } from './halted-denom';
import { LegacyAssetNoticeBox } from './legacy-asset-notice';
import { TestnetBanner } from './testnet-banner';
import { Toaster, type ToasterTheme, toaster, useToasterTheme } from './toaster';

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('burner')}>{children}</ChakraProvider>
);
const ui = (node: ReactNode) => render(node, { wrapper });

beforeEach(() => {
    chain.testnet = false;
});

afterEach(() => {
    cleanup();
});

describe('TestnetBanner', () => {
    it('is the ribbon on testnet', () => {
        chain.testnet = true;
        ui(<TestnetBanner />);
        const ribbon = screen.getByRole('status');
        expect(ribbon.textContent).toBe('YOU ARE ON TESTNET');
        expect(ribbon.getAttribute('data-testid')).toBe('testnet-banner');
    });

    it('is absent on mainnet', () => {
        ui(<TestnetBanner />);
        expect(screen.queryByTestId('testnet-banner')).toBeNull();
    });
});

describe('halted and legacy notices', () => {
    it('HaltedNotice is the danger notice with today\'s copy and the page sentence', () => {
        ui(<HaltedNotice tickers={['USDC.n']}>Your resting orders stay on the book.</HaltedNotice>);
        const notice = screen.getByRole('note');
        expect(notice.getAttribute('data-status')).toBe('danger');
        expect(within(notice).getByText('USDC.n is no longer tradeable on BZE')).toBeTruthy();
        expect(notice.textContent).toContain('You can still cancel your open orders, remove your liquidity, and transfer or withdraw the asset.');
        expect(within(notice).getByText('Your resting orders stay on the book.')).toBeTruthy();
    });

    it('HaltedNotice names several assets in the plural', () => {
        ui(<HaltedNotice tickers={['USDC.n', 'ATOM']} />);
        expect(screen.getByText('USDC.n and ATOM are no longer tradeable on BZE')).toBeTruthy();
        expect(screen.getByRole('note').textContent).toContain('Support for these assets has ended');
    });

    it('HaltedBadge says trading is halted', () => {
        ui(<HaltedBadge />);
        expect(screen.getByText('Trading halted')).toBeTruthy();
    });

    it('LegacyAssetNoticeBox is the warning notice, with Learn more only when it has a URL', () => {
        ui(<LegacyAssetNoticeBox notice={{ title: 'USDC.n is being retired', text: 'New deposits are closed.' }} />);
        const notice = screen.getByRole('note');
        expect(notice.getAttribute('data-status')).toBe('warning');
        expect(within(notice).getByText('USDC.n is being retired')).toBeTruthy();
        expect(within(notice).queryByRole('link')).toBeNull();
        cleanup();

        ui(<LegacyAssetNoticeBox notice={{ title: 't', text: 'x', url: 'https://example.com/usdc' }} />);
        const link = screen.getByRole('link', { name: /Learn more/ });
        expect(link.getAttribute('href')).toBe('https://example.com/usdc');
        expect(link.getAttribute('target')).toBe('_blank');
    });
});

/** The CSS Chakra injected, as text (jsdom's CSSOM drops the rules it cannot parse). */
const styleText = () =>
    Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent)
        .join('\n');

describe('Toaster', () => {
    it.each([
        ['success', 'success'],
        ['error', 'danger'],
        ['loading', 'warning'],
    ] as const)('a %s toast carries the %s tone', async (type, tone) => {
        ui(<Toaster />);
        act(() => {
            toaster.create({ type, title: `A ${type} toast` });
        });
        const title = await screen.findByText(`A ${type} toast`);
        const root = title.closest('[data-type]') as HTMLElement;
        await waitFor(() => expect(within(root).getByTestId('toast-indicator').getAttribute('data-tone')).toBe(tone));
        act(() => {
            toaster.remove();
        });
    });

    it('puts the action under the title, on one line', async () => {
        ui(<Toaster />);
        act(() => {
            toaster.create({
                type: 'success',
                title: 'Transaction Successful',
                description: 'Your transaction was included in a block.',
                action: { label: 'View on Explorer', onClick: () => {} },
                closable: true,
            });
        });
        const title = await screen.findByText('Transaction Successful');
        const action = screen.getByRole('button', { name: 'View on Explorer' });

        // The action shares the text column, so it no longer takes width from the title.
        const text = title.closest('[data-testid="toast-text"]') as HTMLElement;
        expect(text).not.toBeNull();
        expect(text.contains(action)).toBe(true);
        expect(action.parentElement).toBe(text);

        // Its label never wraps or shrinks.
        const css = styleText();
        const rules = action.className
            .split(/\s+/)
            .filter(Boolean)
            .map((cls) => css.match(new RegExp(`\\.${cls}\\{([^}]*)\\}`))?.[1] ?? '')
            .join(';');
        expect(rules).toContain('white-space:nowrap');
        expect(rules).toContain('flex-shrink:0');
        expect(rules).toContain('align-self:flex-start');

        act(() => {
            toaster.remove();
        });
    });
});

const THEME: ToasterTheme = {
    bg: '#101010',
    fg: '#FAFAFA',
    muted: '#A0A0A0',
    faint: '#808080',
    border: '#303030',
    hover: '#202020',
    line: '#404040',
    radius: '20px',
    shadow: '0 0 40px #ABCDEF',
    font: 'Inter',
};

function Themed({ theme }: { theme?: ToasterTheme }) {
    useToasterTheme(theme);
    return null;
}

describe('Toaster theme', () => {
    afterEach(() => {
        act(() => {
            toaster.remove();
        });
    });

    it('keeps the Hive Glow surface while no page themes it', async () => {
        ui(<Toaster />);
        act(() => {
            toaster.create({ type: 'success', title: 'Plain toast', description: 'Details', closable: true });
        });
        await screen.findByText('Plain toast');

        expect(document.documentElement.style.getPropertyValue('--hg-toast-bg')).toBe('');
        const css = styleText();
        expect(css).toContain('var(--hg-toast-bg, var(--chakra-colors-hg-card))');
        expect(css).toContain('var(--hg-toast-fg, var(--chakra-colors-fg))');
        expect(css).toContain('var(--hg-toast-muted, var(--chakra-colors-fg-muted))');
        expect(css).toContain('var(--hg-toast-radius, 14px)');
        expect(css).toContain('var(--hg-toast-shadow, var(--chakra-shadows-hg-popover))');
        // The action and close buttons fall back to the same variables the unbraced token paths gave.
        expect(css).toContain('--toast-trigger-bg:var(--hg-toast-hover, var(--chakra-colors-hg-hover-fill))');
        expect(css).toContain('--toast-border-color:var(--hg-toast-line, var(--chakra-colors-hg-line-strong))');
    });

    it.each([
        ['success', 'hg-success', 30],
        ['error', 'hg-danger', 35],
        ['warning', 'hg-warning', 30],
    ] as const)('keeps the %s edge in the shared status colour', async (type, token, percent) => {
        ui(<Toaster />);
        act(() => {
            toaster.create({ type, title: `Edge ${type}` });
        });
        await screen.findByText(`Edge ${type}`);

        const rule = styleText().match(new RegExp(`\\[data-type=${type}\\]\\{([^}]*)\\}`));
        expect(rule).not.toBeNull();
        expect(rule![1]).toContain(`--mix-borderColor:color-mix(in srgb, var(--chakra-colors-${token}) ${percent}%, transparent)`);
        expect(rule![1]).toContain(`border-color:var(--mix-borderColor, var(--chakra-colors-${token}))`);
        expect(rule![1]).not.toContain('--hg-toast-border');
    });

    it('sets the theme on the document root while mounted and removes it after', () => {
        const { unmount } = ui(<Themed theme={THEME} />);
        const root = document.documentElement.style;
        expect(root.getPropertyValue('--hg-toast-bg')).toBe('#101010');
        expect(root.getPropertyValue('--hg-toast-fg')).toBe('#FAFAFA');
        expect(root.getPropertyValue('--hg-toast-muted')).toBe('#A0A0A0');
        expect(root.getPropertyValue('--hg-toast-border')).toBe('#303030');
        expect(root.getPropertyValue('--hg-toast-radius')).toBe('20px');
        expect(root.getPropertyValue('--hg-toast-shadow')).toBe('0 0 40px #ABCDEF');
        expect(root.getPropertyValue('--hg-toast-font')).toBe('Inter');

        unmount();
        expect(root.getPropertyValue('--hg-toast-bg')).toBe('');
        expect(root.getPropertyValue('--hg-toast-shadow')).toBe('');
        expect(root.getPropertyValue('--hg-toast-font')).toBe('');
    });

    it('leaves the optional parts on the defaults when the theme omits them', () => {
        const { radius: _r, shadow: _s, font: _f, ...colours } = THEME;
        ui(<Themed theme={colours} />);
        const root = document.documentElement.style;
        expect(root.getPropertyValue('--hg-toast-bg')).toBe('#101010');
        expect(root.getPropertyValue('--hg-toast-radius')).toBe('');
        expect(root.getPropertyValue('--hg-toast-shadow')).toBe('');
    });

    it('hands back to the earlier theme when the later one unmounts, and clears after the last', () => {
        const later: ToasterTheme = { ...THEME, bg: '#222222', shadow: undefined };
        const first = ui(<Themed theme={THEME} />);
        const second = render(<Themed theme={later} />);
        const root = document.documentElement.style;
        expect(root.getPropertyValue('--hg-toast-bg')).toBe('#222222');
        expect(root.getPropertyValue('--hg-toast-shadow')).toBe('');

        second.unmount();
        expect(root.getPropertyValue('--hg-toast-bg')).toBe('#101010');
        expect(root.getPropertyValue('--hg-toast-shadow')).toBe('0 0 40px #ABCDEF');

        first.unmount();
        expect(root.getPropertyValue('--hg-toast-bg')).toBe('');
    });

    it('keeps the later theme when the earlier one unmounts first', () => {
        const later: ToasterTheme = { ...THEME, bg: '#222222' };
        const first = ui(<Themed theme={THEME} />);
        const second = render(<Themed theme={later} />);

        first.unmount();
        expect(document.documentElement.style.getPropertyValue('--hg-toast-bg')).toBe('#222222');

        second.unmount();
        expect(document.documentElement.style.getPropertyValue('--hg-toast-bg')).toBe('');
    });

    it('sets nothing without a theme', () => {
        ui(<Themed />);
        expect(document.documentElement.style.getPropertyValue('--hg-toast-bg')).toBe('');
    });
});
