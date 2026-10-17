'use client';

import {useEffect, useRef} from 'react';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

export interface UseStakeLinkOptions {
    // The `stake` query parameter, or null when absent.
    stakeParam: string | null;
    // undefined while the validators are still loading.
    validators: ValidatorSDKType[] | undefined;
    // True while the wallet is (auto-)connecting, so the form opens once the wallet state is known.
    isConnecting: boolean;
    openDelegate: (validator: ValidatorSDKType) => void;
    highlight: (operatorAddress: string) => void;
    clearParam: () => void;
    notify: (title: string) => void;
}

// Handles `?stake=<operator>` deep links: looks the value up in the loaded validators (no other
// validation needed), highlights the match and opens the delegate form, exactly like the row's
// Stake button. Without a wallet the form offers to connect one itself. Router-free so it can be
// tested with plain callbacks.
export function useStakeLink({
    stakeParam,
    validators,
    isConnecting,
    openDelegate,
    highlight,
    clearParam,
    notify,
}: UseStakeLinkOptions) {
    const handledParam = useRef<string | null>(null);

    useEffect(() => {
        if (!stakeParam) {
            handledParam.current = null;
            return;
        }
        if (handledParam.current === stakeParam) {
            return;
        }
        if (!validators || isConnecting) {
            return;
        }

        handledParam.current = stakeParam;
        clearParam();
        const validator = validators.find(v => v.operator_address === stakeParam);
        if (!validator) {
            notify('Validator not found on this network');
            return;
        }

        highlight(validator.operator_address);
        openDelegate(validator);
    }, [stakeParam, validators, isConnecting, openDelegate, highlight, clearParam, notify]);
}
