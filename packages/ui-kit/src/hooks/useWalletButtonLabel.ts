'use client';

import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {useMemo} from 'react';
import {getChainName} from '../constants/chain';
import {getChainNativeAssetDenom} from '../constants/assets';
import {uAmountToBigNumberAmount} from '../utils/amount';
import {shortNumberFormat} from '../utils/formatter';
import {useAssets} from './useAssets';
import {useBalance} from './useBalances';

/** "Connect" without a wallet, the native balance with one ("1.2K TBZE"): the header's wallet button label. */
export const useWalletButtonLabel = (): string => {
    const {nativeAsset} = useAssets();
    const {balance} = useBalance(getChainNativeAssetDenom());
    const {status} = useChain(getChainName());

    return useMemo(() => {
        if (status !== WalletState.Connected || !nativeAsset) {
            return 'Connect';
        }

        return `${shortNumberFormat(uAmountToBigNumberAmount(balance.amount, nativeAsset.decimals))} ${nativeAsset.ticker}`;
    }, [status, nativeAsset, balance]);
};
