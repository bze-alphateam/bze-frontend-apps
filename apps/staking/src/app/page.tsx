'use client';

import {Box, Container, Text, VStack, HStack, Button, Spinner} from '@chakra-ui/react';
import {LuRefreshCw, LuWallet} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {getChainName, Sidebar, WalletSidebarContent, useValidatorLogos, useToast} from '@bze/bze-ui-kit';
import {WalletState} from '@interchain-kit/core';
import {useNativeStakingData} from '@/hooks/useNativeStakingData';
import {StakingOverview} from '@/components/staking/overview';
import {MyValidators} from '@/components/staking/my-validators';
import {UnbondingDelegations} from '@/components/staking/unbonding-delegations';
import {ValidatorsList} from '@/components/staking/validators-list';
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

    if (isLoading && !fullData) {
        return (
            <Box minH="60vh" display="flex" alignItems="center" justifyContent="center">
                <VStack gap="4">
                    <Spinner size="lg" color="purple.500" />
                    <Text color="fg.muted">Loading staking data...</Text>
                </VStack>
            </Box>
        );
    }

    return (
        <Box pb="12">
            <Suspense fallback={null}>
                <StakeLinkHandler
                    validators={fullData?.allValidators}
                    isConnecting={status === WalletState.Connecting}
                    openDelegate={openDelegate}
                    highlight={highlight}
                    notify={notify}
                />
            </Suspense>

            {/* Overview Stats */}
            <StakingOverview
                stakingData={fullData?.stakingData}
                isLoading={isLoading}
            />

            {/* Action Bar */}
            <Container maxW="7xl" py="2">
                <HStack justify="space-between" flexWrap="wrap" gap="2">
                    <HStack gap="2">
                        {!isConnected && (
                            <Sidebar
                                ariaLabel="Connect Wallet"
                                isOpen={isConnectOpen}
                                onOpenChange={handleConnectOpenChange}
                                trigger={
                                    <Button size="sm" colorPalette="purple">
                                        <LuWallet /> Connect Wallet to Stake
                                    </Button>
                                }
                            >
                                <WalletSidebarContent accentColor="purple" skipWalletModal />
                            </Sidebar>
                        )}
                    </HStack>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRefresh}
                        loading={isRefreshing}
                    >
                        <LuRefreshCw /> Refresh
                    </Button>
                </HStack>
            </Container>

            {/* My Validators (only if connected and has delegations) */}
            {isConnected && fullData && fullData.myValidators.length > 0 && (
                <MyValidators
                    myValidators={fullData.myValidators}
                    allValidators={fullData.allValidators}
                    onActionComplete={handleRefresh}
                    logos={logos}
                    unbondingDays={fullData.stakingData?.unlockDuration}
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
                <Box mt="6">
                    <ValidatorsList
                        validators={fullData.allValidators}
                        onStake={openDelegate}
                        logos={logos}
                        highlightedOperator={highlighted}
                    />
                </Box>
            )}

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
