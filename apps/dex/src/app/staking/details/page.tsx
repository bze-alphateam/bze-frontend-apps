'use client';

import {Suspense, useCallback, useEffect, useState} from 'react';
import {Box, Button, chakra, Flex, Grid} from '@chakra-ui/react';
import Link from 'next/link';
import {LuArrowLeft, LuSearchX} from 'react-icons/lu';
import {HeroGlow, HgCard, hgVariant, IconTile, PageContainer, Shimmer} from "@bze/bze-ui-kit";
import {useNavigationWithParams} from "@/hooks/useNavigation";
import {useStakingRows} from "@/hooks/useStakingRows";
import {RowDialog, type RowDialogView} from "@/components/ui/staking/row-dialog";
import {RewardFacts, RewardHeader, RewardPrizes, RewardRail} from "@/components/ui/staking/reward-details";

//150 seconds
const STAKING_DATA_RELOAD_INTERVAL = 150_000;

const BackToStaking = ({children = 'Staking'}: { children?: string }) => (
    <Button asChild alignSelf="flex-start" variant="ghost" size="md" px="12px" color="hg.text.secondary">
        <Link href="/staking"><LuArrowLeft aria-hidden="true"/>{children}</Link>
    </Button>
);

/** One simple or compounded reward, by `?id=` (the row id the /staking tables link with). */
const RewardDetailsContent = () => {
    const {idParam} = useNavigationWithParams()
    const {rows, address, isLoading, reload} = useStakingRows()
    const [dialog, setDialog] = useState<{ view: RowDialogView; amount?: string } | undefined>()

    // native staking has no page here: it lives in the Staking app
    const row = idParam && idParam !== 'native' ? rows.find(r => r.id === idParam) : undefined
    const notFound = !isLoading && !row

    const closeDialog = useCallback(() => setDialog(undefined), [])
    const onDone = useCallback(() => {
        setDialog(undefined)
        reload()
    }, [reload])

    useEffect(() => {
        const reloadInterval = setInterval(reload, STAKING_DATA_RELOAD_INTERVAL)
        return () => clearInterval(reloadInterval)
    }, [reload])

    return (
        <Box position="relative" minH="100vh">
            <HeroGlow strength="inner" h="420px"/>
            <PageContainer position="relative" zIndex="1" pt="28px" pb="80px">
                <Flex direction="column" gap="20px">
                    <BackToStaking/>

                    {!row && isLoading && (
                        <Flex direction="column" gap="16px" aria-busy="true">
                            <Shimmer h="120px" borderRadius="22px"/>
                            <Shimmer h="300px" borderRadius="22px"/>
                        </Flex>
                    )}

                    {notFound && (
                        <HgCard borderRadius="22px">
                            <Flex direction="column" align="center" textAlign="center" gap="8px" py="10px">
                                <IconTile icon={<LuSearchX/>} variant="outline" size={48}/>
                                <chakra.strong fontSize="17px">Reward not found</chakra.strong>
                                <chakra.span fontSize="14px" color="fg.muted" maxW="360px" lineHeight="1.5">
                                    We couldn&apos;t find a reward for this link. It may have ended and been removed, or the link is incorrect.
                                </chakra.span>
                                <Button asChild mt="4px" size="md" variant={hgVariant('secondary')}>
                                    <Link href="/staking"><LuArrowLeft aria-hidden="true"/>Browse all rewards</Link>
                                </Button>
                            </Flex>
                        </HgCard>
                    )}

                    {row && (
                        <>
                            <RewardHeader row={row}/>
                            <Grid templateColumns={{base: '1fr', lg: 'minmax(0, 1fr) 380px'}} gap="20px" alignItems="start">
                                {/* on phones the rail (position and actions) comes before the facts */}
                                <Box order={{base: 2, lg: 1}} display="flex" flexDirection="column" gap="20px" minW="0">
                                    <RewardFacts row={row}/>
                                    <RewardPrizes row={row}/>
                                </Box>
                                <Box order={{base: 1, lg: 2}} position={{lg: 'sticky'}} top="88px" minW="0">
                                    <RewardRail row={row} hasWallet={Boolean(address)} onAction={(view, amount) => setDialog({view, amount})}/>
                                </Box>
                            </Grid>
                        </>
                    )}

                    {row && dialog && (
                        <RowDialog row={row} view={dialog.view} amount={dialog.amount} hasWallet={Boolean(address)} onClose={closeDialog} onDone={onDone}/>
                    )}
                </Flex>
            </PageContainer>
        </Box>
    );
};

const RewardDetailsPage = () => (
    <Suspense fallback={<div>Loading...</div>}>
        <RewardDetailsContent/>
    </Suspense>
);

export default RewardDetailsPage;
