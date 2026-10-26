'use client'

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useChain, useWalletManager} from '@interchain-kit/react';
import {useSkipChains, type SkipChainWithStatus} from './useSkipChains';
import {useSkipAssets} from './useSkipAssets';
import {useBuyRoute} from './useBuyRoute';
import {useSkipBridgeTransfer} from './useSkipBridgeTransfer';
import {useEvmWalletState} from '../evm/context';
import {useEvmWallet} from './useEvmWallet';
import {sanitizeNumberInput} from '../utils/number';
import {prettyAmount, uAmountToBigNumberAmount} from '../utils/amount';
import {getChainName, getChainByChainId, getWalletChainsNames, getChains, getAssetLists} from '../constants/chain';
import {getChainRestURL} from '../constants/endpoints';
import {BZE_SKIP_CHAIN_ID} from '../constants/cross_chain';
import {skipChainIdToEvmChainId} from '../utils/evm';
import type {UseSkipTxTrackerReturn} from './useSkipTxTracker';
import {useToast} from './useToast';
import type {SkipAsset} from '../types/cross_chain';

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
    const [allChainsConnected, setAllChainsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // ─── Chain type detection ──────────────────────────────────────────────
    const isSourceEvm = selectedChain?.chain_type === 'evm';

    // ─── Data hooks ────────────────────────────────────────────────────────
    const {chains: skipChains, isLoading: isLoadingChains, error: chainsError} = useSkipChains();
    const {assets: skipAssets, isLoading: isLoadingAssets, error: assetsError} = useSkipAssets(selectedChain?.chain_id);
    const {routePreview, rawRoute, isLoading: isLoadingRoute, error: routeError} = useBuyRoute(
        selectedChain?.chain_id, selectedAsset?.denom, selectedAsset?.decimals, amount,
    );

    // ─── Cosmos wallet ─────────────────────────────────────────────────────
    // Chains are dynamically registered with ChainProvider when the user selects
    // them in the Buy BZE picker. Only BZE's IBC counterparties are pre-registered
    // at mount; all other Cosmos chains (e.g. Injective, Stride) get added on demand
    // via walletManager.addChains() when selected. This avoids loading 100+ chains
    // at startup (which causes Keplr errors for broken/unknown chains) while still
    // letting useChain() work for any chain the user actually picks.
    const walletManager = useWalletManager();
    const [registeredChainNames, setRegisteredChainNames] = useState(() =>
        new Set(getWalletChainsNames().map((c: any) => (c.chainName || '').toLowerCase()))
    );

    // Dynamically register a chain with ChainProvider when user selects it
    const ensureChainRegistered = useCallback(async (chainName: string) => {
        if (registeredChainNames.has(chainName.toLowerCase())) return;
        const allChains = getChains() as any[];
        const chain = allChains.find((c: any) => (c.chainName || '').toLowerCase() === chainName.toLowerCase());
        if (!chain) return;
        const allAssetLists = getAssetLists() as any[];
        const assetList = allAssetLists.find((a: any) => (a.chainName || '').toLowerCase() === chainName.toLowerCase());
        try {
            await (walletManager as any).addChains(
                [chain],
                assetList ? [assetList] : [],
                {signing: () => ({preferredSignType: 'amino'})},
            );
            setRegisteredChainNames(prev => new Set([...prev, chainName.toLowerCase()]));
        } catch (e) {
            console.error('[buy] failed to register chain dynamically:', chainName, e);
        }
    }, [walletManager]);

    const sourceChainName = useMemo(() => {
        if (!selectedChain || !selectedChain.canSign || isSourceEvm) return getChainName();
        const registryChain = getChainByChainId(selectedChain.chain_id);
        const name = registryChain?.chainName ?? selectedChain.chain_name ?? '';
        return registeredChainNames.has(name.toLowerCase()) ? name : getChainName();
    }, [selectedChain, isSourceEvm, registeredChainNames]);

    const {address: sourceAddress} = useChain(sourceChainName);
    const bzeChain = useChain(getChainName());

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

    // ─── Auto-detect existing connections ──────────────────────────────────
    useEffect(() => {
        if (!rawRoute?.required_chain_addresses?.length) return;
        if (allChainsConnected) return;

        // For EVM source: check if EVM wallet is connected
        if (isSourceEvm) {
            if (evmState.isConnected) setAllChainsConnected(true);
            return;
        }

        // For Cosmos source: check Keplr keys
        let cancelled = false;
        (async () => {
            const keplr = (window as any).keplr;
            if (!keplr) return;
            try {
                for (const chainId of rawRoute.required_chain_addresses) {
                    // Skip EVM chain IDs in the required list (intermediate chains
                    // on Cosmos routes are always Cosmos)
                    if (skipChainIdToEvmChainId(chainId) !== undefined) continue;
                    const key = await keplr.getKey(chainId);
                    if (!key?.bech32Address) return;
                }
                if (!cancelled) setAllChainsConnected(true);
            } catch {
                // Not all connected
            }
        })();
        return () => { cancelled = true; };
    }, [rawRoute, allChainsConnected, isSourceEvm, evmState.isConnected]);

    // ─── Connect handler (Cosmos + EVM) ────────────────────────────────────
    const handleConnectAll = useCallback(async () => {
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
                // Cosmos: enable all required chains via Keplr
                const keplr = (window as any).keplr;
                if (keplr) {
                    for (const chainId of requiredChainIds) {
                        if (skipChainIdToEvmChainId(chainId) !== undefined) continue;
                        await keplr.enable(chainId);
                    }
                }
            }
            setAllChainsConnected(true);
        } catch (e) {
            console.error('[buy] connect failed:', e);
        } finally {
            setIsConnecting(false);
        }
    }, [isSourceEvm, requiredChainIds, selectedChain, evmWallet, evmState]);

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
    }, [bzeChain.address, sourceAddress, selectedChain, isSourceEvm, evmState.address]);

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
            setAllChainsConnected(false);
            onDone?.();
        } else if (result.error) {
            setAmountError(result.error);
        }
    }, [rawRoute, selectedChain, selectedAsset, amount, routePreview, executeSkipTransfer, getAddressForChainId, addTransaction, toast, onDone]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onChainSelect = useCallback(async (chain: SkipChainWithStatus) => {
        if (!chain.canSign) return;
        // For Cosmos chains not yet registered with ChainProvider, register
        // them now so useChain/useSDKTx can work when the user proceeds to sign.
        if (chain.chain_type === 'cosmos') {
            const registryChain = getChainByChainId(chain.chain_id);
            const name = registryChain?.chainName ?? chain.chain_name ?? '';
            if (name) await ensureChainRegistered(name);
        }
        setSelectedChain(chain); setSelectedAsset(undefined);
        setAmount(''); setAmountError(''); setChainSearch(''); setAssetSearch('');
        setAssetBalances(new Map()); setAllChainsConnected(false);
    }, [ensureChainRegistered]);

    const onAssetSelect = useCallback((asset: SkipAsset) => {
        setSelectedAsset(asset); setAmount(''); setAmountError('');
        setAssetSearch(''); setAllChainsConnected(false);
    }, []);

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

    const sourceDisplayName = selectedChain?.pretty_name || selectedChain?.chain_name || '';

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
        setAllChainsConnected(false);
    }, []);

    const clearAsset = useCallback(() => {
        setSelectedAsset(undefined); setAmount(''); setAmountError('');
        setAllChainsConnected(false);
    }, []);

    const connectEvm = useCallback(async (kind: 'injected' | 'walletconnect') => {
        setIsConnecting(true);
        try {
            if (kind === 'injected') await evmWallet.connectInjected();
            else await evmWallet.connectWalletConnect();
            setAllChainsConnected(true);
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
        isConnecting, handleConnectAll, connectEvm, evmState, evmWallet,
        // Transfer
        canExecute: Boolean(canExecute), handleExecute, isExecuting, progressMessage,
    };
}

export type UseBuyBzeResult = ReturnType<typeof useBuyBze>;
