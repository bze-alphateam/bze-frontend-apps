'use client';

import {Suspense, useState} from 'react';
import NextLink from 'next/link';
import {useSearchParams} from 'next/navigation';
import {chakra, Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {getChainName, PageContainer, PageState, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {useDaoExtras} from '@/hooks/useDaoExtras';
import {liveDaoViewDeps, liveProposalDeps, liveSubDaoDeps} from '@/lib/dao-chain';
import {actionsFor, DAO_FEATURES} from '@/lib/dao-actions';
import type {SubDaoDeps} from '@/lib/dao-subdaos';
import {parseDaoTab} from '@/lib/dao-tabs';
import {loadDaoView, type DaoView, type DaoViewDeps} from '@/lib/dao-view-loader';
import type {ProposalDeps} from '@/lib/proposal-loader';
import {Unsupported} from '../unsupported';
import {ControlBox} from './control-box';
import {DaoShell} from './dao-shell';
import {HistoryTab} from './history-tab';
import {MyPower} from './my-power';
import {ProposalsTab} from './proposals-tab';
import {TreasuryPanel} from './panels';
import {VotersPanel} from './voters-panels';

interface Deps {
    deps: DaoViewDeps;
    proposalDeps: ProposalDeps;
    subDaoDeps: SubDaoDeps;
}

const Body = ({deps, proposalDeps, subDaoDeps, view, wallet}: Deps & {view: DaoView; wallet: string | null}) => {
    const {dao} = view;
    const tab = parseDaoTab(useSearchParams()?.get('tab'));
    const extras = useDaoExtras(deps, dao.id);

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
        <DaoShell dao={dao} active={tab} wallet={wallet} extras={extras} openProposals={view.openProposals}>
            {tab === 'overview' && (
                <chakra.div
                    display="grid"
                    gridTemplateColumns={{base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 380px'}}
                    gap="16px"
                    alignItems="start"
                    data-testid="overview-tab"
                >
                    <Flex direction="column" gap="16px" minW="0">
                        <ControlBox view={view} wallet={wallet} detail={detail} nameOf={nameOf} subDaoDeps={subDaoDeps} />
                        <VotersPanel dao={dao} sources={view.sources} nameOf={nameOf} />
                    </Flex>
                    <Flex direction="column" gap="16px" minW="0">
                        {wallet && <MyPower deps={deps} dao={dao} wallet={wallet} sources={view.sources} openProposals={view.openProposals} />}
                        <TreasuryPanel treasury={view.treasury} />
                    </Flex>
                </chakra.div>
            )}
            {tab === 'proposals' && <ProposalsTab deps={proposalDeps} daoId={dao.id} nameOf={nameOf} newProposal={actions.newProposal} />}
            {tab === 'history' && <HistoryTab deps={deps} daoId={dao.id} daoAddress={dao.address} nameOf={nameOf} />}
        </DaoShell>
    );
};

const Loading = () => (
    <Flex direction="column" gap="16px" aria-hidden data-testid="dao-loading">
        <Shimmer h="140px" borderRadius="16px" />
        <Shimmer h="260px" borderRadius="16px" />
    </Flex>
);

const Page = ({id, deps, proposalDeps, subDaoDeps}: Deps & {id: string}) => {
    const {address} = useChain(getChainName());
    const [reload, setReload] = useState(0);
    const result = useAsync(`${id}:${reload}`, () => loadDaoView(deps, id));
    const data = result.data;

    return (
        <PageContainer py={{base: '20px', md: '32px'}}>
            {result.loading && <Loading />}
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
                    description="There is no such DAO on this network."
                    action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href="/">All DAOs</NextLink></chakra.a>}
                />
            )}
            {data?.state === 'ok' && (
                <Body deps={deps} proposalDeps={proposalDeps} subDaoDeps={subDaoDeps} view={data.view} wallet={address ?? null} />
            )}
        </PageContainer>
    );
};

/**
 * The page of one DAO: the shared header and tabs (`DaoShell`), then the tab in `?tab=` (`daoTabHref`):
 * Overview (who controls it, who votes, the wallet's power, the treasury), Proposals or History.
 */
export const DaoPage = ({id, deps = liveDaoViewDeps, proposalDeps = liveProposalDeps, subDaoDeps = liveSubDaoDeps}: {id: string; deps?: DaoViewDeps; proposalDeps?: ProposalDeps; subDaoDeps?: SubDaoDeps}) => (
    <Suspense fallback={<PageContainer py={{base: '20px', md: '32px'}}><Loading /></PageContainer>}>
        <Page id={id} deps={deps} proposalDeps={proposalDeps} subDaoDeps={subDaoDeps} />
    </Suspense>
);
