'use client';

import {useMemo, useState, type ReactNode} from 'react';
import NextLink from 'next/link';
import {Button, chakra, Flex, Input} from '@chakra-ui/react';
import {LuCheck, LuKeyRound} from 'react-icons/lu';
import {
    buildAcceptAdminNominationMsg, buildAdminExecuteMsg, buildNominateAdminMsg, buildWithdrawAdminNominationMsg,
    hgVariant, Notice, Shimmer,
} from '@bze/bze-ui-kit';
import type {Dao} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';
import {useAsync} from '@/hooks/useAsync';
import type {ActionKind} from '@/hooks/useActionFlow';
import {composeAdminActions} from '@/lib/actions/sub-dao';
import {findAction} from '@/lib/actions/registry';
import type {ActionDraft} from '@/lib/actions/types';
import {isNominationStale, type NominationChain} from '@/lib/admin/nomination';
import {handOverBlocked, handOverConfirmed, nominateBlocked, withdrawBlocked} from '@/lib/admin/operations';
import {consoleAddress, handOverLine, heroLine, reviewLine, runLabel, type Segment} from '@/lib/admin/review';
import type {DaoView} from '@/lib/dao-view-loader';
import {daoTabHref} from '@/lib/dao-tabs';
import {describeAll} from '@/lib/propose/describe';
import type {Relations} from '@/lib/propose/relations';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';
import {ActionsList} from '@/components/propose/actions-list';
import {SizeMeter} from '@/components/propose/review';
import {useActionContext} from '@/components/propose/use-action-context';

interface OpProps {
    view: DaoView;
    wallet: string;
    /** A transaction is in flight or may still land: nothing else is sent. */
    locked: boolean;
    onSend: (kind: ActionKind, msgs: EncodeObject[]) => void;
}

// ---- the boards' pieces (board G1 / G2), in the theme's tokens so both colour modes work ----

/** The DAO accent at a share, for the featured cards' edge, wash and glow. */
const accent = (percent: number) => `color-mix(in srgb, var(--chakra-colors-hg-accent) ${percent}%, transparent)`;

const featured = {
    bgImage: `linear-gradient(160deg, ${accent(10)}, var(--chakra-colors-hg-card) 55%)`,
    borderWidth: '1px',
    borderColor: accent(40),
    borderRadius: '20px',
    boxShadow: `0 30px 80px -50px ${accent(70)}`,
} as const;

/** A card of the console: card fill, hairline, 16 px radius, 24 px in. */
const Card = ({testId, children, danger, label}: {testId: string; children: ReactNode; danger?: boolean; label?: string}) => (
    <chakra.section
        bg="hg.card"
        borderWidth="1px"
        borderColor={danger ? 'hg.danger/35' : 'hg.hairline'}
        borderRadius="16px"
        p={{base: '16px', md: '24px'}}
        display="flex"
        flexDirection="column"
        gap="16px"
        minW="0"
        aria-label={label}
        data-testid={testId}
    >
        {children}
    </chakra.section>
);

const Title = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.h2 m="0" fontSize="17px" fontWeight="700" data-testid={testId}>{children}</chakra.h2>
);

const Eyebrow = ({children}: {children: ReactNode}) => (
    <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="hg.text.faint">{children}</chakra.span>
);

const Body = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="hg.text.secondary" data-testid={testId}>{children}</chakra.p>
);

const Faint = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid={testId}>{children}</chakra.span>
);

const pillTone = {
    nominated: {color: 'hg.warning.text', bg: 'hg.warning/12', borderColor: 'hg.warning/38'},
    stale: {color: 'hg.text.secondary', bg: 'hg.inset', borderColor: 'hg.hairline'},
    danger: {color: 'hg.danger.text', bg: 'hg.danger/12', borderColor: 'hg.danger/38'},
} as const;

const Pill = ({tone, children, testId}: {tone: keyof typeof pillTone; children: string; testId: string}) => (
    <chakra.span display="inline-flex" alignItems="center" fontSize="12px" fontWeight="600" px="9px" py="3px" borderRadius="999px" whiteSpace="nowrap" borderWidth="1px" {...pillTone[tone]} data-testid={testId}>
        {children}
    </chakra.span>
);

/** The boards' text field: 48 px, inset fill, 12 px radius. */
const field = {h: '48px', px: '14px', borderRadius: '12px', bg: 'hg.inset', borderWidth: '1px', borderColor: 'hg.lineStrong', color: 'fg'} as const;

const Segments = ({segments}: {segments: Segment[]}) => (
    <>{segments.map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}</>
);

const unreadableOf = (msg: EncodeObject, view: DaoView, formatCoin: (c: {denom: string; amount: string}) => string): boolean =>
    describeAll([msg], view.dao, formatCoin).unreadable > 0;

const UNREADABLE = 'This message could not be read back, so it is not sent: what is signed must be shown.';

// ---- the admin's hero ----

/** "You are the admin of <DAO>": the one featured card of the admin's console. */
export const AdminHero = ({dao}: {dao: Dao}) => (
    <chakra.section {...featured} p="22px" display="flex" flexDirection="column" gap="16px" minW="0" data-testid="admin-hero">
        <Flex gap="16px" align="center">
            <chakra.span flex="none" boxSize="48px" borderRadius="14px" bgImage="app" color="white" display="inline-flex" alignItems="center" justifyContent="center" aria-hidden css={{'& svg': {width: '24px', height: '24px'}}}>
                <LuKeyRound />
            </chakra.span>
            <Flex direction="column" gap="4px" minW="0">
                <chakra.strong fontSize="20px" overflowWrap="anywhere" data-testid="admin-hero-title">{`You are the admin of ${dao.name}`}</chakra.strong>
                <Body testId="admin-warning">{heroLine(dao)}</Body>
            </Flex>
        </Flex>
    </chakra.section>
);

// ---- run actions as the DAO ----

/** The admin's superpower: any message as the DAO, signed by the DAO account, run at once, all or nothing. */
export const ExecutePanel = ({view, relations, wallet, locked, onSend}: OpProps & {relations: Relations}) => {
    const {dao} = view;
    const coins = useCoinFormat();
    const ctx = useActionContext(view, relations, true);
    const [drafts, setDrafts] = useState<ActionDraft[]>([]);
    // a form card is open: its action is not in the list yet, so nothing runs until it is added or cancelled
    const [editing, setEditing] = useState(false);
    const composition = useMemo(() => (ctx ? composeAdminActions(drafts, ctx, findAction, 0) : null), [drafts, ctx]);

    if (!ctx || !composition) {
        return <Notice status="warning">The rules of the chain did not load, so actions cannot be checked right now. Reload the page to try again.</Notice>;
    }

    const read = describeAll(composition.actions.flatMap((a) => (a.msg ? [a.msg] : [])), dao, coins.exact, ctx.subDaos);
    const ready = composition.ready && read.unreadable === 0;
    const problem = composition.error ?? (read.unreadable > 0 ? 'Some actions could not be read back, so they are not sent: actions are only sent when everything that is signed can be shown.' : undefined);
    const message = ready ? buildAdminExecuteMsg({admin: wallet, daoId: dao.id, msgs: composition.msgs}) : null;
    const maxActions = Number(ctx.params.max_msgs_per_proposal);
    const daoName = (id: string) => (id === dao.id ? dao.name : ctx.subDaos?.find((s) => s.dao.id === id)?.dao.name ?? ctx.incoming?.find((n) => n.id === id)?.name);
    const review = reviewLine(read.actions, {
        dao,
        formatCoin: coins.exact,
        nameOf: (a) => (a === dao.address ? dao.name : a === wallet ? 'you' : undefined),
        daoName,
    });

    return (
        <Card testId="execute-panel" label="Run actions as the DAO">
            <Flex gap="16px" align="center" justify="space-between" wrap="wrap">
                <Title>Run actions as the DAO</Title>
                <Faint>MsgAdminExecute · all or nothing</Faint>
            </Flex>
            <ActionsList
                drafts={drafts}
                composed={composition.actions}
                ctx={ctx}
                maxActions={maxActions}
                formatCoin={coins.exact}
                onChange={setDrafts}
                staged
                wallet={wallet}
                onEditing={setEditing}
                wording={{
                    header: false,
                    hint: 'Same list as proposals. Grants (authz / feegrant) and second signers are refused here.',
                    full: (max) => `At most ${max} actions can run at once.`,
                    commit: 'Add to the list',
                    textOnly: false,
                }}
            />
            {drafts.length > 0 && <SizeMeter size={composition.size} max={composition.maxBytes} count={drafts.length} maxActions={maxActions} />}
            {drafts.length > 0 && (
                <>
                    <chakra.div h="1px" bg="hg.divider" />
                    <Eyebrow>Review</Eyebrow>
                    {/* the sentence only when every action reads back, so it never skips or renumbers one */}
                    {ready && review.length > 0 && <Body testId="execute-review"><Segments segments={review} /></Body>}
                    {!ready && problem && <chakra.p m="0" fontSize="13px" color="hg.danger.text" role="alert" data-testid="execute-problem">{problem}</chakra.p>}
                </>
            )}
            <Flex gap="8px" align="center" justify="flex-end" wrap="wrap">
                {editing && <chakra.span fontSize="12px" color="hg.text.faint" me="auto" data-testid="execute-editing">Add or cancel the open action first: it is not in the list yet.</chakra.span>}
                <Button
                    variant={hgVariant('primary')}
                    size="lg"
                    disabled={!message || locked || editing}
                    onClick={() => message && onSend('admin-execute', [message])}
                    data-testid="execute-submit"
                >
                    {runLabel(drafts.length)}
                </Button>
            </Flex>
        </Card>
    );
};

// ---- the handover ----

/**
 * "Hand over": nominate a successor (the wallet stays admin until the nominee accepts) and, while one is
 * pending, withdraw it. The chain takes one nomination at a time (1112), so the field gives way to that
 * sentence while one is pending.
 */
export const HandOverCard = ({view, wallet, locked, onSend}: OpProps) => {
    const {dao} = view;
    const coins = useCoinFormat();
    const [nominee, setNominee] = useState('');
    const problem = nominateBlocked(dao, nominee);
    const nominateMsg = problem === undefined ? buildNominateAdminMsg({authority: wallet, daoId: dao.id, nominee: nominee.trim().toLowerCase()}) : null;
    const nominateUnreadable = nominateMsg !== null && unreadableOf(nominateMsg, view, coins.exact);
    const pending = withdrawBlocked(dao) === undefined;
    const withdrawMsg = pending ? buildWithdrawAdminNominationMsg({authority: wallet, daoId: dao.id}) : null;
    const withdrawUnreadable = withdrawMsg !== null && unreadableOf(withdrawMsg, view, coins.exact);

    return (
        <Card testId="hand-over-card" label="Hand over">
            <Title>Hand over</Title>
            <chakra.div display="grid" gridTemplateColumns={{base: '1fr', md: 'repeat(2, minmax(0, 1fr))'}} gap="20px">
                <Flex direction="column" gap="10px" minW="0" data-testid="nominate-panel">
                    <Eyebrow>Nominate a successor</Eyebrow>
                    {pending && <Body testId="nominate-pending">{problem}</Body>}
                    {!pending && (
                        <chakra.label display="flex" flexDirection="column" gap="8px" fontSize="14px" fontWeight="600" color="fg" minW="0">
                            New admin
                            <Input
                                {...field}
                                fontFamily="mono"
                                fontSize="14px"
                                fontWeight="500"
                                placeholder="bze1…"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={nominee}
                                onChange={(e) => setNominee(e.target.value)}
                                data-testid="nominee"
                            />
                            <chakra.span fontSize="12px" fontWeight="400" color="hg.text.faint">A person or a DAO. You stay admin until they accept.</chakra.span>
                        </chakra.label>
                    )}
                    {!pending && nominee.trim() !== '' && problem && <chakra.p m="0" fontSize="13px" color="hg.danger.text" role="alert" data-testid="nominate-problem">{problem}</chakra.p>}
                    {nominateUnreadable && <chakra.p m="0" fontSize="13px" color="hg.danger.text" role="alert">{UNREADABLE}</chakra.p>}
                    <div>
                        <Button variant={hgVariant('secondary')} size="md" disabled={!nominateMsg || locked || nominateUnreadable} onClick={() => nominateMsg && onSend('nominate', [nominateMsg])} data-testid="nominate-submit">
                            Nominate
                        </Button>
                    </div>
                </Flex>
                {pending && withdrawMsg && (
                    <Flex direction="column" gap="10px" minW="0" data-testid="withdraw-panel">
                        <Eyebrow>Pending</Eyebrow>
                        <Notice status="warning">
                            <span data-testid="withdraw-nominee">
                                <chakra.strong color="fg" title={dao.pending_admin}>{consoleAddress(dao.pending_admin)}</chakra.strong>
                                {" was nominated. They haven't accepted yet."}
                            </span>
                        </Notice>
                        {withdrawUnreadable && <chakra.p m="0" fontSize="13px" color="hg.danger.text" role="alert">{UNREADABLE}</chakra.p>}
                        <div>
                            <Button variant={hgVariant('secondary')} size="md" disabled={locked || withdrawUnreadable} onClick={() => onSend('withdraw', [withdrawMsg])} data-testid="withdraw-submit">
                                Withdraw nomination
                            </Button>
                        </div>
                    </Flex>
                )}
            </chakra.div>
        </Card>
    );
};

/** Hand the DAO to its own voters: at once, with no accept step, and it cannot be taken back. */
export const HandOverPanel = ({view, relations, wallet, locked, onSend}: OpProps & {relations: Relations}) => {
    const {dao} = view;
    const [typed, setTyped] = useState('');
    const [understood, setUnderstood] = useState(false);
    const coins = useCoinFormat();
    const blocked = handOverBlocked(dao, relations.sources);
    const msg = buildNominateAdminMsg({authority: wallet, daoId: dao.id, nominee: ''});
    const confirmed = handOverConfirmed(dao, typed, understood);
    const unreadable = unreadableOf(msg, view, coins.exact);

    return (
        <Card testId="handover-panel" danger label="Hand the DAO to its voters">
            <Flex gap="10px" align="center" wrap="wrap">
                <Title>Hand the DAO to its voters</Title>
                <Pill tone="danger" testId="handover-pill">Can&apos;t be undone</Pill>
            </Flex>
            <Body testId="handover-text">{handOverLine(dao)}</Body>
            {blocked && <Notice status="warning"><span data-testid="handover-blocked">{blocked}</span></Notice>}
            {!blocked && (
                <>
                    {dao.type === 'DAO_TYPE_STATIC_LIST' && (
                        <Notice status="success" icon={<LuCheck />}>
                            <span data-testid="handover-voters">{`Its voters can vote: ${dao.members.length} ${dao.members.length === 1 ? 'member' : 'members'} ✓ (the chain refuses a DAO nobody can vote in).`}</span>
                        </Notice>
                    )}
                    <chakra.label display="flex" gap="10px" alignItems="center" fontSize="14px" cursor="pointer">
                        <input
                            type="checkbox"
                            checked={understood}
                            onChange={(e) => setUnderstood(e.target.checked)}
                            style={{width: '18px', height: '18px', flex: 'none', accentColor: 'var(--chakra-colors-hg-danger)'}}
                            data-testid="handover-understood"
                        />
                        <span>{`I understand I lose every admin power over ${dao.name}`}</span>
                    </chakra.label>
                    <chakra.label display="flex" flexDirection="column" gap="8px" fontSize="14px" fontWeight="600" color="fg" minW="0">
                        Type the DAO&apos;s name to confirm
                        <Input {...field} fontSize="15px" fontWeight="500" autoCapitalize="none" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="handover-confirm" />
                    </chakra.label>
                    {unreadable && <chakra.p m="0" fontSize="13px" color="hg.danger.text" role="alert">{UNREADABLE}</chakra.p>}
                    <Flex gap="16px" align="center" justify="flex-end" wrap="wrap">
                        <Button variant={hgVariant('danger')} size="lg" disabled={!confirmed || locked || unreadable} onClick={() => onSend('hand-over', [msg])} data-testid="handover-submit">
                            Hand to its voters
                        </Button>
                    </Flex>
                </>
            )}
        </Card>
    );
};

// ---- the nominee (board G2) ----

const ViewDao = ({id}: {id: string}) => (
    <Button asChild variant={hgVariant('secondary')} size="lg">
        <NextLink href={daoTabHref(id)} data-testid="accept-view-dao">View DAO</NextLink>
    </Button>
);

/** The tick's words: what taking over the DAO means for the nominee. */
const acceptUnderstanding = (name: string): string =>
    `I understand that becoming the admin of ${name} comes with responsibilities. I can act for the DAO and spend its treasury without a vote, so I'll keep this address secure for the DAO's sake: if it's lost or stolen, so is control of the DAO.`;

/** The board's tick: a whole-row toggle with a 20 px box that fills with the accent when ticked. */
const Tick = ({checked, onToggle, children}: {checked: boolean; onToggle: () => void; children: ReactNode}) => (
    <chakra.button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        display="flex"
        gap="12px"
        alignItems="flex-start"
        p="14px 16px"
        borderRadius="12px"
        bg="hg.inset"
        borderWidth="1px"
        borderColor={checked ? accent(45) : 'hg.hairline'}
        data-checked={checked ? '' : undefined}
        textAlign="start"
        cursor="pointer"
        fontSize="14px"
        fontWeight="400"
        lineHeight="1.55"
        color="hg.text.secondary"
        data-testid="accept-understood"
    >
        <chakra.span
            aria-hidden
            flex="none"
            boxSize="20px"
            mt="1px"
            borderRadius="6px"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            boxSizing="border-box"
            bgImage={checked ? 'appButton' : undefined}
            borderWidth={checked ? '0' : '1.5px'}
            borderColor="hg.text.faint"
            color="white"
            css={{'& svg': {width: '14px', height: '14px', strokeWidth: 3}}}
        >
            {checked && <LuCheck />}
        </chakra.span>
        <span data-testid="accept-understood-text">{children}</span>
    </chakra.button>
);

/** The nominee's single card sits in the left half of the boards' two-column grid. */
const NomineeGrid = ({children}: {children: ReactNode}) => (
    <chakra.div display="grid" gridTemplateColumns={{base: '1fr', md: 'repeat(2, minmax(0, 1fr))'}} gap="16px">{children}</chakra.div>
);

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

    if (check.loading) return <NomineeGrid><Shimmer h="220px" borderRadius="20px" data-testid="accept-checking" /></NomineeGrid>;

    const staleness = check.data;
    if (staleness?.stale) {
        const parent = staleness.parent.name;
        // the approved sentence when the parent itself changed its admin; a change further up names that DAO
        const who = staleness.changed.id === staleness.parent.id
            ? `${parent}, the DAO that runs ${dao.name}`
            : `${staleness.changed.name}, which controls ${parent}`;
        return (
            <NomineeGrid>
                <Card testId="stale-card" label="This nomination is out of date">
                    <Flex gap="10px" align="center" wrap="wrap">
                        <Title>This nomination is out of date</Title>
                        <Pill tone="stale" testId="stale-pill">Stale</Pill>
                    </Flex>
                    <Body testId="stale-text">
                        {`${who}, changed its admin after you were nominated, so this nomination can no longer be accepted. ${parent} has to nominate you again.`}
                    </Body>
                    <Flex gap="8px" align="center" justify="flex-end" wrap="wrap"><ViewDao id={dao.id} /></Flex>
                </Card>
            </NomineeGrid>
        );
    }

    const unreadable = unreadableOf(msg, view, coins.exact);
    return (
        <NomineeGrid>
            <chakra.section {...featured} p={{base: '16px', md: '24px'}} display="flex" flexDirection="column" gap="16px" minW="0" aria-label="Accept the nomination" data-testid="accept-card">
                <Flex gap="10px" align="center" wrap="wrap">
                    <Title testId="accept-title">{`You're nominated to run ${dao.name}`}</Title>
                    <Pill tone="nominated" testId="nominated-pill">Nominated</Pill>
                </Flex>
                <Tick checked={understood} onToggle={() => setUnderstood(!understood)}>{acceptUnderstanding(dao.name)}</Tick>
                {unreadable && <chakra.p m="0" fontSize="13px" color="hg.danger.text" role="alert">{UNREADABLE}</chakra.p>}
                <Flex gap="8px" align="center" justify="flex-end" wrap="wrap">
                    <ViewDao id={dao.id} />
                    <Button variant={hgVariant('primary')} size="lg" disabled={!understood || locked || unreadable} onClick={() => onSend('accept', [msg])} data-testid="accept-submit">
                        Accept and become admin
                    </Button>
                </Flex>
            </chakra.section>
        </NomineeGrid>
    );
};
