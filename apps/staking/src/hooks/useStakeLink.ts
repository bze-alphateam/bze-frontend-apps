'use client';

import {useEffect, useRef} from 'react';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

export interface UseStakeLinkOptions {
    // The `stake` query parameter, or null when absent.
    stakeParam: string | null;
    // undefined while the validators are still loading.
    validators: ValidatorSDKType[] | undefined;
    isConnected: boolean;
    // True while the wallet is (auto-)connecting, so the link waits instead of asking to connect.
    isConnecting: boolean;
    // Whether the connect-wallet prompt is open; closing it without connecting drops the pending stake.
    isConnectPromptOpen: boolean;
    openDelegate: (validator: ValidatorSDKType) => void;
    openConnectPrompt: (validator: ValidatorSDKType) => void;
    highlight: (operatorAddress: string) => void;
    clearParam: () => void;
    notify: (title: string) => void;
}

// Handles `?stake=<operator>` deep links: looks the value up in the loaded validators (no other
// validation needed), highlights the match and opens the delegate form, asking the user to connect
// a wallet first when needed. Router-free so it can be tested with plain callbacks.
export function useStakeLink({
    stakeParam,
    validators,
    isConnected,
    isConnecting,
    isConnectPromptOpen,
    openDelegate,
    openConnectPrompt,
    highlight,
    clearParam,
    notify,
}: UseStakeLinkOptions) {
    const handledParam = useRef<string | null>(null);
    const pendingValidator = useRef<ValidatorSDKType | null>(null);
    const wasPromptOpen = useRef(isConnectPromptOpen);

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
        if (isConnected) {
            openDelegate(validator);
        } else {
            pendingValidator.current = validator;
            openConnectPrompt(validator);
        }
    }, [stakeParam, validators, isConnected, isConnecting, openDelegate, openConnectPrompt, highlight, clearParam, notify]);

    useEffect(() => {
        if (isConnected && pendingValidator.current) {
            const validator = pendingValidator.current;
            pendingValidator.current = null;
            openDelegate(validator);
        }
    }, [isConnected, openDelegate]);

    // Only the prompt closing (open -> closed) without a wallet cancels; the link handling above
    // sets the pending validator before the prompt has had a chance to open.
    useEffect(() => {
        if (wasPromptOpen.current && !isConnectPromptOpen && !isConnected) {
            pendingValidator.current = null;
        }
        wasPromptOpen.current = isConnectPromptOpen;
    }, [isConnectPromptOpen, isConnected]);
}
