// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

const chain = vi.hoisted(() => ({ testnet: false }));
vi.mock('../../constants/chain', async (importActual) => ({
    ...(await importActual<typeof import('../../constants/chain')>()),
    isTestnetChain: () => chain.testnet,
}));

import { rulesFor } from '../../test-support/css-rules';
import { createHiveGlowSystem } from '../../theme';
import type { EcosystemApp } from '../../constants/ecosystem';
import { AppHeader, type AppHeaderNavItem, type AppHeaderProps } from './index';

// The menus position themselves with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

const system = createHiveGlowSystem('staking');
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;

const APPS: EcosystemApp[] = [
    { key: 'website', name: 'Website', href: 'https://getbze.com', disabled: false },
    { key: 'dex', name: 'DEX', href: 'https://dex.getbze.com', disabled: false },
    { key: 'explorer', name: 'Explorer', href: 'https://explorer.getbze.com', disabled: false },
];

const ITEMS: AppHeaderNavItem[] = [
    { label: 'Dashboard', href: '/' },
    { label: 'Governance', href: '/governance', active: true, badge: { count: 2, label: '2 proposals need your vote', caption: 'need your vote' } },
];

const header = (props: Partial<AppHeaderProps> = {}) =>
    render(
        <AppHeader
            app="staking"
            appName="BeeZee Staking"
            items={ITEMS}
            walletLabel="Connect"
            walletContent={<p>wallet drawer</p>}
            settings={<button>Settings</button>}
            apps={APPS}
            {...props}
        />,
        { wrapper },
    );

const desktopNav = () => within(screen.getByTestId('app-header')).getAllByRole('navigation', { name: 'Main' })[0];

beforeEach(() => {
    chain.testnet = false;
});

afterEach(() => {
    cleanup();
});

describe('AppHeader', () => {
    it('lists the nav items in order, marks the active one and ends with the Apps menu', () => {
        header();
        const nav = desktopNav();
        // The Apps menu's phone list (hidden from md in CSS) follows the app's own items.
        const links = within(nav).getAllByRole('link').filter((l) => !l.hasAttribute('data-app'));
        expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/governance']);
        expect(within(nav).getByRole('link', { name: /^Governance/ }).getAttribute('aria-current')).toBe('page');
        expect(within(nav).getByRole('link', { name: 'Dashboard' }).hasAttribute('aria-current')).toBe(false);
        expect(within(nav).getByRole('button', { name: 'Apps' })).toBeTruthy();
    });

    it('spans the full width with 32 px sides, never the 1200 px page container', () => {
        header();

        const row = screen.getByTestId('app-header').firstElementChild as HTMLElement;
        const css = rulesFor(row);

        expect(css).not.toMatch(/max-width/);
        expect(css).toMatch(/padding-inline:\s*32px/);
    });

    it('shows the badge count with its accessible label', () => {
        header();
        const badge = within(desktopNav()).getByLabelText('2 proposals need your vote');
        expect(badge.textContent).toBe('2');
        expect(within(desktopNav()).getByRole('link', { name: /^Governance 2 proposals need your vote/ })).toBeTruthy();
    });

    it('draws no badge at 0', () => {
        header({ items: [{ label: 'Governance', href: '/governance', badge: { count: 0, label: 'none' } }] });
        expect(screen.queryByTestId('nav-badge')).toBeNull();
        expect(screen.queryByTestId('menu-badge-dot')).toBeNull();
    });

    it('renders an item without a route as a button', () => {
        const onClick = vi.fn();
        header({ items: [{ label: 'Search Coin', onClick }] });
        fireEvent.click(within(desktopNav()).getByRole('button', { name: 'Search Coin' }));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('shows the lockup for both colour modes and both widths, named by the app', () => {
        header();
        const logos = screen.getAllByAltText('BeeZee Staking');
        expect(logos.map((l) => l.getAttribute('src'))).toEqual([
            '/images/app-landscape-light.svg',
            '/images/app-landscape-dark.svg',
            '/images/app-compact-light.svg',
            '/images/app-compact-dark.svg',
        ]);
    });

    it('has a TESTNET pill only on testnet', () => {
        header();
        expect(screen.queryByTestId('testnet-pill')).toBeNull();
        cleanup();
        chain.testnet = true;
        header();
        expect(screen.getByTestId('testnet-pill').textContent).toBe('TESTNET');
    });

    it.each(['Connect', '1.2K TBZE'])('labels the wallet button "%s" and opens the wallet drawer', async (label) => {
        header({ walletLabel: label });
        const wallet = await screen.findByRole('button', { name: new RegExp(`^${label}`) });
        expect(wallet.hasAttribute('data-wallet-trigger')).toBe(true);
        fireEvent.click(wallet);
        expect(await screen.findByText('wallet drawer')).toBeTruthy();
    });

    it('renders the settings trigger it is given', async () => {
        header();
        expect(await screen.findByRole('button', { name: 'Settings' })).toBeTruthy();
    });

    it('opens the phone menu with the nav items, the badge caption and the Apps list', async () => {
        header();
        const toggle = screen.getByRole('button', { name: 'Open menu' });
        expect(within(toggle).getByTestId('menu-badge-dot')).toBeTruthy();

        fireEvent.click(toggle);
        const sheet = await screen.findByRole('dialog', { name: 'Menu' });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Close menu' })).toBeTruthy());

        const links = within(sheet).getAllByRole('link');
        expect(links.slice(0, 2).map((l) => l.getAttribute('href'))).toEqual(['/', '/governance']);
        expect(within(sheet).getByRole('link', { name: /^Governance/ }).getAttribute('aria-current')).toBe('page');

        const apps = within(sheet).getByTestId('apps-menu-mobile');
        expect(within(apps).getAllByRole('link').map((l) => l.getAttribute('data-app'))).toEqual(['website', 'dex', 'explorer']);
    });

    it('shows the badge caption for an idle item in the phone menu', async () => {
        header({ items: [{ label: 'Dashboard', href: '/', active: true }, { ...ITEMS[1], active: false }] });
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        const sheet = await screen.findByRole('dialog', { name: 'Menu' });
        expect(within(sheet).getByText('need your vote')).toBeTruthy();
        expect(within(sheet).getByLabelText('2 proposals need your vote').textContent).toBe('2');
    });

    it('closes the phone menu when an item is picked', async () => {
        const onClick = vi.fn();
        header({ items: [{ label: 'Search Coin', onClick }] });
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        const sheet = await screen.findByRole('dialog', { name: 'Menu' });
        fireEvent.click(within(sheet).getByRole('button', { name: 'Search Coin' }));
        expect(onClick).toHaveBeenCalledOnce();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy());
    });
});
