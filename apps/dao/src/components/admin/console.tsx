'use client';

import {useEffect, useMemo} from 'react';
import NextLink from 'next/link';
import {useRouter} from 'next/navigation';
import {chakra, Flex} from '@chakra-ui/react';
import {Notice, PageState, useSDKTx} from '@bze/bze-ui-kit';
import type {TxLanding} from '@bze/bze-ui-kit';
import {useAdminFlow} from '@/hooks/useAdminFlow';
import type {ActionKind} from '@/hooks/useActionFlow';
import {consoleRole} from '@/lib/admin/access';
import type {NominationChain} from '@/lib/admin/nomination';
import type {DaoView} from '@/lib/dao-view-loader';
import {browserStorage} from '@/lib/propose/draft';
import type {Relations} from '@/lib/propose/relations';
import {FlowMessage} from '@/components/flow-message';
import {AcceptPanel, ExecutePanel, HandOverPanel, NominatePanel, WithdrawPanel} from './panels';

const SENT: Record<ActionKind, string> = {
    'admin-execute': 'The DAO ran your actions.',
    nominate: 'The nomination is sent: the nominee has to accept.',
    withdraw: 'The nomination is withdrawn.',
    'hand-over': 'The DAO now belongs to its voters.',
    accept: 'You are now the admin of this DAO.',
    vote: 'Sent.', 'vote-settle': 'Sent.', settle: 'Sent.', cancel: 'Sent.', cleanup: 'Sent.',
};

interface Props {
    view: DaoView;
    relations: Relations;
    wallet: string;
    nominationChain: NominationChain;
    /** Re-reads the DAO from the chain in place after a transaction. */
    refresh: () => Promise<'ok' | 'failed'>;
    /** What the DAO record shows now, read fresh after a re-read. */
    fingerprint: () => string;
    lookupTx: (hash: string) => Promise<TxLanding>;
}

/**
 * The console of one DAO for the connected wallet. What it shows comes from `consoleRole` alone, read from
 * the chain's DAO record: the page's address carries no word about who may do what. Every operation shares one
 * flow, so a transaction that may still land locks all of them, and after one that landed the DAO is read
 * again and the wallet is sent back to the DAO page.
 */
export const Console = ({view, relations, wallet, nominationChain, refresh, fingerprint, lookupTx}: Props) => {
    const {dao} = view;
    const role = consoleRole(dao, wallet);
    const router = useRouter();
    const {tx, progressTrack} = useSDKTx();
    const storage = useMemo(() => browserStorage(), []);
    const {flow, run} = useAdminFlow({sign: tx, daoId: dao.id, wallet, storage, refresh, fingerprint, lookupTx});

    const back = `/dao/${dao.id}`;
    const done = flow.state.phase === 'sent' && flow.state.reread === 'ok';
    useEffect(() => {
        if (done) router.push(back);
    }, [done, router, back]);

    const onSend = (kind: ActionKind, msgs: Parameters<typeof run>[1]) => void run(kind, msgs);
    const panels = {view, wallet, locked: flow.locked, onSend};

    return (
        <Flex direction="column" gap="16px" data-testid="admin-console" data-role={role}>
            <chakra.a asChild color="hg.link" fontWeight="600" fontSize="14px" alignSelf="flex-start"><NextLink href={back}>{`← ${dao.name}`}</NextLink></chakra.a>

            <FlowMessage state={flow.state} progress={progressTrack} onRecheck={() => void flow.recheck()} sentTitle={(kind) => SENT[kind]} subject="DAO" />

            {role === 'none' && !done && (
                <div data-testid="no-console">
                    <PageState
                        kind="empty"
                        title="No console for this wallet"
                        description={dao.admin === dao.address
                            ? `${dao.name} is governed by its voters: it has no admin, so there is no admin console.`
                            : 'The admin console is for the admin of this DAO and for the account nominated to take it over.'}
                        action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={back}>{`Back to ${dao.name}`}</NextLink></chakra.a>}
                    />
                </div>
            )}

            {role === 'admin' && !done && (
                <>
                    <Notice status="warning" title="You are this DAO's admin">
                        <span data-testid="admin-warning">You can run any message as the DAO, including spending the whole treasury, and its voters cannot overrule you. Everything you sign is shown before you sign it.</span>
                    </Notice>
                    <ExecutePanel {...panels} relations={relations} />
                    <NominatePanel {...panels} />
                    <WithdrawPanel {...panels} />
                    <HandOverPanel {...panels} relations={relations} />
                </>
            )}

            {role === 'nominee' && !done && <AcceptPanel {...panels} chain={nominationChain} />}

            {flow.state.phase === 'idle' && (
                <chakra.p m="0" fontSize="12px" color="hg.text.faint" data-testid="ledger-note">These transactions are signed in direct mode, which a Ledger cannot approve yet. Use a software wallet.</chakra.p>
            )}
        </Flex>
    );
};
