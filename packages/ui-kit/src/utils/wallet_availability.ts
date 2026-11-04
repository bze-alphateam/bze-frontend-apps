import {isBeePocketEnabled} from '../constants/wallets';
import {isBeePocketWallet} from './wallet_sign_mode';

/** What the wallet picker shows for a wallet that cannot be connected yet. */
export interface ComingSoonWallet {
    name: string;
    prettyName: string;
    logo?: string;
}

/** The part of an interchain-kit wallet this module reads. */
interface WalletWithInfo {
    info: {
        name: string;
        prettyName: string;
        logo?: string | {major: string; minor: string};
    };
}

/** Whether a wallet is listed but not connectable on this build. */
export const isWalletComingSoon = (walletName: string | undefined): boolean =>
    isBeePocketWallet(walletName) && !isBeePocketEnabled();

/**
 * Splits a dapp's wallets into the ones handed to `ChainProvider` and the ones the wallet picker
 * only shows as "Coming soon". The wallet manager never receives a coming-soon wallet, so nothing
 * can connect it: not the picker, and not the stored choice of an earlier visit, which the
 * manager drops on load when it no longer knows that wallet.
 */
export const splitComingSoonWallets = <W extends WalletWithInfo>(
    all: W[],
): {wallets: W[]; comingSoon: ComingSoonWallet[]} => {
    const wallets: W[] = [];
    const comingSoon: ComingSoonWallet[] = [];
    for (const wallet of all) {
        if (!isWalletComingSoon(wallet.info.name)) {
            wallets.push(wallet);
            continue;
        }

        const {name, prettyName, logo} = wallet.info;
        comingSoon.push({name, prettyName, logo: typeof logo === 'string' ? logo : logo?.major});
    }

    return {wallets, comingSoon};
};
