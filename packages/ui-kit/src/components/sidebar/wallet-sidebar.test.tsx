// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { WalletState } from '@interchain-kit/core';

import type { CrossChainTxRecord } from '../../types/cross_chain';

// The wallet connection, balances and the Latest Buy tracker are fed directly; the buy and
// bridge flows have their own hooks and are not under test here.
const { wallet, tracker, bridge, held } = vi.hoisted(() => ({
    wallet: { status: 'Disconnected' as string },
    tracker: { transactions: [] as CrossChainTxRecord[], addTransaction: () => {}, dismissTransaction: () => {} },
    bridge: { isAvailable: false },
    held: { balances: [] as unknown[] },
}));

vi.mock('@interchain-kit/react', () => ({
    InterchainWalletModal: () => null,
    useChain: () => ({
        status: wallet.status,
        username: 'Keplr',
        address: 'bze1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        disconnect: vi.fn(),
        connect: vi.fn(),
    }),
}));
vi.mock('../../hooks/useBalances', () => ({ useBalances: () => ({ assetsBalances: held.balances, isLoading: false }) }));
vi.mock('../../hooks/useBridgeAvailability', () => ({
    useBridgeAvailability: () => ({ canDeposit: false, canWithdraw: false, canUseSkip: false, isLoading: false, ...bridge }),
}));
vi.mock('../../hooks/useAssets', async (importActual) => ({
    ...(await importActual<typeof import('../../hooks/useAssets')>()),
    useAsset: () => ({ asset: undefined }),
}));
vi.mock('../../hooks/useSkipTxTracker', () => ({ useSkipTxTracker: () => tracker }));
vi.mock('../../constants/cross_chain', async (importActual) => ({
    ...(await importActual<typeof import('../../constants/cross_chain')>()),
    isCrossChainEnabled: () => false,
    isSkipEnabled: () => true,
}));
vi.mock('./buy-form', () => ({ BuyForm: () => null }));
vi.mock('./bridge-form', () => ({ BridgeForm: () => null }));

import BigNumber from 'bignumber.js';
import { createHiveGlowSystem } from '../../theme';
import { rulesFor } from '../../test-support/css-rules';
import { WalletSidebarContent } from './wallet-sidebar';

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
);

const buy = (state: CrossChainTxRecord['state']): CrossChainTxRecord => ({
    id: 'buy-1',
    timestamp: Date.now(),
    direction: 'deposit',
    sourceChainName: 'Osmosis',
    destChainName: 'BeeZee',
    assetTicker: 'OSMO',
    amountIn: '12',
    estimatedAmountOut: '340',
    mechanism: 'skip',
    state,
});

const statusPill = () => screen.getByTestId('status-pill');

beforeEach(() => {
    wallet.status = WalletState.Disconnected;
    tracker.transactions = [];
    bridge.isAvailable = false;
    held.balances = [];
});

afterEach(() => {
    cleanup();
});

describe('WalletSidebarContent states', () => {
    it('disconnected: a red Disconnected pill and the Connect Wallet primary', () => {
        render(<WalletSidebarContent />, { wrapper });
        expect(screen.getByText('Wallet Status')).toBeTruthy();
        expect(statusPill().textContent).toBe('Disconnected');
        expect(statusPill().getAttribute('data-tone')).toBe('danger');
        expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeTruthy();
        expect(screen.queryByTestId('wallet-address-card')).toBeNull();
    });

    it('connecting: an amber pill with the live dot', () => {
        wallet.status = WalletState.Connecting;
        render(<WalletSidebarContent />, { wrapper });
        expect(statusPill().textContent).toBe('Connecting');
        expect(statusPill().getAttribute('data-tone')).toBe('warning');
        expect(within(statusPill()).getByTestId('live-dot')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeTruthy();
    });

    it.each([WalletState.Rejected, WalletState.NotExist])('%s: a grey pill printing the raw state, and Connect Wallet', (state) => {
        wallet.status = state;
        render(<WalletSidebarContent />, { wrapper });
        expect(statusPill().textContent).toBe(state);
        expect(statusPill().getAttribute('data-tone')).toBe('neutral');
        expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeTruthy();
    });

    it('connected: the address card with the Explorer link, the quick actions and Disconnect', () => {
        wallet.status = WalletState.Connected;
        render(<WalletSidebarContent />, { wrapper });
        const card = screen.getByTestId('wallet-address-card');
        expect(within(card).getByText('Keplr')).toBeTruthy();
        expect(within(card).getByRole('link', { name: /Explorer/ }).getAttribute('data-app')).toBe('explorer');
        expect(screen.getByRole('button', { name: /^Send/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Buy BZE/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Disconnect Wallet/ })).toBeTruthy();
    });
});

describe('Latest Buy', () => {
    beforeEach(() => {
        wallet.status = WalletState.Connected;
    });

    it('shows nothing without a buy', () => {
        render(<WalletSidebarContent />, { wrapper });
        expect(screen.queryByTestId('latest-buy')).toBeNull();
    });

    it('shows the one in-progress buy with the live dot and opens its Transaction Details', () => {
        tracker.transactions = [buy('pending')];
        render(<WalletSidebarContent />, { wrapper });

        const section = screen.getByTestId('latest-buy');
        expect(within(section).getByText('Latest Buy')).toBeTruthy();
        const pill = within(section).getByTestId('status-pill');
        expect(pill.textContent).toBe('In Progress');
        expect(within(pill).getByTestId('live-dot')).toBeTruthy();

        fireEvent.click(within(section).getByRole('button', { name: /12 OSMO → ~340 BZE/ }));
        expect(screen.getByRole('heading', { name: 'Transaction Details' })).toBeTruthy();
        expect(screen.queryByTestId('latest-buy')).toBeNull();
    });

    it('a finished buy has no live dot', () => {
        tracker.transactions = [buy('completed')];
        render(<WalletSidebarContent />, { wrapper });
        const pill = within(screen.getByTestId('latest-buy')).getByTestId('status-pill');
        expect(pill.textContent).toBe('Completed');
        expect(pill.getAttribute('data-tone')).toBe('success');
        expect(within(pill).queryByTestId('live-dot')).toBeNull();
    });
});

describe('Deposit / Withdraw entry', () => {
    beforeEach(() => {
        wallet.status = WalletState.Connected;
    });

    it('is hidden when there is nothing to deposit, withdraw or bring in through Skip', () => {
        render(<WalletSidebarContent />, { wrapper });
        expect(screen.getByRole('button', { name: /^Send/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Deposit \/ Withdraw/ })).toBeNull();
    });

    it('shows when a transfer is possible', () => {
        bridge.isAvailable = true;
        render(<WalletSidebarContent />, { wrapper });
        expect(screen.getByRole('button', { name: /Deposit \/ Withdraw/ })).toBeTruthy();
    });
});

describe('Balance row Send', () => {
    beforeEach(() => {
        wallet.status = WalletState.Connected;
        held.balances = [{
            denom: 'uvdl', ticker: 'VDL', name: 'Vidulum', logo: '', decimals: 6, verified: true, type: 'factory',
            amount: new BigNumber(5_000_000), USDValue: new BigNumber(0),
        }];
    });

    it('carries the send icon and stays visible on phones, revealed on hover from md up', () => {
        render(<WalletSidebarContent />, { wrapper });
        const send = within(screen.getByTestId('balance-row')).getByTestId('balance-row-send');
        expect(send.textContent).toBe('Send');
        expect(send.querySelector('svg')).toBeTruthy();

        const rules = rulesFor(send);
        expect(rules).toMatch(/opacity:\s*1/);
        expect(rules).toMatch(/@media[^{]*min-width[^{]*\{[^}]*opacity:\s*0/);
        expect(rules).toMatch(/\.group:is\(:hover/);
    });
});
