// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

import type { CrossChainTxRecord } from '../../types/cross_chain';
import { TxDetailsModal } from './tx-details-modal';

afterEach(() => {
    cleanup();
});

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

const record = (over: Partial<CrossChainTxRecord>): CrossChainTxRecord => ({
    id: '1',
    timestamp: 0,
    direction: 'withdraw',
    sourceChainName: 'beezee',
    destChainName: 'osmosis',
    assetTicker: 'BZE',
    amountIn: '1',
    estimatedAmountOut: '1',
    mechanism: 'ibc',
    state: 'completed',
    txHash: 'ABC123',
    ...over,
} as CrossChainTxRecord);

describe('TxDetailsModal explorer link', () => {
    it('opens a tx broadcast on BZE in the BZE Explorer', () => {
        render(<TxDetailsModal tx={record({ broadcastChainId: 'beezee-1', explorerLink: 'https://mintscan.example/tx/ABC123' })} onClose={() => {}} />, { wrapper });
        const link = screen.getByRole('link', { name: 'Explorer' });
        expect(link.getAttribute('data-app')).toBe('explorer');
        expect(link.getAttribute('href')).toBe('https://explorer.getbze.com/txs/ABC123');
        expect(screen.queryByRole('button', { name: /chain explorer/ })).toBeNull();
    });

    it("keeps Skip's link for a tx broadcast on another chain, without a BZE app identity", () => {
        render(<TxDetailsModal tx={record({ broadcastChainId: 'osmosis-1', explorerLink: 'https://mintscan.example/tx/ABC123' })} onClose={() => {}} />, { wrapper });
        expect(screen.getByRole('button', { name: /View on chain explorer/ })).toBeTruthy();
        expect(document.querySelector('[data-app]')).toBeNull();
    });
});
