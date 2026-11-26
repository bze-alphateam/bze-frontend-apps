'use client';

import {useCallback, useState} from 'react';
import NextLink from 'next/link';
import {chakra, Flex, SimpleGrid} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {getChainName, PageContainer, PageState, SegmentedTabs, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {liveDaoViewDeps, liveProposalDeps} from '@/lib/dao-chain';
import {actionsFor, DAO_FEATURES} from '@/lib/dao-actions';
import {loadDaoExtras, loadDaoView, type DaoView, type DaoViewDeps} from '@/lib/dao-view-loader';
import type {ProposalDeps} from '@/lib/proposal-loader';
import {InnerHero} from '@/components/ui/layout-hero';
import {Unsupported} from '../unsupported';
import {DaoHeader} from './header';
import {HistoryTab} from './history-tab';
import {MyPower} from './my-power';
import {ProposalsTab} from './proposals-tab';
import {ControlPanel, RulesPanel, TreasuryPanel} from './panels';
import {JoinPanel, VotersPanel} from './voters-panels';

type Tab = 'overview' | 'proposals' | 'history';

const Body = ({deps, proposalDeps, view, wallet}: {deps: DaoViewDeps; proposalDeps: ProposalDeps; view: DaoView; wallet: string | null}) => {
    const {dao} = view;
    const [tab, setTab] = useState<Tab>('overview');
    const [retry, setRetry] = useState(0);
    const extras = useAsync(`${dao.id}:${retry}`, () => loadDaoExtras(deps, dao.id));
    const onRetryExtras = useCallback(() => setRetry((n) => n + 1), []);

    // Names Scan knows (creator, admin, controller, the DAO) and the DAOs of the admin chain.
    const labels = new Map<string, string>();
    const detail = extras.data;
    for (const [address, label] of [
        [detail?.creator, detail?.creator_label], [detail?.admin, detail?.admin_label],
        [dao.address, detail?.address_label], [detail?.controller?.address, detail?.controller?.label],
    ] as const) {
        if (address && label) labels.set(address, label.name);
    }
    for (const [address, known] of view.knownDaos) labels.set(address, labels.get(address) ?? known.name);
    const nameOf = (address: string) => labels.get(address);

    const actions = actionsFor(DAO_FEATURES, dao, wallet);

    return (
        <Flex direction="column" gap="18px">
            <DaoHeader
                dao={dao}
                openProposals={view.openProposals}
                extras={{data: extras.data, failed: !extras.loading && !!extras.error}}
                nameOf={nameOf}
                onRetryExtras={onRetryExtras}
                actions={actions}
            />
            <SegmentedTabs
                aria-label="DAO sections"
                value={tab}
                onChange={setTab}
                options={[{value: 'overview', label: 'Overview'}, {value: 'proposals', label: 'Proposals'}, {value: 'history', label: 'History'}]}
            />
            {tab === 'overview' ? (
                <SimpleGrid columns={{base: 1, lg: 2}} gap="16px" alignItems="start" data-testid="overview-tab">
                    <ControlPanel view={view} nameOf={nameOf} />
                    <TreasuryPanel treasury={view.treasury} />
                    <RulesPanel dao={dao} params={view.params} />
                    <VotersPanel dao={dao} sources={view.sources} nameOf={nameOf} />
                    <JoinPanel dao={dao} sources={view.sources} wallet={wallet} actions={actions} />
                    {wallet && <MyPower deps={deps} dao={dao} wallet={wallet} sources={view.sources} openProposals={view.openProposals} />}
                </SimpleGrid>
            ) : tab === 'proposals' ? (
                <ProposalsTab deps={proposalDeps} daoId={dao.id} nameOf={nameOf} />
            ) : (
                <HistoryTab deps={deps} daoId={dao.id} daoAddress={dao.address} nameOf={nameOf} />
            )}
        </Flex>
    );
};

/** The page of one DAO: who it is, who controls it, what it owns, its rules, its voters and its history. */
export const DaoPage = ({id, deps = liveDaoViewDeps, proposalDeps = liveProposalDeps}: {id: string; deps?: DaoViewDeps; proposalDeps?: ProposalDeps}) => {
    const {address} = useChain(getChainName());
    const [reload, setReload] = useState(0);
    const result = useAsync(`${id}:${reload}`, () => loadDaoView(deps, id));
    const data = result.data;
    const title = data?.state === 'ok' ? data.view.dao.name : `DAO ${id}`;

    return (
        <>
            <InnerHero title={title} />
            <PageContainer py={{base: '24px', md: '36px'}}>
                {result.loading && (
                    <Flex direction="column" gap="16px" aria-hidden data-testid="dao-loading">
                        <Shimmer h="140px" borderRadius="16px" />
                        <Shimmer h="260px" borderRadius="16px" />
                    </Flex>
                )}
                {!result.loading && !!result.error && (
                    <PageState
                        kind="error"
                        title="This DAO did not load"
                        description="The chain did not answer."
                        action={<chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setReload((n) => n + 1)}>Try again</chakra.button>}
                    />
                )}
                {data?.state === 'unsupported' && <Unsupported />}
                {data?.state === 'not-found' && (
                    <PageState
                        kind="empty"
                        title="DAO not found"
                        description={`There is no DAO with the number ${id}.`}
                        action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href="/">Back to the DAOs</NextLink></chakra.a>}
                    />
                )}
                {data?.state === 'ok' && <Body deps={deps} proposalDeps={proposalDeps} view={data.view} wallet={address ?? null} />}
            </PageContainer>
        </>
    );
};
