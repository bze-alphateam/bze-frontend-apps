import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ChakraProvider, defaultSystem} from '@chakra-ui/react';
import {WalletState} from '@interchain-kit/core';

const ME = 'atone1qyqszqgpqyqszqgpqyqszqgpqyqszqgpunaemy';
const TARGET = 'atone1qgpqyqszqgpqyqszqgpqyqszqgpqyqszdhmusj';
const BZE_ADDR = 'bze1qgpqyqszqgpqyqszqgpqyqszqgpqyqsz7nts5a';
const FEE = {amount: [{denom: 'uphoton', amount: '29250'}], gas: '130000'};

const {txMock, useChainMock, estimateMock} = vi.hoisted(() => ({
    txMock: vi.fn(),
    useChainMock: vi.fn(),
    estimateMock: vi.fn(),
}));

vi.mock('@bze/bze-ui-kit', async (importActual) => {
    const actual = await importActual<typeof import('@bze/bze-ui-kit')>();
    return {
        ...actual,
        useSDKTx: () => ({tx: txMock, progressTrack: ''}),
        getChainRestURL: async () => 'https://rest.example',
    };
});
vi.mock('@interchain-kit/react', () => ({useChain: useChainMock}));
vi.mock('@/lib/atomone-withdraw', async (importActual) => {
    const actual = await importActual<typeof import('@/lib/atomone-withdraw')>();
    return {
        ...actual,
        fetchWithdrawAddress: async () => ME,
        fetchBalance: async () => '1000000',
        estimateSetWithdrawAddressFee: estimateMock,
    };
});

import {WithdrawAddressPanel} from './withdraw-address-panel';

const renderPanel = () => render(<ChakraProvider value={defaultSystem}><WithdrawAddressPanel /></ChakraProvider>);

describe('WithdrawAddressPanel', () => {
    beforeEach(() => {
        txMock.mockReset();
        estimateMock.mockReset().mockResolvedValue(FEE);
        useChainMock.mockReturnValue({status: WalletState.Connected, address: ME, connect: vi.fn()});
    });

    it('asks a visitor to connect', () => {
        useChainMock.mockReturnValue({status: WalletState.Disconnected, connect: vi.fn()});
        renderPanel();
        expect(screen.getByRole('button', {name: /connect atomone wallet/i})).toBeInTheDocument();
    });

    it('shows the account, its withdraw address and PHOTON balance', async () => {
        renderPanel();
        expect(await screen.findByText('Rewards are paid to this account itself.')).toBeInTheDocument();
        expect(screen.getByText('1 PHOTON')).toBeInTheDocument();
    });

    it('rejects an address of another chain', async () => {
        renderPanel();
        await userEvent.type(await screen.findByPlaceholderText('atone1…'), BZE_ADDR);
        expect(screen.getByText(/another network \(bze\)/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Review'})).toBeDisabled();
    });

    it('confirms the target, then signs with the simulated uphoton fee and shows the hash', async () => {
        txMock.mockImplementation(async (_msgs, opts) => {
            opts.onBroadcast('HASH123');
            opts.onSuccess({txhash: 'HASH123', code: 0, height: 1});
            return true;
        });
        renderPanel();
        await userEvent.type(await screen.findByPlaceholderText('atone1…'), TARGET);
        await userEvent.click(screen.getByRole('button', {name: 'Review'}));

        expect(await screen.findByText(TARGET)).toBeInTheDocument();
        expect(screen.getByText(/0.02925 PHOTON/)).toBeInTheDocument();
        expect(estimateMock).toHaveBeenCalledWith('https://rest.example', ME, TARGET);

        await userEvent.click(screen.getByRole('button', {name: 'Sign and send'}));
        await waitFor(() => expect(screen.getByText('Withdraw address changed.')).toBeInTheDocument());
        expect(screen.getByText('HASH123')).toBeInTheDocument();

        const [msgs, opts] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe('/cosmos.distribution.v1beta1.MsgSetWithdrawAddress');
        expect(msgs[0].value).toMatchObject({delegatorAddress: ME, withdrawAddress: TARGET});
        expect(opts.fee).toEqual(FEE);
        expect(opts.memo).toBe('');
    });

    it('does not open the wallet when the simulation fails', async () => {
        estimateMock.mockRejectedValue(new Error('insufficient funds'));
        renderPanel();
        await userEvent.type(await screen.findByPlaceholderText('atone1…'), TARGET);
        await userEvent.click(screen.getByRole('button', {name: 'Review'}));
        expect(await screen.findByText(/would fail: insufficient funds/)).toBeInTheDocument();
        expect(txMock).not.toHaveBeenCalled();
    });
});
