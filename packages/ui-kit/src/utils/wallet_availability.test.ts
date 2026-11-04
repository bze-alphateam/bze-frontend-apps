// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {beePocketWallet} from '@bze/beepocket-connector';
import {WalletManagerStore} from '@interchain-kit/store';
import {assetLists, chains} from 'chain-registry';

import {isBeePocketEnabled, isWalletComingSoon, splitComingSoonWallets} from '../index';

const FLAG = 'NEXT_PUBLIC_BEEPOCKET_ENABLED';
const original = process.env[FLAG];

const otherWallet = {info: {name: 'keplr-extension', prettyName: 'Keplr', logo: 'keplr.svg'}};

const setFlag = (value: string | undefined) => {
    if (value === undefined) delete process.env[FLAG];
    else process.env[FLAG] = value;
};

afterEach(() => setFlag(original));

describe('BeePocket flag', () => {
    it('is on only for the exact value true', () => {
        setFlag('true');
        expect(isBeePocketEnabled()).toBe(true);
        for (const value of [undefined, '', 'false', '1', 'TRUE', 'yes']) {
            setFlag(value);
            expect(isBeePocketEnabled()).toBe(false);
        }
    });
});

describe('splitComingSoonWallets', () => {
    it('hands BeePocket to the wallet manager when the flag is on', () => {
        setFlag('true');
        const {wallets, comingSoon} = splitComingSoonWallets([beePocketWallet, otherWallet]);

        expect(wallets).toEqual([beePocketWallet, otherWallet]);
        expect(comingSoon).toEqual([]);
        expect(isWalletComingSoon(beePocketWallet.info.name)).toBe(false);
    });

    it.each([undefined, 'false', '1'])('keeps BeePocket as coming soon when the flag is %s', (value) => {
        setFlag(value);
        const {wallets, comingSoon} = splitComingSoonWallets([beePocketWallet, otherWallet]);

        expect(wallets).toEqual([otherWallet]);
        expect(comingSoon).toEqual([{
            name: beePocketWallet.info.name,
            prettyName: beePocketWallet.info.prettyName,
            logo: typeof beePocketWallet.info.logo === 'string' ? beePocketWallet.info.logo : beePocketWallet.info.logo?.major,
        }]);
        expect(isWalletComingSoon(beePocketWallet.info.name)).toBe(true);
        expect(isWalletComingSoon(otherWallet.info.name)).toBe(false);
    });
});

describe('stored BeePocket choice', () => {
    const beezee = chains.filter((chain) => chain.chainName === 'beezee');
    const beezeeAssets = assetLists.filter((list) => list.chainName === 'beezee');

    // What the wallet manager saved after a BeePocket connection on an earlier visit.
    beforeEach(() => {
        localStorage.setItem('interchain-kit-store', JSON.stringify({
            currentWalletName: beePocketWallet.info.name,
            currentChainName: 'beezee',
            chainWalletStates: [{
                walletName: beePocketWallet.info.name,
                chainName: 'beezee',
                walletState: 'Connected',
                rpcEndpoint: '',
                errorMessage: '',
                account: {address: 'bze1stored', algo: 'secp256k1', pubkey: {}, username: 'stored'},
            }],
        }));
    });

    afterEach(() => localStorage.clear());

    const restored = () => {
        const store = new WalletManagerStore(beezee, beezeeAssets, splitComingSoonWallets([beePocketWallet]).wallets);
        store.restore();
        return store;
    };

    it('is dropped on load while BeePocket is coming soon', () => {
        setFlag(undefined);
        const store = restored();

        expect(store.currentWalletName).toBe('');
        expect(store.getState().chainWalletStates.some((state) => state.walletName === beePocketWallet.info.name)).toBe(false);
    });

    it('is restored when BeePocket is enabled', () => {
        setFlag('true');

        expect(restored().currentWalletName).toBe(beePocketWallet.info.name);
    });
});
