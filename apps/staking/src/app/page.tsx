'use client';

import {Box, Button, chakra} from '@chakra-ui/react';
import {LuRefreshCw, LuWallet} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {getChainName, HeroGlow, hgVariant, PageContainer, Sidebar, WalletSidebarContent, useValidatorLogos, useToast} from '@bze/bze-ui-kit';
import {WalletState} from '@interchain-kit/core';
import {useNativeStakingData} from '@/hooks/useNativeStakingData';
import {StakingOverview} from '@/components/staking/overview';
import {GovernanceCallout} from '@/components/governance/governance-callout';
import {MyValidators} from '@/components/staking/my-validators';
import {UnbondingDelegations} from '@/components/staking/unbonding-delegations';
import {ValidatorsList} from '@/components/staking/validators-list';
import {ValidatorsLoading} from '@/components/staking/validators-loading';
import {VALIDATORS_ANCHOR} from '@/lib/validator-list';
import {quietButton} from '@/components/ui/staking/parts';
import {DelegateModal} from '@/components/staking/delegate-modal';
import {StakeLinkHandler} from '@/components/staking/stake-link-handler';
import {validatorRowId} from '@/lib/stake-link';
import {useState, useCallback, useRef, Suspense} from 'react';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

const HIGHLIGHT_MS = 4000;

export default function StakingPage() {
    const {status} = useChain(getChainName());
    const {isLoading, reload, fullData} = useNativeStakingData();
    const {logos} = useValidatorLogos(fullData?.allValidators ?? []);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isConnected = status === WalletState.Connected;
    const {toast} = useToast();

    // Delegate form, shared by the validators list and stake links.
    const [delegateValidator, setDelegateValidator] = useState<ValidatorSDKType | null>(null);
    const [isDelegateOpen, setIsDelegateOpen] = useState(false);
    // Bumped on each open so the modal remounts with fresh local state.
    const [modalNonce, setModalNonce] = useState(0);
    const [isConnectOpen, setIsConnectOpen] = useState(false);
    // The delegate form set aside while its "Connect Wallet" button has the wallet sidebar open:
    // it comes back once the wallet connects or the sidebar closes.
    const [resumeDelegate, setResumeDelegate] = useState(false);
    const [highlighted, setHighlighted] = useState<string | null>(null);
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await reload();
        setIsRefreshing(false);
    }, [reload]);

    const openDelegate = useCallback((validator: ValidatorSDKType) => {
        setDelegateValidator(validator);
        setIsDelegateOpen(true);
        setModalNonce(n => n + 1);
    }, []);

    const handleDelegateComplete = useCallback(() => {
        setIsDelegateOpen(false);
        handleRefresh();
    }, [handleRefresh]);

    const connectFromForm = useCallback(() => {
        setIsDelegateOpen(false);
        setResumeDelegate(true);
        setIsConnectOpen(true);
    }, []);

    const handleConnectOpenChange = useCallback((open: boolean) => {
        setIsConnectOpen(open);
        if (!open && resumeDelegate) {
            setResumeDelegate(false);
            setIsDelegateOpen(true);
        }
    }, [resumeDelegate]);

    // Connecting unmounts the sidebar without a close event, so the form comes back here (state
    // adjusted during render, React's pattern for reacting to a changed value).
    if (isConnected && resumeDelegate) {
        setResumeDelegate(false);
        setIsConnectOpen(false);
        setIsDelegateOpen(true);
    }

    const highlight = useCallback((operatorAddress: string) => {
        setHighlighted(operatorAddress);
        if (highlightTimer.current) {
            clearTimeout(highlightTimer.current);
        }
        highlightTimer.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
        requestAnimationFrame(() => {
            document.getElementById(validatorRowId(operatorAddress))?.scrollIntoView?.({behavior: 'smooth', block: 'center'});
        });
    }, []);

    const notify = useCallback((title: string) => toast.info(title), [toast]);

    const loading = isLoading && !fullData;
    const showMyValidators = isConnected && !!fullData && fullData.myValidators.length > 0;

    const refreshButton = (
        // Icon-only on a phone, where it sits beside the validator search.
        <Button size="md" {...quietButton} px={{base: '0', sm: '4'}} minW="10" aria-label="Refresh" onClick={handleRefresh} loading={isRefreshing}>
            <LuRefreshCw /><chakra.span hideBelow="sm">Refresh</chakra.span>
        </Button>
    );

    const heroActions = (
        <>
            {!isConnected && (
                <Sidebar
                    ariaLabel="Connect Wallet"
                    isOpen={isConnectOpen}
                    onOpenChange={handleConnectOpenChange}
                    trigger={
                        <Button variant={hgVariant('primary')} size="xl" w={{base: 'full', md: 'auto'}}>
                            <LuWallet /> Connect Wallet to Stake
                        </Button>
                    }
                >
                    <WalletSidebarContent skipWalletModal />
                </Sidebar>
            )}
            <Button asChild variant={hgVariant('secondary')} size="xl" display={{base: 'none', md: 'inline-flex'}}>
                <a href={`#${VALIDATORS_ANCHOR}`}>Browse validators</a>
            </Button>
        </>
    );

    return (
        <Box position="relative" overflow="hidden">
            <HeroGlow />
            <PageContainer
                as="main"
                position="relative"
                zIndex="1"
                pt={{base: '32px', md: '72px'}}
                pb={{base: '48px', md: '80px'}}
                display="flex"
                flexDirection="column"
                gap={{base: '28px', md: '40px'}}
                aria-busy={loading || undefined}
                aria-label={loading ? 'Loading staking data' : undefined}
            >
                <Suspense fallback={null}>
                    <StakeLinkHandler
                        validators={fullData?.allValidators}
                        isConnecting={status === WalletState.Connecting}
                        openDelegate={openDelegate}
                        highlight={highlight}
                        notify={notify}
                    />
                </Suspense>

                <StakingOverview
                    stakingData={fullData?.stakingData}
                    isLoading={isLoading}
                    callout={<GovernanceCallout />}
                    actions={heroActions}
                />

                {loading && <ValidatorsLoading />}

                {/* My Validators (only if connected and has delegations) */}
                {fullData && showMyValidators && (
                    <MyValidators
                        myValidators={fullData.myValidators}
                        allValidators={fullData.allValidators}
                        onActionComplete={handleRefresh}
                        logos={logos}
                        unbondingDays={fullData.stakingData?.unlockDuration}
                        actions={refreshButton}
                    />
                )}

                {/* Unbonding Delegations */}
                {isConnected && fullData && fullData.unbondingDelegations.length > 0 && (
                    <UnbondingDelegations
                        unbondingDelegations={fullData.unbondingDelegations}
                        allValidators={fullData.allValidators}
                        logos={logos}
                    />
                )}

                {/* All Validators */}
                {fullData && fullData.allValidators.length > 0 && (
                    <ValidatorsList
                        validators={fullData.allValidators}
                        onStake={openDelegate}
                        logos={logos}
                        highlightedOperator={highlighted}
                        actions={showMyValidators ? undefined : refreshButton}
                    />
                )}
            </PageContainer>

            <DelegateModal
                key={`delegate-${modalNonce}`}
                isOpen={isDelegateOpen}
                onClose={() => setIsDelegateOpen(false)}
                validator={delegateValidator}
                onSuccess={handleDelegateComplete}
                onConnectWallet={connectFromForm}
            />
        </Box>
    );
}
