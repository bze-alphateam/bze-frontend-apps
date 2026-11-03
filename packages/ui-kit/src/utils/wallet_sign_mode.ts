/**
 * The interchain-kit wallet name of the BeePocket extension (`beePocketInfo.name` in
 * `@bze/beepocket-connector`). BeePocket serves BeeZee only and signs in direct mode only.
 */
export const BEEPOCKET_WALLET_NAME = 'beepocket-extension';

export const isBeePocketWallet = (walletName: string | undefined): boolean => walletName === BEEPOCKET_WALLET_NAME;

/** The name of the wallet behind a `useChain()` wallet (a ChainWalletStore), if any. */
export const walletNameOf = (wallet: unknown): string | undefined => {
    const name = (wallet as {info?: {name?: unknown}} | undefined)?.info?.name;
    return typeof name === 'string' ? name : undefined;
};

export interface TxSignMode {
    /** Sign in direct (protobuf) mode instead of the app-wide amino preference. */
    direct: boolean;
    /** Let the wallet compute and set the fee. */
    letWalletSetFee: boolean;
}

/**
 * How a transaction is signed. BeePocket has no amino signing and always sets its own fee
 * (returned in the signed doc's authInfo), so every BeePocket transaction is direct with the
 * wallet's fee, whatever the options say. Every other wallet follows the options.
 */
export const signModeFor = (
    walletName: string | undefined,
    options?: {useDirectSign?: boolean; letWalletSetFee?: boolean},
): TxSignMode => {
    if (isBeePocketWallet(walletName)) {
        return {direct: true, letWalletSetFee: true};
    }

    return {
        direct: options?.useDirectSign ?? false,
        letWalletSetFee: options?.letWalletSetFee ?? false,
    };
};
