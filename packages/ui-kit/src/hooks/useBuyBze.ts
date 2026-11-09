'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useChain, useWalletManager} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {useSkipChains, type SkipChainWithStatus} from './useSkipChains';
import {useSkipAssets} from './useSkipAssets';
import {useBuyRoute} from './useBuyRoute';
import {useSkipBridgeTransfer} from './useSkipBridgeTransfer';
import {useEvmWalletState} from '../evm/context';
import {useEvmWallet} from './useEvmWallet';
import {sanitizeNumberInput} from '../utils/number';
import {prettyAmount, uAmountToBigNumberAmount} from '../utils/amount';
import {getChainName, getChainByChainId} from '../constants/chain';
import {getChainRestURL} from '../constants/endpoints';
import {BZE_SKIP_CHAIN_ID} from '../constants/cross_chain';
import {skipChainIdToEvmChainId} from '../utils/evm';
import type {UseSkipTxTrackerReturn} from './useSkipTxTracker';
import {useToast} from './useToast';
import type {SkipAsset} from '../types/cross_chain';
import {isBeePocketWallet, walletNameOf} from '../utils/wallet_sign_mode';
import {createRegisteredChainLookup} from '../utils/cross_chain';

/** SkipAsset enriched with optional balance data from the source chain. */
export interface SkipAssetWithBalance extends SkipAsset {
    balanceRaw?: string;
    balanceDisplay?: string;
}

export interface UseBuyBzeOptions {
    /** Called after the transfer is submitted and the form is reset. */
    onDone?: () => void;
    /** Tracks the submitted transfer (the wallet sidebar's pending list). */
    addTransaction?: UseSkipTxTrackerReturn['addTransaction'];
}

/**
 * Everything behind "Buy BZE" except the visuals: the source chain and asset pickers, the
 * debounced Skip route to `ubze`, the source chain's wallet connections and balances, and the
 * transfer itself. `BuyForm` renders it in the BeeZee sidebars; an app with its own design
 * (communities' token site) renders it with its own components.
 */
export function useBuyBze({onDone, addTransaction}: UseBuyBzeOptions = {}) {
    const [selectedChain, setSelectedChain] = useState<SkipChainWithStatus | undefined>();
    const [selectedAsset, setSelectedAsset] = useState<SkipAsset | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [chainSearch, setChainSearch] = useState('');
    const [assetSearch, setAssetSearch] = useState('');
    const [assetBalances, setAssetBalances] = useState<Map<string, string>>(new Map());
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    // The EVM wallet or the intermediate chains said yes. A Cosmos source also needs its address
    // in the wallet kit: see `allChainsConnected`.
    const [chainsApproved, setChainsApproved] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectError, setConnectError] = useState('');
    // Bumped by every reset, so a connect still waiting on the wallet cannot touch the new selection.
    const connectAttempt = useRef(0);

    const resetConnection = useCallback(() => {
        connectAttempt.current += 1;
        setChainsApproved(false);
        setConnectError('');
        setIsConnecting(false);
    }, []);

    // ─── Chain type detection ──────────────────────────────────────────────
    const isSourceEvm = selectedChain?.chain_type === 'evm';
    const sourceDisplayName = selectedChain?.pretty_name || selectedChain?.chain_name || '';

    // ─── Data hooks ────────────────────────────────────────────────────────
    const {chains: skipChains, isLoading: isLoadingChains, error: chainsError} = useSkipChains();
    const {assets: skipAssets, isLoading: isLoadingAssets, error: assetsError} = useSkipAssets(selectedChain?.chain_id);
    const {routePreview, rawRoute, isLoading: isLoadingRoute, error: routeError} = useBuyRoute(
        selectedChain?.chain_id, selectedAsset?.denom, selectedAsset?.decimals, amount,
    );

    // ─── Cosmos wallet ─────────────────────────────────────────────────────
    // Only chains registered when ChainProvider mounted can be used here. The kit's addChains does
    // not reach the store behind useChain, which throws for any chain it does not know.
    const walletManager = useWalletManager();
    const registeredChainName = useMemo(() => createRegisteredChainLookup(), []);

    // The selected Cosmos source, when the wallet kit knows it.
    const cosmosSourceChainName = useMemo(() => {
        if (!selectedChain || !selectedChain.canSign || isSourceEvm) return undefined;
        return registeredChainName(selectedChain);
    }, [selectedChain, isSourceEvm, registeredChainName]);

    // useChain needs a registered chain, so BeeZee stands in until there is a Cosmos source. Its
    // address and wallet are never the source's: both stay undefined until the kit is connected
    // to that chain (a failed connect leaves the previous account in the kit's state).
    const sourceChainName = cosmosSourceChainName ?? getChainName();
    const sourceChain = useChain(sourceChainName);
    const sourceAddress = cosmosSourceChainName && sourceChain.status === WalletState.Connected
        ? sourceChain.address
        : undefined;
    const sourceWallet = cosmosSourceChainName ? sourceChain.wallet : undefined;
    const bzeChain = useChain(getChainName());
    // A Cosmos source is reached through the wallet kit and intermediate chains through Keplr
    // directly. BeePocket serves BeeZee only, so with it connected neither is ever asked (EVM
    // sources still work).
    const keplrAllowed = !isBeePocketWallet(walletNameOf(bzeChain.wallet));
    const isSourceReady = keplrAllowed && Boolean(sourceAddress);
    const allChainsConnected = chainsApproved && (isSourceEvm || isSourceReady);

    // ─── EVM wallet ──────────────────────────────────────────────────────
    // Both hooks are safe to call without EvmProvider — they return inert
    // defaults when isAvailable is false.
    const evmState = useEvmWalletState();
    const evmWallet = useEvmWallet();

    // ─── Required chains from route ────────────────────────────────────────
    const requiredChainIds = useMemo<string[]>(() => {
        if (!rawRoute?.required_chain_addresses) return [];
        return rawRoute.required_chain_addresses;
    }, [rawRoute]);

    const requiredChainNames = useMemo(() => {
        return requiredChainIds.map(cid => {
            const chain = getChainByChainId(cid);
            return chain?.prettyName ?? chain?.chainName ?? cid;
        });
    }, [requiredChainIds]);

    // The chains between the source and BeeZee, whose addresses come from Keplr.
    const intermediateChainIds = useMemo(() => {
        return requiredChainIds.filter(chainId =>
            skipChainIdToEvmChainId(chainId) === undefined
            && chainId !== selectedChain?.chain_id
            && chainId !== BZE_SKIP_CHAIN_ID
            && getChainByChainId(chainId)?.chainName !== getChainName(),
        );
    }, [requiredChainIds, selectedChain]);

    // ─── Auto-detect existing connections ──────────────────────────────────
    useEffect(() => {
        if (!rawRoute?.required_chain_addresses?.length) return;
        if (chainsApproved) return;

        // For EVM source: check if EVM wallet is connected
        if (isSourceEvm) {
            if (evmState.isConnected) setChainsApproved(true);
            return;
        }

        // For Cosmos source: the wallet kit must have the account already. While a connect is
        // running, or after one failed, the wallet is not asked again behind the user's back.
        if (!isSourceReady || isConnecting || connectError) return;
        let cancelled = false;
        (async () => {
            try {
                const keplr = (window as any).keplr;
                if (intermediateChainIds.length > 0 && !keplr) return;
                for (const chainId of intermediateChainIds) {
                    const key = await keplr.getKey(chainId);
                    if (!key?.bech32Address) return;
                }
                if (!cancelled) setChainsApproved(true);
            } catch {
                // Not all connected
            }
        })();
        return () => { cancelled = true; };
    }, [rawRoute, chainsApproved, isSourceEvm, evmState.isConnected, isSourceReady, isConnecting, connectError, intermediateChainIds]);

    // ─── Connect handler (Cosmos + EVM) ────────────────────────────────────
    const handleConnectAll = useCallback(async () => {
        connectAttempt.current += 1;
        const attempt = connectAttempt.current;
        setConnectError('');
        setIsConnecting(true);
        try {
            if (isSourceEvm) {
                // EVM: connect wallet + switch to the right chain
                if (!evmWallet.isConnected) {
                    await evmWallet.connectInjected();
                }
                const targetEvmChainId = skipChainIdToEvmChainId(selectedChain?.chain_id ?? '');
                if (targetEvmChainId && evmWallet.chainId !== targetEvmChainId) {
                    await evmWallet.switchChain(targetEvmChainId);
                }
            } else {
                if (!keplrAllowed) throw new Error('BeePocket supports BeeZee only');
                const networkName = sourceDisplayName || 'this network';
                // Cosmos source: through the wallet kit, which fills useChain's address. The
                // wallet shows its approval prompt if it has no access yet.
                if (!sourceAddress) {
                    if (!sourceWallet) {
                        throw new Error(`No wallet is available to connect to ${networkName}. Connect a wallet and try again.`);
                    }
                    try {
                        await sourceWallet.connect();
                    } finally {
                        // A successful connect makes the source the kit's current chain, which
                        // is persisted and decides when the wallet counts as disconnected.
                        // BeeZee stays the app's current chain.
                        walletManager.setCurrentChainName(getChainName());
                    }
                    // connect() resolves on a refusal too: the outcome is in the kit's state.
                    if (sourceWallet.walletState !== WalletState.Connected) {
                        console.error('[buy] source connect failed:', sourceWallet.errorMessage);
                        throw new Error(`Could not connect your wallet to ${networkName}. Approve the request in your wallet and try again.`);
                    }
                }
                // Intermediate chains: via Keplr
                if (intermediateChainIds.length > 0) {
                    const keplr = (window as any).keplr;
                    if (!keplr) {
                        throw new Error('This route passes through other networks and needs Keplr. Try another asset or network.');
                    }
                    try {
                        for (const chainId of intermediateChainIds) {
                            await keplr.enable(chainId);
                        }
                    } catch (e) {
                        console.error('[buy] intermediate chain connect failed:', e);
                        throw new Error('Your wallet did not approve every network on this route. Approve the request and try again.');
                    }
                }
            }
            if (attempt === connectAttempt.current) setChainsApproved(true);
        } catch (e) {
            console.error('[buy] connect failed:', e);
            if (attempt === connectAttempt.current) {
                setConnectError(e instanceof Error && e.message ? e.message : 'Could not connect your wallet. Please try again.');
            }
        } finally {
            if (attempt === connectAttempt.current) setIsConnecting(false);
        }
    }, [isSourceEvm, selectedChain, evmWallet, keplrAllowed, sourceDisplayName, sourceAddress, sourceWallet, intermediateChainIds, walletManager]);

    // ─── Balance fetch (Cosmos only — EVM balance fetch deferred) ──────────
    useEffect(() => {
        if (!allChainsConnected || !selectedChain || isSourceEvm) return;
        if (!sourceAddress) return;

        let cancelled = false;
        setIsLoadingBalances(true);
        (async () => {
            const chainName = getChainByChainId(selectedChain.chain_id)?.chainName ?? selectedChain.chain_name ?? '';
            const restUrl = await getChainRestURL(chainName);
            if (cancelled || !restUrl) { setIsLoadingBalances(false); return; }
            try {
                const res = await fetch(`${restUrl}/cosmos/bank/v1beta1/balances/${sourceAddress}?pagination.limit=500`);
                if (!res.ok) throw new Error(`REST ${res.status}`);
                const data = await res.json();
                const balances: Array<{ denom: string; amount: string }> = data?.balances ?? [];
                const map = new Map<string, string>();
                for (const b of balances) {
                    if (b.amount && b.amount !== '0') map.set(b.denom, b.amount);
                }
                if (!cancelled) setAssetBalances(map);
            } catch { /* non-critical */ }
            finally { if (!cancelled) setIsLoadingBalances(false); }
        })();
        return () => { cancelled = true; };
    }, [allChainsConnected, selectedChain, sourceAddress, isSourceEvm]);

    // ─── Assets with balances ──────────────────────────────────────────────
    const assetsWithBalances = useMemo<SkipAssetWithBalance[]>(() => {
        return skipAssets.map(a => ({
            ...a,
            balanceRaw: assetBalances.get(a.denom),
            balanceDisplay: assetBalances.get(a.denom) && a.decimals
                ? prettyAmount(uAmountToBigNumberAmount(assetBalances.get(a.denom)!, a.decimals))
                : undefined,
        })).sort((a, b) => {
            const aHas = a.balanceRaw ? 1 : 0;
            const bHas = b.balanceRaw ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
            return (a.symbol || '').localeCompare(b.symbol || '');
        });
    }, [skipAssets, assetBalances]);

    // ─── Filtered lists ────────────────────────────────────────────────────
    const filteredChains = useMemo(() => {
        const q = chainSearch.toLowerCase().trim();
        if (!q) return skipChains;
        return skipChains.filter(c =>
            (c.pretty_name || '').toLowerCase().includes(q) ||
            (c.chain_name || '').toLowerCase().includes(q),
        );
    }, [skipChains, chainSearch]);

    const filteredAssets = useMemo(() => {
        const q = assetSearch.toLowerCase().trim();
        if (!q) return assetsWithBalances;
        return assetsWithBalances.filter(a =>
            (a.symbol || '').toLowerCase().includes(q) ||
            (a.name || '').toLowerCase().includes(q),
        );
    }, [assetsWithBalances, assetSearch]);

    // ─── Skip bridge transfer ──────────────────────────────────────────────
    const {executeSkipTransfer, isExecuting, progressMessage} = useSkipBridgeTransfer(sourceChainName);

    const getAddressForChainId = useCallback(async (chainId: string): Promise<string | undefined> => {
        if (chainId === BZE_SKIP_CHAIN_ID || chainId === 'beezee-1') return bzeChain.address;

        // EVM chain ID → return EVM wallet address
        const evmChainId = skipChainIdToEvmChainId(chainId);
        if (evmChainId !== undefined && evmState.address) {
            return evmState.address;
        }

        // Cosmos: source chain
        if (selectedChain && chainId === selectedChain.chain_id && !isSourceEvm) return sourceAddress;
        const resolved = getChainByChainId(chainId);
        if (resolved?.chainName === getChainName()) return bzeChain.address;

        // Cosmos intermediate chain via Keplr
        if (!keplrAllowed) return undefined;
        try {
            const keplr = (window as any).keplr;
            if (keplr) {
                const key = await keplr.getKey(chainId);
                if (key?.bech32Address) return key.bech32Address;
            }
        } catch (e) {
            console.error(`[buy] could not get address for chain ${chainId}:`, e);
        }
        return undefined;
    }, [bzeChain.address, sourceAddress, selectedChain, isSourceEvm, evmState.address, keplrAllowed]);

    // ─── Execute ───────────────────────────────────────────────────────────
    const canExecute = useMemo(() => {
        return selectedChain?.canSign
            && selectedAsset
            && amount !== ''
            && amountError === ''
            && rawRoute
            && !isExecuting
            && !isLoadingRoute
            && allChainsConnected
            && bzeChain.address;
    }, [selectedChain, selectedAsset, amount, amountError, rawRoute, isExecuting, isLoadingRoute, allChainsConnected, bzeChain.address]);

    const {toast} = useToast();

    const handleExecute = useCallback(async () => {
        if (!rawRoute || !selectedChain || !selectedAsset) return;
        const result = await executeSkipTransfer(rawRoute, getAddressForChainId);
        if (result.success) {
            // Track the transaction for status polling
            addTransaction?.({
                direction: 'deposit',
                sourceChainName: selectedChain.pretty_name || selectedChain.chain_name || selectedChain.chain_id,
                destChainName: 'BeeZee',
                assetTicker: selectedAsset.symbol || '?',
                amountIn: amount,
                estimatedAmountOut: routePreview?.estimatedOutput || '?',
                mechanism: 'skip',
                txHash: result.txHash,
                broadcastChainId: result.chainId,
            });
            toast.success(
                'Swap submitted',
                'Your transaction is being processed. You can track its progress in the wallet view.',
            );
            // Reset form and close the Buy BZE view so the user sees
            // the pending transaction in the balances view.
            setAmount(''); setSelectedAsset(undefined); setSelectedChain(undefined);
            setChainSearch(''); setAssetSearch(''); setAssetBalances(new Map());
            resetConnection();
            onDone?.();
        } else if (result.error) {
            setAmountError(result.error);
        }
    }, [rawRoute, selectedChain, selectedAsset, amount, routePreview, executeSkipTransfer, getAddressForChainId, addTransaction, toast, onDone, resetConnection]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onChainSelect = useCallback((chain: SkipChainWithStatus) => {
        if (!chain.canSign) return;
        setSelectedChain(chain); setSelectedAsset(undefined);
        setAmount(''); setAmountError(''); setChainSearch(''); setAssetSearch('');
        setAssetBalances(new Map()); resetConnection();
    }, [resetConnection]);

    const onAssetSelect = useCallback((asset: SkipAsset) => {
        setSelectedAsset(asset); setAmount(''); setAmountError('');
        setAssetSearch(''); resetConnection();
    }, [resetConnection]);

    const onAmountChange = useCallback((value: string) => {
        setAmount(sanitizeNumberInput(value)); setAmountError('');
    }, []);

    // MAX fills the full balance on the source chain on purpose: the Skip route is signed on
    // that chain and its gas is paid there, outside BeeZee's gas engine (useMaxSpendable).
    const setMaxAmount = useCallback(() => {
        if (!selectedAsset || !selectedAsset.decimals) return;
        const raw = assetBalances.get(selectedAsset.denom);
        if (!raw) return;
        setAmount(uAmountToBigNumberAmount(raw, selectedAsset.decimals).toString());
        setAmountError('');
    }, [selectedAsset, assetBalances]);

    const feeDisplay = useMemo(() => {
        if (!routePreview || routePreview.fees.length === 0) return undefined;
        return routePreview.fees
            .map(f => {
                if (f.usdValue) {
                    const usd = parseFloat(f.usdValue);
                    return `$${isNaN(usd) ? f.usdValue : usd.toFixed(2)}`;
                }
                return `${f.amount} ${f.ticker}`;
            })
            .join(' + ');
    }, [routePreview]);

    const needsConnect = rawRoute && requiredChainIds.length > 0 && !allChainsConnected;

    // ─── Resets and EVM connections, for the pickers' "Change" buttons ─────
    const clearChain = useCallback(() => {
        setSelectedChain(undefined); setSelectedAsset(undefined);
        setAmount(''); setAmountError(''); setAssetBalances(new Map());
        resetConnection();
    }, [resetConnection]);

    const clearAsset = useCallback(() => {
        setSelectedAsset(undefined); setAmount(''); setAmountError('');
        resetConnection();
    }, [resetConnection]);

    const connectEvm = useCallback(async (kind: 'injected' | 'walletconnect') => {
        setIsConnecting(true);
        try {
            if (kind === 'injected') await evmWallet.connectInjected();
            else await evmWallet.connectWalletConnect();
            setChainsApproved(true);
        } catch {
            // The wallet's own UI reports the refusal.
        } finally {
            setIsConnecting(false);
        }
    }, [evmWallet]);

    return {
        // Pickers
        skipChains, isLoadingChains, chainsError, filteredChains, chainSearch, setChainSearch,
        selectedChain, onChainSelect, clearChain, sourceDisplayName,
        assetsWithBalances, isLoadingAssets, assetsError, filteredAssets, assetSearch, setAssetSearch,
        selectedAsset, onAssetSelect, clearAsset,
        // Amount and balances
        amount, amountError, onAmountChange, setMaxAmount, assetBalances, isLoadingBalances,
        // Route
        routePreview, rawRoute, isLoadingRoute, routeError, feeDisplay,
        // Connections
        isSourceEvm, needsConnect: Boolean(needsConnect), requiredChainNames, allChainsConnected,
        isConnecting, connectError, handleConnectAll, connectEvm, evmState, evmWallet,
        // Transfer
        canExecute: Boolean(canExecute), handleExecute, isExecuting, progressMessage,
    };
}

export type UseBuyBzeResult = ReturnType<typeof useBuyBze>;
