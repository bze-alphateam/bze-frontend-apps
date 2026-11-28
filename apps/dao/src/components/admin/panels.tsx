'use client';

import {useMemo, useState, type ReactNode} from 'react';
import NextLink from 'next/link';
import {Button, Field, Input} from '@chakra-ui/react';
import {chakra, Flex} from '@chakra-ui/react';
import {
    buildAcceptAdminNominationMsg, buildAdminExecuteMsg, buildNominateAdminMsg, buildWithdrawAdminNominationMsg,
    HgCard, hgVariant, Notice, Shimmer,
} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';
import {useAsync} from '@/hooks/useAsync';
import type {ActionKind} from '@/hooks/useActionFlow';
import {composeAdminActions} from '@/lib/actions/sub-dao';
import {findAction} from '@/lib/actions/registry';
import type {ActionDraft} from '@/lib/actions/types';
import {isNominationStale, type NominationChain} from '@/lib/admin/nomination';
import {handOverBlocked, handOverConfirmed, nominateBlocked, withdrawBlocked} from '@/lib/admin/operations';
import type {DaoView} from '@/lib/dao-view-loader';
import {daoTabHref} from '@/lib/dao-tabs';
import {describeAll} from '@/lib/propose/describe';
import type {Relations} from '@/lib/propose/relations';
import {AddressLine, Panel} from '@/components/dao/page/panel';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';
import {ActionsPanel} from '@/components/proposal/actions-panel';
import {ActionsList} from '@/components/propose/actions-list';
import {SizeMeter} from '@/components/propose/review';
import {useActionContext} from '@/components/propose/use-action-context';
import {inputProps} from '@/components/propose/forms';

interface OpProps {
    view: DaoView;
    wallet: string;
    /** A transaction is in flight or may still land: nothing else is sent. */
    locked: boolean;
    onSend: (kind: ActionKind, msgs: EncodeObject[]) => void;
}

const muted = {m: '0', fontSize: '13px', color: 'fg.muted'} as const;

/** What one message does and who signs it, read back from the bytes that would be signed. */
const SignReview = ({msg, view, wallet, title}: {msg: EncodeObject; view: DaoView; wallet: string; title: string}) => {
    const coins = useCoinFormat();
    const {dao} = view;
    const {actions, unreadable} = describeAll([msg], dao, coins.exact);
    return (
        <>
            <ActionsPanel
                actions={actions}
                formatCoin={coins.exact}
                nameOf={(a) => (a === dao.address ? dao.name : a === wallet ? 'you' : undefined)}
                signer={wallet}
                wording={{title, runs: null, signedBy: 'Signed by your wallet', empty: ''}}
                expanded
            />
            {unreadable > 0 && <Notice status="danger">This message could not be read back, so it is not sent: what is signed must be shown.</Notice>}
        </>
    );
};

const unreadableOf = (msg: EncodeObject, view: DaoView, formatCoin: (c: {denom: string; amount: string}) => string): boolean =>
    describeAll([msg], view.dao, formatCoin).unreadable > 0;

// ---- run actions as the DAO ----

/** The admin's superpower: any message as the DAO, signed by the DAO account, run at once, all or nothing. */
export const ExecutePanel = ({view, relations, wallet, locked, onSend}: OpProps & {relations: Relations}) => {
    const {dao} = view;
    const coins = useCoinFormat();
    const ctx = useActionContext(view, relations, true);
    const [drafts, setDrafts] = useState<ActionDraft[]>([]);
    const composition = useMemo(() => (ctx ? composeAdminActions(drafts, ctx, findAction, 0) : null), [drafts, ctx]);

    if (!ctx || !composition) {
        return <Notice status="warning">The rules of the chain did not load, so actions cannot be checked right now. Reload the page to try again.</Notice>;
    }

    const read = describeAll(composition.actions.flatMap((a) => (a.msg ? [a.msg] : [])), dao, coins.exact, ctx.subDaos);
    const ready = composition.ready && read.unreadable === 0;
    const problem = composition.error ?? (read.unreadable > 0 ? 'Some actions could not be read back, so they are shown as raw JSON. Actions are only sent when everything that is signed can be shown.' : undefined);
    const message = ready ? buildAdminExecuteMsg({admin: wallet, daoId: dao.id, msgs: composition.msgs}) : null;

    return (
        <Flex direction="column" gap="16px" data-testid="execute-panel">
            <ActionsList
                drafts={drafts}
                composed={composition.actions}
                ctx={ctx}
                maxActions={Number(ctx.params.max_msgs_per_proposal)}
                formatCoin={coins.exact}
                onChange={setDrafts}
                wording={{
                    title: 'Run actions as the DAO',
                    intro: `${dao.name} does these, in this order, as soon as you sign. All or nothing: if one fails, none applies. Its voters cannot overrule you.`,
                    empty: 'No actions yet: add what the DAO should do.',
                    full: (max) => `At most ${max} actions can run at once.`,
                }}
            />
            {drafts.length > 0 && (
                <Flex direction="column" gap="16px" data-testid="execute-review">
                    <ActionsPanel
                        actions={read.actions}
                        formatCoin={coins.exact}
                        nameOf={(a) => (a === dao.address ? dao.name : undefined)}
                        signer={dao.address}
                        signerOf={(id) => ctx.subDaos?.find((s) => s.dao.id === id)?.dao.address}
                        wording={{title: 'What the DAO will do', runs: 'These run as the DAO the moment the transaction lands, all or nothing.', signedBy: 'Every message is signed by the DAO account', empty: ''}}
                        expanded
                    />
                    <Panel id="execute-sign" title="What you sign" testId="execute-sign">
                        <chakra.p m="0" fontSize="14px" data-testid="execute-outer">
                            {`One message, "run messages as the DAO" (MsgAdminExecute) for ${dao.name} (DAO ${dao.id}), carrying ${drafts.length === 1 ? 'one action' : `${drafts.length} actions`}.`}
                        </chakra.p>
                        <Flex gap="6px" align="center" wrap="wrap" fontSize="13px" color="fg.muted"><span>Signed by your wallet</span><AddressLine address={wallet} /></Flex>
                        <SizeMeter size={composition.size} max={composition.maxBytes} />
                        <chakra.p {...muted}>The network fee is paid by your wallet, on top. Before anything is signed the chain checks it: if it would be refused, you see why and nothing is sent.</chakra.p>
                    </Panel>
                </Flex>
            )}
            {composition.warnings.map((w) => <chakra.p key={w} {...muted} color="orange.500" data-testid="execute-warning">{w}</chakra.p>)}
            <Flex direction="column" gap="6px" alignItems="flex-start">
                <Button
                    variant={hgVariant('primary')}
                    disabled={!message || locked}
                    onClick={() => message && onSend('admin-execute', [message])}
                    data-testid="execute-submit"
                >
                    {drafts.length === 1 ? 'Run the action now' : drafts.length === 0 ? 'Run now' : `Run ${drafts.length} actions now`}
                </Button>
                {!ready && problem && <chakra.p {...muted} data-testid="execute-problem">{problem}</chakra.p>}
            </Flex>
        </Flex>
    );
};

// ---- the handover ----

const POWER_NOTE = 'An external admin can run any message as the DAO, including spending the whole treasury, and the DAO\'s voters can no longer overrule it.';

/** Nominate a successor: the wallet stays admin until the nominee accepts. */
export const NominatePanel = ({view, wallet, locked, onSend}: OpProps) => {
    const {dao} = view;
    const [nominee, setNominee] = useState('');
    const problem = nominateBlocked(dao, nominee);
    const msg = problem === undefined ? buildNominateAdminMsg({authority: wallet, daoId: dao.id, nominee: nominee.trim().toLowerCase()}) : null;
    const coins = useCoinFormat();

    return (
        <Panel id="nominate" title="Nominate a new admin" testId="nominate-panel">
            <chakra.p {...muted}>{`You stay the admin until the nominee accepts. ${POWER_NOTE}`}</chakra.p>
            {dao.pending_admin !== '' && <chakra.p {...muted} data-testid="nominate-pending">{nominateBlocked(dao, nominee)}</chakra.p>}
            {dao.pending_admin === '' && (
                <Field.Root>
                    <Field.Label fontSize="14px" fontWeight="600">New admin</Field.Label>
                    <Input {...inputProps} fontFamily="mono" fontSize="14px" placeholder="bze1…" autoCapitalize="none" spellCheck={false} value={nominee} onChange={(e) => setNominee(e.target.value)} data-testid="nominee" />
                </Field.Root>
            )}
            {dao.pending_admin === '' && nominee.trim() !== '' && problem && <chakra.p {...muted} color="red.500" role="alert" data-testid="nominate-problem">{problem}</chakra.p>}
            {msg && <SignReview msg={msg} view={view} wallet={wallet} title="What you sign" />}
            <div>
                <Button
                    variant={hgVariant('primary')}
                    disabled={!msg || locked || unreadableOf(msg, view, coins.exact)}
                    onClick={() => msg && onSend('nominate', [msg])}
                    data-testid="nominate-submit"
                >
                    Nominate
                </Button>
            </div>
        </Panel>
    );
};

/** Withdraw the pending nomination before the nominee accepts it. */
export const WithdrawPanel = ({view, wallet, locked, onSend}: OpProps) => {
    const {dao} = view;
    const blocked = withdrawBlocked(dao);
    const coins = useCoinFormat();
    if (blocked) return null;
    const msg = buildWithdrawAdminNominationMsg({authority: wallet, daoId: dao.id});

    return (
        <Panel id="withdraw" title="Withdraw the nomination" testId="withdraw-panel">
            <Flex gap="6px" align="center" wrap="wrap" fontSize="14px"><span>Nominated:</span><AddressLine address={dao.pending_admin} full testId="withdraw-nominee" /></Flex>
            <chakra.p {...muted}>The nominee has not accepted yet. Withdrawing keeps you the admin and lets you nominate someone else.</chakra.p>
            <SignReview msg={msg} view={view} wallet={wallet} title="What you sign" />
            <div>
                <Button variant={hgVariant('secondary')} disabled={locked || unreadableOf(msg, view, coins.exact)} onClick={() => onSend('withdraw', [msg])} data-testid="withdraw-submit">Withdraw the nomination</Button>
            </div>
        </Panel>
    );
};

/** Hand the DAO to its own voters: at once, with no accept step, and you cannot take it back. */
export const HandOverPanel = ({view, relations, wallet, locked, onSend}: OpProps & {relations: Relations}) => {
    const {dao} = view;
    const [typed, setTyped] = useState('');
    const [understood, setUnderstood] = useState(false);
    const coins = useCoinFormat();
    const blocked = handOverBlocked(dao, relations.sources);
    const msg = buildNominateAdminMsg({authority: wallet, daoId: dao.id, nominee: ''});
    const confirmed = handOverConfirmed(dao, typed, understood);

    return (
        <Panel id="hand-over" title="Hand the DAO to its voters" testId="handover-panel">
            <chakra.p m="0" fontSize="14px">
                {`${dao.name} becomes self-owned right away: you stop being its admin, you lose every power listed on this page, and only the DAO's own proposals can act for it. There is no accept step, and you cannot undo it.`}
            </chakra.p>
            {blocked && <Notice status="warning"><span data-testid="handover-blocked">{blocked}</span></Notice>}
            {!blocked && (
                <>
                    <SignReview msg={msg} view={view} wallet={wallet} title="What you sign" />
                    {dao.type === 'DAO_TYPE_STATIC_LIST' && <chakra.p {...muted} data-testid="handover-voters">{`Its voters can vote: ${dao.members.length} ${dao.members.length === 1 ? 'member' : 'members'} (the chain refuses a DAO nobody can vote in).`}</chakra.p>}
                    <chakra.label display="flex" gap="8px" alignItems="flex-start" fontSize="14px" cursor="pointer">
                        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{marginTop: '4px'}} data-testid="handover-understood" />
                        <span>{`I understand I lose every admin power over ${dao.name}`}</span>
                    </chakra.label>
                    <Field.Root>
                        <Field.Label fontSize="14px" fontWeight="600">Type the DAO&apos;s name to confirm</Field.Label>
                        <Input {...inputProps} autoCapitalize="none" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="handover-confirm" />
                    </Field.Root>
                    <div>
                        <Button variant={hgVariant('primary')} disabled={!confirmed || locked || unreadableOf(msg, view, coins.exact)} onClick={() => onSend('hand-over', [msg])} data-testid="handover-submit">
                            Hand the DAO to its voters
                        </Button>
                    </div>
                </>
            )}
        </Panel>
    );
};

// ---- the nominee ----

const pillTone = {
    nominated: {color: 'hg.warning.text', bg: 'hg.warning/12', borderColor: 'hg.warning/38'},
    stale: {color: 'fg.muted', bg: 'app.subtle', borderColor: 'app.border'},
} as const;

const Pill = ({tone, children, testId}: {tone: keyof typeof pillTone; children: string; testId: string}) => (
    <chakra.span fontSize="12px" fontWeight="600" px="9px" py="3px" borderRadius="hg.pill" whiteSpace="nowrap" borderWidth="1px" {...pillTone[tone]} data-testid={testId}>
        {children}
    </chakra.span>
);

/** A card of the nominee's console. */
const HgCardSection = ({testId, children}: {testId: string; children: ReactNode}) => (
    <HgCard as="section" data-testid={testId}>
        <Flex direction="column" gap="16px" p={{base: '16px', md: '24px'}}>{children}</Flex>
    </HgCard>
);

const ViewDao = ({id}: {id: string}) => (
    <Button asChild variant={hgVariant('secondary')}>
        <NextLink href={daoTabHref(id)} data-testid="accept-view-dao">View DAO</NextLink>
    </Button>
);

/** The tick's words: what taking over the DAO means for the nominee. */
const acceptUnderstanding = (name: string): string =>
    `I understand that becoming the admin of ${name} comes with responsibilities. I can act for the DAO and spend its treasury without a vote, so I'll keep this address secure for the DAO's sake: if it's lost or stolen, so is control of the DAO.`;

/**
 * The nominee's console: one card. Before anything is offered the nomination is checked the way the chain
 * checks it (`isNominationStale`): stale, the card says who has to nominate again; otherwise, the accept card,
 * whose button waits for the tick. A check the chain could not answer shows the accept card too: the chain's
 * own refusal (1135) still covers a stale nomination then.
 */
export const AcceptPanel = ({view, wallet, locked, onSend, chain}: OpProps & {chain: NominationChain}) => {
    const {dao} = view;
    const coins = useCoinFormat();
    const [understood, setUnderstood] = useState(false);
    const check = useAsync(`${dao.id}:${dao.pending_admin}:${dao.pending_admin_seq}:${dao.admin}`, () => isNominationStale(chain, dao));
    const msg = buildAcceptAdminNominationMsg({nominee: wallet, daoId: dao.id});

    if (check.loading) return <Shimmer h="180px" borderRadius="16px" data-testid="accept-checking" />;

    const staleness = check.data;
    if (staleness?.stale) {
        const parent = staleness.parent.name;
        return (
            <HgCardSection testId="stale-card">
                <Flex gap="10px" align="center" wrap="wrap">
                    <chakra.h2 m="0" fontSize="17px" fontWeight="700">This nomination is out of date</chakra.h2>
                    <Pill tone="stale" testId="stale-pill">Stale</Pill>
                </Flex>
                <chakra.p m="0" fontSize="14px" data-testid="stale-text">
                    {`${parent}, the DAO that runs ${dao.name}, changed its admin after you were nominated, so this nomination can no longer be accepted. ${parent} has to nominate you again.`}
                </chakra.p>
                <Flex gap="8px" justify="flex-end" wrap="wrap"><ViewDao id={dao.id} /></Flex>
            </HgCardSection>
        );
    }

    return (
        <HgCardSection testId="accept-card">
            <Flex gap="10px" align="center" wrap="wrap">
                <chakra.h2 m="0" fontSize="17px" fontWeight="700" data-testid="accept-title">{`You're nominated to run ${dao.name}`}</chakra.h2>
                <Pill tone="nominated" testId="nominated-pill">Nominated</Pill>
            </Flex>
            <chakra.label display="flex" gap="12px" alignItems="flex-start" fontSize="14px" cursor="pointer" p="14px 16px" borderRadius="12px" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{marginTop: '4px'}} data-testid="accept-understood" />
                <span data-testid="accept-understood-text">{acceptUnderstanding(dao.name)}</span>
            </chakra.label>
            <Flex gap="8px" justify="flex-end" wrap="wrap">
                <ViewDao id={dao.id} />
                <Button variant={hgVariant('primary')} disabled={!understood || locked || unreadableOf(msg, view, coins.exact)} onClick={() => onSend('accept', [msg])} data-testid="accept-submit">
                    Accept and become admin
                </Button>
            </Flex>
        </HgCardSection>
    );
};
