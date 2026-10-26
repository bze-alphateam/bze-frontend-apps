'use client';

import React, {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {Box, Button, chakra, Flex} from '@chakra-ui/react';
import {LuRefreshCw} from 'react-icons/lu';
import {HgCard, hgVariant, PageContainer} from "@bze/bze-ui-kit";
import {useStakingRows} from "@/hooks/useStakingRows";
import {InnerHero, CountPill} from "@/components/ui/layout/inner-hero";
import {ClaimPickerModal} from "@/components/ui/staking/claim-picker-modal";
import {RowDialog} from "@/components/ui/staking/row-dialog";
import {ExploreTable, ExploreToolbar, PositionsCard} from "@/components/ui/staking/staking-table";
import {
    DEFAULT_STAKING_FILTERS, filterStakingRows, paginate, positionRows, type StakingFilters,
} from "@/lib/staking-list";

//150 seconds
const STAKING_DATA_RELOAD_INTERVAL = 150_000;

// `?search=` prefills the search (the Factory links here with a token's ticker). Read from the URL
// on the client only (the server snapshot is empty); once the user types, the typed value wins.
const noSubscribe = () => () => {};
const readSearchParam = () => new URLSearchParams(window.location.search).get('search') ?? '';
const noSearchParam = () => '';

type OpenDialog = { type: 'manage' | 'stake'; rowId: string } | { type: 'claim' };

const StakingPage = () => {
    const urlSearch = useSyncExternalStore(noSubscribe, readSearchParam, noSearchParam);
    const [typedSearch, setTypedSearch] = useState<string | undefined>();
    const [chosen, setChosen] = useState<StakingFilters>(DEFAULT_STAKING_FILTERS);
    const filters = useMemo(() => ({...chosen, search: typedSearch ?? urlSearch}), [chosen, typedSearch, urlSearch]);
    const [pageNumber, setPageNumber] = useState(1);
    const [dialog, setDialog] = useState<OpenDialog | undefined>();

    const {rows, nativeDenom, address, isLoading, denomRewardsError, reloadDenomRewards, reload: reloadAll} = useStakingRows()

    const positions = useMemo(() => positionRows(rows), [rows]);
    const explore = useMemo(() => filterStakingRows(rows, filters), [rows, filters]);
    const page = paginate(explore, pageNumber);

    const onFilters = useCallback((next: StakingFilters) => {
        setChosen(next);
        setTypedSearch(next.search);
        setPageNumber(1);
    }, []);

    const closeDialog = useCallback(() => setDialog(undefined), []);
    const onDone = useCallback(() => {
        setDialog(undefined)
        reloadAll()
    }, [reloadAll]);

    useEffect(() => {
        const reloadInterval = setInterval(reloadAll, STAKING_DATA_RELOAD_INTERVAL)

        return () => {
            clearInterval(reloadInterval)
        }
    }, [reloadAll])

    // dialogs read the row from the latest data, so a refresh while one is open shows fresh figures
    const dialogRow = dialog && dialog.type !== 'claim' ? rows.find(r => r.id === dialog.rowId) : undefined;

    return (
        <Box minH="100vh">
            <InnerHero
                section="Staking"
                title="Staking & Rewards"
                subtitle="Earn passive income by staking and locking your tokens"
            />

            <PageContainer pt="32px" pb="80px">
                <Flex direction="column" gap="28px">
                    {(positions.length > 0 || (isLoading && Boolean(address))) && (
                        <PositionsCard
                            rows={positions}
                            nativeDenom={nativeDenom}
                            isLoading={isLoading && positions.length === 0}
                            onManage={(row) => setDialog({type: 'manage', rowId: row.id})}
                            onClaim={() => setDialog({type: 'claim'})}
                        />
                    )}

                    <chakra.section display="flex" flexDirection="column" gap="14px" aria-label="Explore rewards">
                        <Flex justify="space-between" align="flex-end" gap="12px" wrap="wrap">
                            <Flex direction="column" gap="4px">
                                <chakra.h2 m="0" fontSize="22px" fontWeight="700">Explore rewards</chakra.h2>
                                <chakra.span fontSize="14px" color="fg.muted">Native staking first, then verified rewards by APR, then the rest.</chakra.span>
                            </Flex>
                            {!isLoading && <CountPill>{explore.length} reward{explore.length === 1 ? '' : 's'}</CountPill>}
                        </Flex>

                        <ExploreToolbar filters={filters} onChange={onFilters}/>

                        {denomRewardsError && (
                            <HgCard>
                                <Flex align="center" gap="12px" wrap="wrap">
                                    <chakra.span fontSize="14px" color="fg.muted" flex="1">
                                        Couldn&apos;t load the compounded rewards — the node may be down, or not run chain v8.2.0 yet.
                                    </chakra.span>
                                    <Button size="md" variant={hgVariant('secondary')} gap="6px" onClick={reloadDenomRewards}><LuRefreshCw aria-hidden="true"/> Retry</Button>
                                </Flex>
                            </HgCard>
                        )}

                        <ExploreTable
                            page={page}
                            isLoading={isLoading}
                            onStake={(row) => setDialog({type: 'stake', rowId: row.id})}
                            onPage={setPageNumber}
                        />
                    </chakra.section>

                    {dialog?.type === 'claim' && (
                        <ClaimPickerModal rows={positions.filter(r => r.position?.claimable)} onClose={closeDialog} onDone={onDone}/>
                    )}
                    {dialog && dialogRow && (
                        <RowDialog row={dialogRow} view={dialog.type === 'stake' ? 'stake' : 'manage'} hasWallet={Boolean(address)} onClose={closeDialog} onDone={onDone}/>
                    )}
                </Flex>
            </PageContainer>
        </Box>
    );
};

export default StakingPage;
