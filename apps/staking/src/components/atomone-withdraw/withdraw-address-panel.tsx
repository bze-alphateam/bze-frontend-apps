'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {Box, Button, chakra, Flex, Input, Link} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import type {StdFee} from '@bze/bzejs/types';
import {getChainByName, getChainRestURL, HgCard, hgVariant, useSDKTx, validateBech32Address} from '@bze/bze-ui-kit';
import {
    ATOMONE_CHAIN_NAME,
    ATOMONE_FEE_DENOM,
    ATOMONE_PREFIX,
    ATOMONE_TX_MEMO,
    buildSetWithdrawAddressMsg,
    estimateSetWithdrawAddressFee,
    explorerTxUrl,
    fetchBalance,
    fetchWithdrawAddress,
    formatPhoton,
} from '@/lib/atomone-withdraw';

/** One async read keyed by its inputs: a result for other inputs counts as not loaded. */
interface Loaded<T> {
    key: string;
    value?: T;
    error?: string;
}

const errText = (e: unknown) => (e as Error)?.message || String(e);

type Step =
    | {kind: 'edit'}
    | {kind: 'estimating'}
    /** `from` is the account the fee was simulated for. */
    | {kind: 'confirm'; from: string; target: string; fee: StdFee}
    | {kind: 'signing'; target: string}
    | {kind: 'done'; txHash: string; target: string; failed?: string};

const Label = ({children}: {children: React.ReactNode}) => (
    <chakra.span fontSize="12px" fontWeight="600" color="hg.text.faint">{children}</chakra.span>
);

const Mono = ({children}: {children: React.ReactNode}) => (
    <chakra.span fontFamily="var(--font-mono)" fontSize="14px" wordBreak="break-all">{children}</chakra.span>
);

/** Connect an AtomOne wallet and change where its staking rewards are paid. */
export function WithdrawAddressPanel() {
    const {status, address, wallet, connect} = useChain(ATOMONE_CHAIN_NAME);
    const {tx} = useSDKTx(ATOMONE_CHAIN_NAME);
    const isConnected = status === WalletState.Connected && !!address;

    const txPageTemplate = useMemo(() => {
        const chain = getChainByName(ATOMONE_CHAIN_NAME) as unknown as {explorers?: Array<{txPage?: string}>} | undefined;
        return chain?.explorers?.find(e => !!e.txPage)?.txPage;
    }, []);

    const [restUrl, setRestUrl] = useState<Loaded<string>>({key: ''});
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const url = await getChainRestURL(ATOMONE_CHAIN_NAME);
                if (!cancelled) setRestUrl({key: 'rest', value: url || undefined, error: url ? undefined : 'No reachable AtomOne REST endpoint.'});
            } catch (e) {
                if (!cancelled) setRestUrl({key: 'rest', error: errText(e)});
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    // Bumped after a successful tx to re-read the withdraw address and balance.
    const [refresh, setRefresh] = useState(0);
    const accountKey = `${restUrl.value ?? ''}|${address ?? ''}|${refresh}`;
    const [account, setAccount] = useState<Loaded<{withdraw: string; photon: string}>>({key: ''});
    useEffect(() => {
        const rest = restUrl.value;
        if (!rest || !address) return;
        let cancelled = false;
        const key = `${rest}|${address}|${refresh}`;
        const load = async () => {
            try {
                const [withdraw, photon] = await Promise.all([
                    fetchWithdrawAddress(rest, address),
                    fetchBalance(rest, address, ATOMONE_FEE_DENOM),
                ]);
                if (!cancelled) setAccount({key, value: {withdraw, photon}});
            } catch (e) {
                if (!cancelled) setAccount({key, error: errText(e)});
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [restUrl.value, address, refresh]);
    const accountLoaded = account.key === accountKey ? account : undefined;

    const [input, setInput] = useState('');
    const [step, setStep] = useState<Step>({kind: 'edit'});
    const [stepError, setStepError] = useState('');

    // Bech32 is case-insensitive; the chain stores the lowercase form.
    const target = input.trim().toLowerCase();
    const validation = useMemo(() => (target ? validateBech32Address(target, ATOMONE_PREFIX) : undefined), [target]);
    const isSameAsCurrent = !!accountLoaded?.value && accountLoaded.value.withdraw === target;
    const noPhoton = !!accountLoaded?.value && accountLoaded.value.photon === '0';

    const handleConnect = useCallback(async () => {
        const ws = wallet as unknown as {connect?: () => Promise<void>} | undefined;
        if (ws && typeof ws.connect === 'function') {
            try {
                await ws.connect();
                return;
            } catch (e) {
                console.error('[atomone] connect failed:', e);
            }
        }
        connect();
    }, [wallet, connect]);

    const handleReview = useCallback(async () => {
        if (!restUrl.value || !address || !validation?.isValid) return;
        setStepError('');
        setStep({kind: 'estimating'});
        try {
            const fee = await estimateSetWithdrawAddressFee(restUrl.value, address, target);
            setStep({kind: 'confirm', from: address, target, fee});
        } catch (e) {
            setStep({kind: 'edit'});
            setStepError(`The transaction would fail: ${errText(e)}`);
        }
    }, [restUrl.value, address, validation, target]);

    const handleSign = useCallback(async () => {
        if (step.kind !== 'confirm' || !address || step.from !== address) return;
        const {target: to, fee} = step;
        let hash = '';
        // useTx returns false without a callback when it has no signing client.
        let reported = false;
        setStep({kind: 'signing', target: to});
        const ok = await tx([buildSetWithdrawAddressMsg(address, to)], {
            fee,
            memo: ATOMONE_TX_MEMO,
            toasts: false,
            onBroadcast: (h) => {
                hash = h;
            },
            onFailure: (reason, details) => {
                reported = true;
                if (details?.txHash) hash = details.txHash;
                if (hash) {
                    setStep({kind: 'done', txHash: hash, target: to, failed: reason});
                } else {
                    setStep({kind: 'edit'});
                    setStepError(reason);
                }
            },
            onSuccess: (res) => {
                reported = true;
                setStep({kind: 'done', txHash: res.txhash || hash, target: to});
            },
        });
        if (ok) {
            setInput('');
            setRefresh(r => r + 1);
        } else if (!reported) {
            setStep(s => (s.kind === 'signing' ? {kind: 'edit'} : s));
            setStepError('The wallet could not sign. Make sure it is unlocked and connected to AtomOne, then try again.');
        }
    }, [step, address, tx]);

    // A confirmation priced for another account (the wallet switched accounts) is dropped: review again.
    const view: Step = step.kind === 'confirm' && step.from !== address ? {kind: 'edit'} : step;

    if (restUrl.key && restUrl.error) {
        return <HgCard p="18px"><chakra.span color="fg.error">{`Can't reach AtomOne: ${restUrl.error}`}</chakra.span></HgCard>;
    }

    if (!isConnected) {
        return (
            <HgCard p="18px" display="flex" flexDirection="column" gap="12px">
                <chakra.span>Connect the wallet that holds your AtomOne (atone1…) account.</chakra.span>
                <Button variant={hgVariant('primary')} onClick={handleConnect} loading={status === WalletState.Connecting}>
                    Connect AtomOne wallet
                </Button>
            </HgCard>
        );
    }

    return (
        <Flex direction="column" gap="16px">
            <HgCard p="18px" display="flex" flexDirection="column" gap="12px">
                <Box><Label>Connected account</Label><Box><Mono>{address}</Mono></Box></Box>
                <Box>
                    <Label>Current rewards withdraw address</Label>
                    <Box>
                        {accountLoaded?.value ? <Mono>{accountLoaded.value.withdraw}</Mono>
                            : accountLoaded?.error ? <chakra.span color="fg.error">{accountLoaded.error}</chakra.span>
                                : <chakra.span color="fg.muted">Loading…</chakra.span>}
                    </Box>
                    {accountLoaded?.value && accountLoaded.value.withdraw === address && (
                        <chakra.span fontSize="12px" color="fg.muted">Rewards are paid to this account itself.</chakra.span>
                    )}
                </Box>
                {accountLoaded?.value && (
                    <Box>
                        <Label>PHOTON balance (pays the fee)</Label>
                        <Box>{`${formatPhoton(accountLoaded.value.photon)} PHOTON`}</Box>
                        {noPhoton && (
                            <chakra.span fontSize="12px" color="hg.warning">
                                AtomOne fees are paid in PHOTON only. This account has none: mint PHOTON from ATONE (or receive some) before continuing.
                            </chakra.span>
                        )}
                    </Box>
                )}
            </HgCard>

            {view.kind === 'done' ? (
                <HgCard p="18px" display="flex" flexDirection="column" gap="10px">
                    <chakra.span fontWeight="700" color={view.failed ? 'fg.error' : undefined}>
                        {view.failed ? `Transaction failed or not confirmed yet: ${view.failed}` : 'Withdraw address changed.'}
                    </chakra.span>
                    <Box><Label>New withdraw address</Label><Box><Mono>{view.target}</Mono></Box></Box>
                    <Box><Label>Transaction hash</Label><Box><Mono>{view.txHash}</Mono></Box></Box>
                    <Link href={explorerTxUrl(view.txHash, txPageTemplate)} target="_blank" rel="noopener noreferrer" color="hg.accent">
                        View on an AtomOne explorer
                    </Link>
                    <Button variant={hgVariant('secondary')} onClick={() => setStep({kind: 'edit'})}>Done</Button>
                </HgCard>
            ) : view.kind === 'confirm' || view.kind === 'signing' ? (
                <HgCard p="18px" display="flex" flexDirection="column" gap="12px">
                    <chakra.span fontWeight="700">Confirm</chakra.span>
                    <chakra.span>
                        From now on, all staking rewards of <Mono>{address}</Mono> on AtomOne will be paid to:
                    </chakra.span>
                    <Box p="12px" borderWidth="1px" borderRadius="md"><Mono>{view.target}</Mono></Box>
                    <chakra.span fontSize="13px" color="fg.muted">
                        Check every character. Rewards sent to a wrong address can not be recovered. This also applies when rewards are withdrawn automatically (e.g. on delegation changes).
                    </chakra.span>
                    {view.kind === 'confirm' && (
                        <chakra.span fontSize="13px" color="fg.muted">
                            {`Network fee: ${formatPhoton(view.fee.amount[0]?.amount ?? '0')} PHOTON (gas ${view.fee.gas})`}
                        </chakra.span>
                    )}
                    <Flex gap="8px">
                        <Button variant={hgVariant('secondary')} onClick={() => setStep({kind: 'edit'})} disabled={view.kind === 'signing'}>Back</Button>
                        <Button variant={hgVariant('primary')} onClick={handleSign} loading={view.kind === 'signing'} flex="1">
                            Sign and send
                        </Button>
                    </Flex>
                </HgCard>
            ) : (
                <HgCard p="18px" display="flex" flexDirection="column" gap="12px">
                    <Label>New withdraw address</Label>
                    <Input
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            setStepError('');
                        }}
                        placeholder="atone1…"
                        fontFamily="var(--font-mono)"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {validation && !validation.isValid && <chakra.span fontSize="13px" color="fg.error">{validation.message}</chakra.span>}
                    {isSameAsCurrent && <chakra.span fontSize="13px" color="fg.muted">This is already the withdraw address.</chakra.span>}
                    {stepError && <chakra.span fontSize="13px" color="fg.error">{stepError}</chakra.span>}
                    <Button
                        variant={hgVariant('primary')}
                        onClick={handleReview}
                        loading={view.kind === 'estimating'}
                        disabled={!validation?.isValid || isSameAsCurrent || !restUrl.value}
                    >
                        Review
                    </Button>
                </HgCard>
            )}
        </Flex>
    );
}
