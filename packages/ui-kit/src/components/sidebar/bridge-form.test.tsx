// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

const { availability } = vi.hoisted(() => ({
    availability: { canDeposit: true, canWithdraw: true, canUseSkip: false, isAvailable: true, isLoading: false },
}));

vi.mock('../../hooks/useBridgeAvailability', () => ({ useBridgeAvailability: () => availability }));
vi.mock('./deposit-form', () => ({ DepositForm: () => <div data-testid="deposit-form" /> }));
vi.mock('./withdraw-form', () => ({ WithdrawForm: () => <div data-testid="withdraw-form" /> }));

import { createHiveGlowSystem } from '../../theme';
import { BridgeForm } from './bridge-form';

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
);

const set = (patch: Partial<typeof availability>) => Object.assign(availability, patch);

beforeEach(() => {
    set({ canDeposit: true, canWithdraw: true, canUseSkip: false, isLoading: false });
});

afterEach(cleanup);

describe('BridgeForm directions', () => {
    it('offers both directions as tabs when both have options', () => {
        render(<BridgeForm />, { wrapper });
        expect(screen.getByRole('heading', { name: 'Deposit / Withdraw' })).toBeTruthy();
        expect(screen.getByTestId('deposit-form')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Withdraw' }));
        expect(screen.getByTestId('withdraw-form')).toBeTruthy();
    });

    it('opens straight into Withdraw, with no tabs, when nothing can be deposited', () => {
        set({ canDeposit: false });
        render(<BridgeForm />, { wrapper });
        expect(screen.getByRole('heading', { name: 'Withdraw' })).toBeTruthy();
        expect(screen.getByTestId('withdraw-form')).toBeTruthy();
        expect(screen.queryByTestId('deposit-form')).toBeNull();
        expect(screen.queryByRole('tab', { name: 'Deposit' })).toBeNull();
    });

    it('opens straight into Deposit, with no tabs, when nothing can be withdrawn', () => {
        set({ canWithdraw: false });
        render(<BridgeForm />, { wrapper });
        expect(screen.getByRole('heading', { name: 'Deposit' })).toBeTruthy();
        expect(screen.getByTestId('deposit-form')).toBeTruthy();
        expect(screen.queryByRole('tab', { name: 'Withdraw' })).toBeNull();
    });

    it('keeps both tabs while the lists are still loading', () => {
        set({ canDeposit: false, canWithdraw: false, isLoading: true });
        render(<BridgeForm />, { wrapper });
        expect(screen.getByRole('tab', { name: 'Withdraw' })).toBeTruthy();
    });

    it('with no direct route, points to Skip.go only (mainnet)', () => {
        set({ canDeposit: false, canWithdraw: false, canUseSkip: true });
        render(<BridgeForm />, { wrapper });
        expect(screen.getByTestId('bridge-skip-only')).toBeTruthy();
        expect(screen.queryByTestId('deposit-form')).toBeNull();
        expect(screen.queryByTestId('withdraw-form')).toBeNull();
        expect(screen.getByRole('button', { name: /Use Skip.go/ })).toBeTruthy();
    });

    it('hides Use Skip.go where Skip has no BZE chain (testnet)', () => {
        render(<BridgeForm />, { wrapper });
        expect(screen.queryByRole('button', { name: /Use Skip.go/ })).toBeNull();
    });
});
