'use client';

import {Box, Container, Text, VStack, HStack, Button, Spinner} from '@chakra-ui/react';
import {LuRefreshCw, LuWallet} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {getChainName, Sidebar, WalletSidebarContent, useValidatorLogos} from '@bze/bze-ui-kit';
import {WalletState} from '@interchain-kit/core';
import {useNativeStakingData} from '@/hooks/useNativeStakingData';
import {StakingOverview} from '@/components/staking/overview';
import {MyValidators} from '@/components/staking/my-validators';
import {UnbondingDelegations} from '@/components/staking/unbonding-delegations';
import {ValidatorsList} from '@/components/staking/validators-list';
import {useState, useCallback} from 'react';

export default function StakingPage() {
    const {status} = useChain(getChainName());
    const {isLoading, reload, fullData} = useNativeStakingData();
    const {logos} = useValidatorLogos(fullData?.allValidators ?? []);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isConnected = status === WalletState.Connected;

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await reload();
        setIsRefreshing(false);
    }, [reload]);

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
                        onActionComplete={handleRefresh}
                        logos={logos}
                    />
                </Box>
            )}
        </Box>
    );
}
