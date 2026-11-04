// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ReactNode} from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ChakraProvider} from '@chakra-ui/react';
import {WalletState} from '@interchain-kit/core';
import {beePocketWallet} from '@bze/beepocket-connector';

// The wallet manager is fed directly: the modal reads its wallets and connects through them.
const {manager} = vi.hoisted(() => ({
    manager: {wallets: [] as unknown[]},
}));

vi.mock('@interchain-kit/react', () => ({
    useWalletManager: () => ({
        modalIsOpen: true,
        walletConnectQRCodeUri: null,
        wallets: manager.wallets,
        getChainWalletState: () => undefined,
        currentWalletName: '',
        currentChainName: 'beezee',
        openModal: vi.fn(),
        closeModal: vi.fn(),
        chains: [{chainName: 'beezee', chainId: 'beezee-1'}],
        getDownloadLink: () => null,
        getEnv: () => ({}),
    }),
}));

// interchain-ui's theme store does not run under jsdom; these stand-ins keep its contract: the
// list calls onWalletItemClick with the wallet's originalWallet.
vi.mock('@interchain-ui/react', () => ({
    ThemeProvider: ({children}: {children: ReactNode}) => <>{children}</>,
    ConnectModal: ({isOpen, header, children}: {isOpen: boolean; header: ReactNode; children: ReactNode}) =>
        isOpen ? <div role="dialog">{header}{children}</div> : null,
    ConnectModalHead: ({title}: {title: string}) => <h2>{title}</h2>,
    ConnectModalWalletList: ({wallets, onWalletItemClick}: {wallets: {name: string; prettyName?: string; originalWallet: unknown}[]; onWalletItemClick: (wallet: unknown) => void}) => (
        <div>
            {wallets.map((wallet) => (
                <button key={wallet.name} type="button" onClick={() => onWalletItemClick(wallet.originalWallet)}>
                    {wallet.prettyName ?? wallet.name}
                </button>
            ))}
        </div>
    ),
    ConnectModalStatus: () => null,
    ConnectModalQRCode: () => null,
}));

import {createHiveGlowSystem} from '../theme';
import {splitComingSoonWallets, WalletPickModal} from '../index';

const FLAG = 'NEXT_PUBLIC_BEEPOCKET_ENABLED';
const original = process.env[FLAG];

// A wallet as the wallet manager holds it: the dapp's wallet plus its connection state.
const stateful = (info: {name: string; prettyName: string; logo?: unknown}) => ({
    info,
    walletState: WalletState.Disconnected,
    errorMessage: '',
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
});

const keplr = {info: {name: 'keplr-extension', prettyName: 'Keplr', logo: 'keplr.svg'}};

const wrapper = ({children}: {children: ReactNode}) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
);

// What a dapp provider does: split its wallets, give the manager the connectable ones.
const renderPicker = () => {
    const {wallets, comingSoon} = splitComingSoonWallets([beePocketWallet, keplr]);
    const held = wallets.map((wallet) => stateful(wallet.info));
    manager.wallets = held;
    render(<WalletPickModal comingSoonWallets={comingSoon}/>, {wrapper});
    return held;
};

const walletButton = (name: RegExp) => screen.getAllByRole('button').find((button) => name.test(button.textContent ?? ''));

beforeEach(() => {
    manager.wallets = [];
});

afterEach(() => {
    cleanup();
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
});

describe('WalletPickModal', () => {
    it('lets BeePocket be picked when the flag is on', async () => {
        process.env[FLAG] = 'true';
        const held = renderPicker();

        expect(screen.queryByText('Coming soon')).toBeNull();
        const button = walletButton(/BeePocket/);
        expect(button).toBeDefined();
        expect((button as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(button!);
        await vi.waitFor(() => expect(held[0].connect).toHaveBeenCalledWith('beezee-1'));
    });

    it.each([undefined, 'false'])('shows BeePocket disabled as coming soon when the flag is %s', async (value) => {
        if (value === undefined) delete process.env[FLAG];
        else process.env[FLAG] = value;
        const held = renderPicker();

        const button = walletButton(/BeePocket/) as HTMLButtonElement;
        expect(button).toBeDefined();
        expect(button.disabled).toBe(true);
        expect(button.textContent).toContain('Coming soon');

        fireEvent.click(button);
        // Only Keplr reached the wallet manager, and clicking BeePocket connects nothing.
        expect(held.map((wallet) => wallet.info.name)).toEqual(['keplr-extension']);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(held[0].connect).not.toHaveBeenCalled();

        // The connectable wallets still work.
        fireEvent.click(walletButton(/Keplr/)!);
        await vi.waitFor(() => expect(held[0].connect).toHaveBeenCalledWith('beezee-1'));
    });
});
