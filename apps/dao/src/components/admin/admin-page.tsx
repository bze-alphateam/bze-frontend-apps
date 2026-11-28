'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {getChainName, getTxLanding, PageContainer, PageState, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {controlFingerprint} from '@/lib/admin/access';
import type {NominationChain} from '@/lib/admin/nomination';
import {liveDaoViewDeps, liveNominationChain, liveRelationDeps} from '@/lib/dao-chain';
import {loadDaoView, type DaoView, type DaoViewDeps} from '@/lib/dao-view-loader';
import {loadRelations, type RelationDeps} from '@/lib/propose/relations';
import {DaoShell} from '@/components/dao/page/dao-shell';
import {useDaoExtras} from '@/hooks/useDaoExtras';
import {Unsupported} from '@/components/dao/unsupported';
import {Console} from './console';

interface Props {
    id: string;
    deps?: DaoViewDeps;
    relationDeps?: RelationDeps;
    nominationChain?: NominationChain;
}

/** `/dao/[id]/admin`: the console of the DAO's admin or of the account nominated to take it over. */
export const AdminPage = ({id, deps = liveDaoViewDeps, relationDeps = liveRelationDeps, nominationChain = liveNominationChain}: Props) => {
    const {address} = useChain(getChainName());
    const [reload, setReload] = useState(0);
    const key = `${id}:${reload}`;
    const result = useAsync(key, () => loadDaoView(deps, id));
    const loaded = result.data?.state === 'ok' ? result.data.view : null;
    const relations = useAsync(loaded ? `${key}:relations` : null, () => loadRelations(relationDeps, loaded!.dao));

    // the DAO as it was read last: the first read, then every re-read after a transaction
    const [fresh, setFresh] = useState<{key: string; view: DaoView} | null>(null);
    const view = fresh?.key === key ? fresh.view : loaded;
    const latest = useRef<DaoView | null>(null);
    useEffect(() => {
        latest.current = view;
    }, [view]);

    const refresh = useCallback(async (): Promise<'ok' | 'failed'> => {
        try {
            const next = await loadDaoView(deps, id);
            if (next.state !== 'ok') return 'failed';
            latest.current = next.view;
            setFresh({key, view: next.view});
            return 'ok';
        } catch {
            return 'failed';
        }
    }, [deps, id, key]);
    const fingerprint = useCallback(() => (latest.current ? controlFingerprint(latest.current.dao) : ''), []);

    // the wallet the console's flow belongs to: the last one connected, so a disconnect (a failed signing can cause one) keeps what the flow shows.
    // The shell's tabs follow the same wallet, so the Admin console tab never disappears while its console is still on the page.
    const [flowWallet, setFlowWallet] = useState('');
    if (address && address !== flowWallet) setFlowWallet(address);
    const shellWallet = flowWallet === '' ? null : flowWallet;

    const data = result.data;
    const extras = useDaoExtras(deps, loaded ? loaded.dao.id : null);

    return (
        <>
            <PageContainer py={{base: '20px', md: '32px'}}>
                {(result.loading || (loaded !== null && relations.loading)) && (
                    <Flex direction="column" gap="16px" aria-hidden data-testid="admin-loading">
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
                {view && !relations.loading && (
                    <DaoShell dao={view.dao} active="admin" wallet={shellWallet} extras={extras} openProposals={view.openProposals}>
                        {flowWallet === '' && (
                            <div data-testid="admin-needs-wallet">
                                <PageState kind="empty" title="Connect your wallet" description="The admin console is for the admin of this DAO and for the account nominated to take it over." />
                            </div>
                        )}
                        {flowWallet !== '' && (
                            <Console
                                key={`${view.dao.id}:${flowWallet}`}
                                view={view}
                                relations={relations.data ?? {subDaos: null, incoming: null, sources: null}}
                                wallet={address ?? null}
                                flowWallet={flowWallet}
                                nominationChain={nominationChain}
                                refresh={refresh}
                                fingerprint={fingerprint}
                                lookupTx={getTxLanding}
                            />
                        )}
                    </DaoShell>
                )}
            </PageContainer>
        </>
    );
};
