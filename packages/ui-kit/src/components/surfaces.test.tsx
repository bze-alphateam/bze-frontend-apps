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
import { Toaster, toaster } from './toaster';

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
});
