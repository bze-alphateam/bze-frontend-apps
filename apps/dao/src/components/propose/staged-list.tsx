'use client';

import {useState, type ReactNode} from 'react';
import {Button, chakra, CloseButton, Dialog, Flex, Portal} from '@chakra-ui/react';
import {
    LuArrowUp, LuCode, LuFileText, LuNetwork, LuPencil, LuPlus, LuSend, LuSlidersHorizontal, LuTrash2, LuUndo2, LuUserCheck, LuUserPlus, LuUsers, LuVote,
} from 'react-icons/lu';
import {hgVariant, Notice} from '@bze/bze-ui-kit';
import type {DaoCoin} from '@bze/bze-ui-kit';
import {composeAction, type ComposedAction} from '@/lib/actions/compose-action';
import {availableActions, findAction} from '@/lib/actions/registry';
import {ACCEPT_ID, NOMINATE_ID, WITHDRAW_ID} from '@/lib/actions/admin';
import {CUSTOM_ID} from '@/lib/actions/custom';
import {ELECTORATE_ID} from '@/lib/actions/electorate';
import {MEMBERS_ID} from '@/lib/actions/members';
import {METADATA_ID} from '@/lib/actions/metadata';
import {PAY_ID} from '@/lib/actions/pay';
import {RULES_ID} from '@/lib/actions/rules';
import {innerKey, SUB_ADMIN_ID, SUB_EXECUTE_ID, type SubAdminMode} from '@/lib/actions/sub-dao';
import type {ActionContext, ActionDraft, ActionEntry, ActionFields} from '@/lib/actions/types';
import type {MsgAction} from '@/lib/proposal-describe';
import {cardDetail, pickerSubtitle, type CardTextContext, type Segment} from '@/lib/propose/composer-text';
import {tryDescribe} from '@/lib/propose/describe';
import {staleNominationText, type StaleNomination} from '@/lib/propose/relations';
import {Described} from '@/components/proposal/actions-panel';
import {ACTION_FORMS} from './action-forms';
import type {ActionsListProps} from './actions-list';
import {groupOf, PICKER_GROUPS, pickerTestId, STALE_NOTE, SUB_IDS} from './picker-groups';
import {Segmented} from './segmented';

const ICONS: Record<string, ReactNode> = {
    [PAY_ID]: <LuSend />,
    [CUSTOM_ID]: <LuCode />,
    [METADATA_ID]: <LuPencil />,
    [RULES_ID]: <LuSlidersHorizontal />,
    [MEMBERS_ID]: <LuUsers />,
    [ELECTORATE_ID]: <LuVote />,
    [NOMINATE_ID]: <LuUserPlus />,
    [WITHDRAW_ID]: <LuUndo2 />,
    [ACCEPT_ID]: <LuUserCheck />,
    [SUB_ADMIN_ID]: <LuNetwork />,
    [SUB_EXECUTE_ID]: <LuNetwork />,
    text: <LuFileText />,
};

/** The boards' words for each entry: the picker row and the card title, and the form card's header. */
const COPY: Record<string, {title: string; hint?: string; form: string; tag?: string}> = {
    [PAY_ID]: {title: 'Pay from the treasury', hint: 'Send tokens the DAO holds to an address.', form: 'Pay from the treasury', tag: "cosmos.bank MsgSend from the DAO's address"},
    [CUSTOM_ID]: {title: 'Custom message (advanced)', hint: 'Any chain message, written as JSON, signed by the DAO.', form: 'Custom message'},
    [METADATA_ID]: {title: 'Rename or edit the description', form: 'Rename or edit the description', tag: 'MsgUpdateMetadata'},
    [RULES_ID]: {title: 'Change the voting rules', form: 'Change the voting rules', tag: 'MsgUpdateDaoConfig (whole config)'},
    [MEMBERS_ID]: {title: 'Add or remove members', form: 'Add or remove members', tag: 'MsgUpdateMembers · member lists only'},
    [ELECTORATE_ID]: {title: 'Change the voters', form: 'Change the voters', tag: 'MsgUpdateElectorate · Stakers DAOs only'},
    [NOMINATE_ID]: {title: 'Nominate an admin', hint: 'Only while the DAO governs itself.', form: 'Hand over this DAO', tag: 'Only while it governs itself'},
    [WITHDRAW_ID]: {title: 'Withdraw the admin nomination', form: 'Withdraw the admin nomination', tag: 'MsgWithdrawAdminNomination'},
    [ACCEPT_ID]: {title: 'Accept a nomination as this DAO', form: 'Accept a nomination as this DAO', tag: 'MsgAcceptAdminNomination'},
};

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** What a DAO in this context is called: the DAO, a SubDAO or a nominating DAO, never a number. */
const daoNameIn = (ctx: ActionContext) => (id: string): string =>
    id === ctx.dao.id ? ctx.dao.name
        : ctx.subDaos?.find((s) => s.dao.id === id)?.dao.name ?? ctx.incoming?.find((d) => d.id === id)?.name ?? 'another DAO';

/** A card's title: the entry's words, the SubDAO or nominating DAO named, "As <SubDAO>: …" inside a SubDAO's list. */
function cardTitle(draft: ActionDraft, entry: ActionEntry, ctx: ActionContext, nested: boolean): string {
    const daoName = daoNameIn(ctx);
    if (draft.type === ACCEPT_ID && draft.fields.daoId) return `Accept: become the admin of ${daoName(draft.fields.daoId)}`;
    if (SUB_IDS.includes(draft.type)) return `Manage ${draft.fields.daoId ? daoName(draft.fields.daoId) : 'a SubDAO'} (SubDAO)`;
    const title = COPY[draft.type]?.title ?? entry.label;
    return nested ? `As ${ctx.dao.name}: ${lowerFirst(title).replace('the treasury', 'its treasury')}` : title;
}

const IconTile = ({id, size = 36, soft = false}: {id: string; size?: number; soft?: boolean}) => (
    <chakra.span
        flex="none" boxSize={`${size}px`} borderRadius="10px" display="inline-flex" alignItems="center" justifyContent="center"
        bgImage={soft ? undefined : 'app'} bg={soft ? 'app.subtle' : undefined} color={soft ? 'hg.link' : 'white'}
        css={{'& svg': {width: '18px', height: '18px'}}} aria-hidden
    >
        {ICONS[id] ?? <LuCode />}
    </chakra.span>
);

const DetailLine = ({segments, testId}: {segments: Segment[]; testId?: string}) => (
    <chakra.span color="hg.text.secondary" overflowWrap="anywhere" data-testid={testId}>
        {segments.map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </chakra.span>
);

const squareButton = {
    type: 'button',
    boxSize: '32px',
    borderRadius: '9px',
    borderWidth: '1px',
    borderColor: 'hg.hairline',
    bg: 'transparent',
    color: 'fg.muted',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    _hover: {color: 'hg.link', borderColor: 'app.border'},
    _disabled: {opacity: 0.35, cursor: 'default', _hover: {color: 'fg.muted', borderColor: 'hg.hairline'}},
    css: {'& svg': {width: '14px', height: '14px'}},
} as const;

interface CardProps {
    index: number;
    draft: ActionDraft;
    composed: ComposedAction | undefined;
    ctx: ActionContext;
    nested: boolean;
    formatCoin: (coin: DaoCoin) => string;
    text: CardTextContext;
    /** A form card is open: the list does not change under it. */
    locked: boolean;
    onMoveUp: () => void;
    onEdit: () => void;
    onRemove: () => void;
}

/** One numbered action of the list: icon, title, what the signed message does (read back), and Move up / Edit / Remove. */
const ActionCard = ({index, draft, composed, ctx, nested, formatCoin, text, locked, onMoveUp, onEdit, onRemove}: CardProps) => {
    const entry = findAction(draft.type);
    if (!entry) return null;
    const read = composed?.msg ? tryDescribe(composed.msg, ctx.dao, formatCoin, ctx.subDaos) : null;
    const action: MsgAction | null = read?.ok ? read.action : null;
    const error = composed?.error;
    const number = index + 1;

    return (
        <chakra.li listStyleType="none" display="flex" flexDirection={{base: 'column', md: 'row'}} gap={{base: '8px', md: '12px'}} alignItems={{base: 'stretch', md: 'center'}} data-testid="action-row">
            <Flex
                flex="1" minW="0" gap="14px" p="16px" borderRadius="14px" bg="hg.inset" borderWidth="1px"
                borderColor={error ? 'hg.danger/40' : 'app.muted'} data-invalid={error ? '' : undefined}
            >
                <chakra.span fontSize="12px" fontWeight="700" color="hg.text.faint" w="14px" pt="10px" flex="none">{number}</chakra.span>
                <IconTile id={draft.type} />
                <Flex direction="column" gap="4px" fontSize="14px" lineHeight="1.55" minW="0">
                    <chakra.strong fontSize="15px" data-testid="action-card-title">{cardTitle(draft, entry, ctx, nested)}</chakra.strong>
                    {action && <DetailLine segments={cardDetail(action, text)} testId="action-preview" />}
                    {action?.type === 'admin_execute' && action.actions.length > 0 && (
                        <chakra.ol m="0" ps="18px" display="flex" flexDirection="column" gap="2px" fontSize="13px" data-testid="action-inner">
                            {action.actions.map((inner, i) => <li key={i}><DetailLine segments={cardDetail(inner, {...text, nameOf: () => undefined})} /></li>)}
                        </chakra.ol>
                    )}
                    {action?.type === 'other' && (
                        <chakra.details fontSize="12px" color="hg.text.faint">
                            <chakra.summary cursor="pointer">The message as JSON</chakra.summary>
                            <chakra.pre m="0" mt="6px" p="10px" bg="hg.card" borderRadius="10px" overflowX="auto" fontSize="12px" data-testid="action-json">{action.json}</chakra.pre>
                        </chakra.details>
                    )}
                    {read && !read.ok && <chakra.span color="hg.danger.text" role="alert" data-testid="action-unreadable">{`This message could not be read back: ${read.error}`}</chakra.span>}
                    {error && <chakra.span color="hg.danger.text" fontWeight="500" role="alert" data-testid="action-error">{error}</chakra.span>}
                    {composed?.warnings.map((w) => <chakra.span key={w} fontSize="13px" color="hg.warning.text" data-testid="action-warning">{w}</chakra.span>)}
                </Flex>
            </Flex>
            <Flex gap="4px" flex="none" alignSelf={{base: 'flex-end', md: 'center'}}>
                <chakra.button {...squareButton} disabled={locked || index === 0} onClick={onMoveUp} aria-label={`Move action ${number} up`} data-testid="action-move-up"><LuArrowUp aria-hidden /></chakra.button>
                <chakra.button {...squareButton} disabled={locked} onClick={onEdit} aria-label={`Edit action ${number}`} data-testid="action-edit"><LuPencil aria-hidden /></chakra.button>
                <chakra.button {...squareButton} disabled={locked} onClick={onRemove} aria-label={`Remove action ${number}`} data-testid="action-remove"><LuTrash2 aria-hidden /></chakra.button>
            </Flex>
        </chakra.li>
    );
};

/** The three (four with a pending nomination) ways to manage a SubDAO, each a draft of one of the two SubDAO entries. */
type SubWay = 'execute' | SubAdminMode;

const SUB_WAY_TEXT: Record<SubWay, string> = {
    execute: 'Run actions as it',
    nominate: 'Nominate a new admin',
    withdraw: 'Withdraw its nomination',
    voters: 'Hand it to its voters',
};

const subWayOf = (draft: ActionDraft): SubWay => (draft.type === SUB_EXECUTE_ID ? 'execute' : ((draft.fields.mode as SubAdminMode | undefined) ?? 'nominate'));

interface EditorProps {
    draft: ActionDraft;
    ctx: ActionContext;
    nested: boolean;
    editing: boolean;
    formatCoin: (coin: DaoCoin) => string;
    wallet: string | null;
    entries: ActionEntry[];
    onChange: (draft: ActionDraft) => void;
    onCancel: () => void;
    onCommit: () => void;
}

/** The form card of one action (board F2/F3): its header, its form, the problems, then Cancel / Add to proposal. */
const ActionEditor = ({draft, ctx, nested, editing, formatCoin, wallet, entries, onChange, onCancel, onCommit}: EditorProps) => {
    const [tried, setTried] = useState(false);
    // a SubDAO's inner list with its own form card open: this card waits for it
    const [innerOpen, setInnerOpen] = useState(false);
    const entry = findAction(draft.type);
    const Form = ACTION_FORMS[draft.type];
    if (!entry || !Form) return null;

    const composed = composeAction(draft, ctx, findAction);
    // an untouched form is not an error yet; an attempt to add it is
    const dirty = tried || JSON.stringify(draft.fields) !== JSON.stringify(entry.initialFields(ctx));
    const sub = SUB_IDS.includes(draft.type) ? ctx.subDaos?.find((s) => s.dao.id === draft.fields.daoId) : undefined;
    const copy = COPY[draft.type];
    const title = sub ? `Manage ${sub.dao.name}` : copy?.form ?? entry.label;
    const tag = sub ? `${ctx.dao.name} is its admin` : copy?.tag;
    const read = draft.type === CUSTOM_ID && composed.msg && !composed.error ? tryDescribe(composed.msg, ctx.dao, formatCoin, ctx.subDaos) : null;
    const rules = draft.type === RULES_ID && composed.msg ? tryDescribe(composed.msg, ctx.dao, formatCoin, ctx.subDaos) : null;
    const changes = rules?.ok && rules.action.type === 'update_config' ? rules.action.changes : null;

    const ways: SubWay[] = sub ? [
        ...(entries.some((e) => e.id === SUB_EXECUTE_ID) ? ['execute' as const] : []),
        ...(entries.some((e) => e.id === SUB_ADMIN_ID) ? (['nominate', ...(sub.dao.pending_admin ? ['withdraw' as const] : []), 'voters'] as SubWay[]) : []),
    ] : [];
    const pickWay = (way: SubWay) => {
        if (!sub || way === subWayOf(draft)) return;
        const type = way === 'execute' ? SUB_EXECUTE_ID : SUB_ADMIN_ID;
        const initial = findAction(type)?.initialFields(ctx) ?? {};
        setInnerOpen(false);
        onChange({...draft, type, fields: way === 'execute' ? {...initial, daoId: sub.dao.id, inner: ''} : {...initial, daoId: sub.dao.id, mode: way}});
    };

    const commit = () => {
        setTried(true);
        if (!composed.error && !innerOpen) onCommit();
    };

    return (
        <chakra.section bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="16px" p={{base: '16px', md: '22px'}} display="flex" flexDirection="column" gap="16px" minW="0" data-testid="action-editor" aria-label={title}>
            <Flex gap="10px 16px" align="center" justify={copy?.tag || sub ? 'space-between' : 'flex-start'} wrap="wrap">
                <chakra.h2 m="0" fontSize="17px" fontWeight="700">{title}</chakra.h2>
                {draft.type === CUSTOM_ID
                    ? <chakra.span fontSize="12px" fontWeight="600" px="9px" py="3px" borderRadius="999px" color="hg.warning.text" bg="hg.warning/12" borderWidth="1px" borderColor="hg.warning/40" data-testid="advanced-pill">Advanced</chakra.span>
                    : tag && <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">{tag}</chakra.span>}
            </Flex>
            {ways.length > 1 && (
                <Segmented
                    label={`Manage ${sub?.dao.name ?? 'the SubDAO'}`}
                    value={subWayOf(draft)}
                    onChange={pickWay}
                    options={ways.map((way) => ({value: way, label: SUB_WAY_TEXT[way], testId: `sub-way-${way}`}))}
                    testId="sub-ways"
                />
            )}
            <Form
                fields={draft.fields}
                onChange={(fields: ActionFields) => onChange({...draft, fields})}
                ctx={ctx}
                error={dirty ? composed.error : undefined}
                staged
                renderActions={(inner) => (
                    <StagedList drafts={inner.drafts} ctx={inner.ctx} maxActions={Number(inner.ctx.params.max_msgs_per_proposal)} formatCoin={formatCoin} onChange={inner.onChange} nested staged wallet={wallet} onEditing={setInnerOpen} />
                )}
            />
            {changes && (changes.length === 0
                ? <chakra.span fontSize="13px" color="hg.text.faint" data-testid="rules-diff-none">Nothing changes yet: these are today&apos;s rules.</chakra.span>
                : <RulesDiff changes={changes} />)}
            {composed.warnings.map((w) => <Notice key={w} status="warning"><span data-testid="action-warning">{w}</span></Notice>)}
            {read && (
                <Notice status={read.ok ? 'success' : 'danger'} title={read.ok ? 'Looks right' : 'This message could not be read back'}>
                    {read.ok
                        ? <chakra.span display="block" data-testid="action-decoded"><Described action={read.action} formatCoin={formatCoin} nameOf={(a) => (a === ctx.dao.address ? ctx.dao.name : undefined)} signerOf={(id) => ctx.subDaos?.find((s) => s.dao.id === id)?.dao.address} daoOf={(id) => (id === ctx.dao.id ? ctx.dao : ctx.subDaos?.find((s) => s.dao.id === id)?.dao)} /></chakra.span>
                        : <span role="alert">{read.error}</span>}
                </Notice>
            )}
            <Flex gap="8px" align="center" justify="flex-end" wrap="wrap">
                {innerOpen && <chakra.span fontSize="12px" color="hg.text.faint" me="auto" data-testid="action-commit-blocked">Add or cancel the open action above first.</chakra.span>}
                <Button variant="ghost" size="md" color="hg.link" onClick={onCancel} data-testid="action-cancel">Cancel</Button>
                <Button variant={hgVariant('primary')} size="md" disabled={innerOpen} onClick={commit} data-testid="action-commit">
                    {editing ? 'Save changes' : nested ? 'Add to the list' : 'Add to proposal'}
                </Button>
            </Flex>
        </chakra.section>
    );
};

const cell = {px: '12px', py: '9px', borderTopWidth: '1px', borderColor: 'hg.divider'} as const;

/** Board F3's Setting / Now / After table: only the settings that change. */
const RulesDiff = ({changes}: {changes: {field: string; label: string; before: string | null; after: string}[]}) => (
    <chakra.div display="grid" gridTemplateColumns="1fr 1fr 1fr" fontSize="13px" borderRadius="12px" overflow="hidden" borderWidth="1px" borderColor="hg.hairline" data-testid="rules-diff">
        <chakra.span px="12px" py="9px" bg="hg.inset" fontWeight="700" color="fg.muted">Setting</chakra.span>
        <chakra.span px="12px" py="9px" bg="hg.inset" fontWeight="700" color="hg.text.secondary">Now</chakra.span>
        <chakra.span px="12px" py="9px" bg="hg.inset" fontWeight="700" color="hg.text.secondary">After</chakra.span>
        {changes.map((c) => (
            <chakra.div key={c.field} display="contents" data-testid="config-change">
                <chakra.span {...cell} color="fg.muted">{c.label}</chakra.span>
                <chakra.span {...cell} color="hg.text.secondary">{c.before ?? '—'}</chakra.span>
                <chakra.span {...cell} color="app.fg">{c.after}</chakra.span>
            </chakra.div>
        ))}
    </chakra.div>
);

const PickerRow = ({id, title, hint, testId, hintTestId, onClick, disabled, pill}: {id: string; title: string; hint?: string; testId: string; hintTestId?: string; onClick?: () => void; disabled?: boolean; pill?: string}) => (
    <chakra.button
        type="button" display="flex" gap="12px" alignItems="center" w="100%" px="12px" py="10px" borderRadius="12px" borderWidth="1px"
        borderColor="hg.hairline" bg="transparent" color="fg" textAlign="start" cursor={disabled ? 'not-allowed' : 'pointer'}
        opacity={disabled ? 0.5 : 1} _hover={disabled ? undefined : {borderColor: 'app.border', bg: 'hg.hoverFill'}}
        disabled={disabled} aria-disabled={disabled || undefined} onClick={onClick} data-testid={testId}
    >
        <IconTile id={id} size={34} soft />
        <Flex direction="column" gap="2px" minW="0">
            <Flex as="span" gap="8px" align="center" wrap="wrap">
                <chakra.strong fontSize="14px">{title}</chakra.strong>
                {pill && <chakra.span fontSize="12px" fontWeight="600" px="9px" py="3px" borderRadius="999px" color="hg.text.secondary" bg="hg.inset" borderWidth="1px" borderColor="hg.hairline" data-testid="stale-pill">{pill}</chakra.span>}
            </Flex>
            {hint && <chakra.span fontSize="12px" color="hg.text.faint" data-testid={hintTestId}>{hint}</chakra.span>}
        </Flex>
    </chakra.button>
);

const GroupTitle = ({children}: {children: ReactNode}) => (
    <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="hg.text.faint">{children}</chakra.span>
);

interface PickerProps {
    open: boolean;
    onClose: () => void;
    ctx: ActionContext;
    entries: ActionEntry[];
    stale: StaleNomination[];
    textOnly: boolean;
    onText: () => void;
    onPick: (type: string, preset?: ActionFields) => void;
}

/** "Add an action" (board F2): only what applies to this DAO, grouped Basics · This DAO · Other DAOs. */
const Picker = ({open, onClose, ctx, entries, stale, textOnly, onText, onPick}: PickerProps) => {
    const has = (id: string) => entries.some((e) => e.id === id);
    const subs = ctx.subDaos !== null && ctx.subDaos.length > 0 && SUB_IDS.some(has);
    const groups = PICKER_GROUPS.map((group, i) => ({group, list: entries.filter((e) => groupOf(e.id) === i && !(subs && SUB_IDS.includes(e.id)))}));

    const rows = (list: ActionEntry[]) => list.map((entry) => {
        if (entry.id === ACCEPT_ID && ctx.incoming) {
            return ctx.incoming.map((n) => (
                <PickerRow key={`${ACCEPT_ID}-${n.id}`} id={ACCEPT_ID} title={`Accept: become the admin of ${n.name}`} hint={`${n.name} nominated ${ctx.dao.name}.`} testId={`add-${ACCEPT_ID}-${n.id}`} onClick={() => onPick(ACCEPT_ID, {daoId: n.id})} />
            ));
        }
        const copy = COPY[entry.id];
        return <PickerRow key={entry.id} id={entry.id} title={copy?.title ?? entry.label} hint={copy ? copy.hint : entry.description} testId={`add-${entry.id}`} onClick={() => onPick(entry.id)} />;
    });

    return (
        <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose(); }} placement="center" scrollBehavior="inside" unmountOnExit>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{base: '92vw', md: '440px'}} bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="20px" boxShadow="0 40px 80px -30px rgba(0,0,0,0.9)" data-testid="action-picker">
                        <Dialog.Header pt="24px" px="24px" pb="0" pr="56px" flexDirection="column" alignItems="flex-start" gap="2px">
                            <Dialog.Title fontSize="19px" fontWeight="700">Add an action</Dialog.Title>
                            <chakra.span fontSize="13px" color="fg.muted" data-testid="picker-subtitle">{pickerSubtitle(ctx.dao)}</chakra.span>
                        </Dialog.Header>
                        <Dialog.Body px="24px" pt="16px" pb="24px" display="flex" flexDirection="column" gap="8px">
                            {groups.map(({group, list}) => {
                                const isOther = group.title === 'Other DAOs';
                                const groupStale = isOther ? stale : [];
                                const withdrawIdle = group.title === 'This DAO' && has(NOMINATE_ID) && !has(WITHDRAW_ID);
                                const basicsText = group.title === 'Basics' && textOnly;
                                const subRows = isOther && subs ? ctx.subDaos ?? [] : [];
                                if (list.length + groupStale.length + subRows.length === 0 && !withdrawIdle && !basicsText) return null;
                                return (
                                    <Flex key={group.title} direction="column" gap="8px" data-testid={pickerTestId(group.title)}>
                                        <GroupTitle>{group.title}</GroupTitle>
                                        {isOther && (groupStale.length > 0 || has(ACCEPT_ID)) && <chakra.p m="0" fontSize="12px" color="hg.text.faint" data-testid="picker-stale-note">{STALE_NOTE}</chakra.p>}
                                        {basicsText && <PickerRow id="text" title="Text only" hint="No action: the DAO states a position or agrees on a plan." testId="add-text-only" onClick={onText} />}
                                        {rows(list)}
                                        {withdrawIdle && <PickerRow id={WITHDRAW_ID} title="Withdraw the admin nomination" hint="Nothing is pending" testId="withdraw-nothing-pending" disabled />}
                                        {groupStale.map((s) => (
                                            <PickerRow key={s.dao.id} id={ACCEPT_ID} title={`Accept: become the admin of ${s.dao.name}`} hint={staleNominationText(s, ctx.dao.name)} hintTestId="stale-nomination-text" testId={`stale-nomination-${s.dao.id}`} disabled pill="Stale" />
                                        ))}
                                        {subRows.map((s) => (
                                            <PickerRow key={s.dao.id} id={SUB_EXECUTE_ID} title={`Manage ${s.dao.name} (SubDAO)`} hint="Hand over, or run actions as it." testId={`manage-sub-dao-${s.dao.id}`}
                                                       onClick={() => (has(SUB_EXECUTE_ID) ? onPick(SUB_EXECUTE_ID, {daoId: s.dao.id, inner: ''}) : onPick(SUB_ADMIN_ID, {daoId: s.dao.id}))} />
                                        ))}
                                    </Flex>
                                );
                            })}
                        </Dialog.Body>
                        <Dialog.CloseTrigger asChild top="20px" insetEnd="18px">
                            <CloseButton size="sm" aria-label="Close" />
                        </Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

const newKey = (): string => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * The composer's list of actions (boards F1–F3). Each action is a numbered card read back from its signed
 * message; adding or editing opens one form card, and only "Add to proposal" puts it in the list (Cancel
 * leaves the list as it was). A nested list (the actions run as a SubDAO) works the same inside its form.
 */
export const StagedList = ({drafts, composed: given, ctx, maxActions, formatCoin, onChange, nested = false, staleNominations = [], wallet = null, onEditing}: ActionsListProps) => {
    const [picking, setPicking] = useState(false);
    const [editor, setEditorState] = useState<{draft: ActionDraft; index: number | null} | null>(null);
    // the page is told whether a form card is open (an action not added yet must not be left out silently)
    const setEditor = (next: {draft: ActionDraft; index: number | null} | null) => {
        if ((next === null) !== (editor === null)) onEditing?.(next !== null);
        setEditorState(next);
    };
    const [textOnly, setTextOnly] = useState(false);
    const entries = availableActions(ctx.dao, ctx);
    const composed = given ?? drafts.map((draft) => composeAction(draft, ctx, findAction));
    const full = drafts.length >= maxActions;
    const text: CardTextContext = {
        formatCoin,
        wallet,
        nameOf: (a) => (a === ctx.dao.address ? ctx.dao.name : undefined),
        daoName: daoNameIn(ctx),
    };

    const nextKey = () => (nested ? innerKey(1 + Math.max(-1, ...drafts.map((d) => Number(d.key.replace('inner', '')) || 0))) : newKey());
    const pick = (type: string, preset: ActionFields = {}) => {
        const entry = findAction(type);
        if (!entry) return;
        setPicking(false);
        setTextOnly(false);
        setEditor({draft: {key: nextKey(), type, fields: {...entry.initialFields(ctx), ...preset}}, index: null});
    };
    const commit = () => {
        if (!editor) return;
        if (editor.index === null) onChange([...drafts, editor.draft]);
        else onChange(drafts.map((d, i) => (i === editor.index ? editor.draft : d)));
        setEditor(null);
    };
    const moveUp = (index: number) => {
        const next = [...drafts];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        onChange(next);
    };

    const editorCard = editor && (
        <ActionEditor
            key={editor.draft.key}
            draft={editor.draft}
            ctx={ctx}
            nested={nested}
            editing={editor.index !== null}
            formatCoin={formatCoin}
            wallet={wallet}
            entries={entries}
            onChange={(draft) => setEditor({...editor, draft})}
            onCancel={() => setEditor(null)}
            onCommit={commit}
        />
    );

    return (
        <Flex direction="column" gap="12px" minW="0" data-testid={nested ? 'nested-actions' : 'actions-editor'}>
            {!nested && (
                <Flex gap="4px 16px" align="center" justify="space-between" wrap="wrap">
                    <chakra.span fontSize="14px" fontWeight="600">What it does if it passes</chakra.span>
                    <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">{`Run as ${ctx.dao.name}, in this order`}</chakra.span>
                </Flex>
            )}
            {nested && drafts.length === 0 && !editor && <chakra.span fontSize="13px" color="hg.text.faint" data-testid="no-inner-actions">{`No actions yet: add what ${ctx.dao.name} does, in order.`}</chakra.span>}
            {drafts.length > 0 && (
                <chakra.ol m="0" p="0" display="flex" flexDirection="column" gap="12px">
                    {drafts.map((draft, i) => (editor?.index === i
                        ? <chakra.li key={draft.key} listStyleType="none">{editorCard}</chakra.li>
                        : (
                            <ActionCard
                                key={draft.key}
                                index={i}
                                draft={draft}
                                composed={composed.find((c) => c.key === draft.key)}
                                ctx={ctx}
                                nested={nested}
                                formatCoin={formatCoin}
                                text={text}
                                locked={editor !== null}
                                onMoveUp={() => moveUp(i)}
                                onEdit={() => setEditor({draft, index: i})}
                                onRemove={() => onChange(drafts.filter((x) => x.key !== draft.key))}
                            />
                        )))}
                </chakra.ol>
            )}
            {editor?.index === null && editorCard}
            {textOnly && !editor && (
                <chakra.section bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="16px" p={{base: '16px', md: '22px'}} display="flex" flexDirection="column" gap="16px" data-testid="text-only">
                    <Flex justify="space-between" align="center" gap="12px">
                        <chakra.h2 m="0" fontSize="17px" fontWeight="700">Text only</chakra.h2>
                        <CloseButton size="sm" aria-label="Close" onClick={() => setTextOnly(false)} />
                    </Flex>
                    <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="hg.text.secondary">
                        Nothing runs if it passes. Use it to agree on a plan, a budget or a position, then follow up with proposals that act. A proposal with no actions at all is a text proposal; adding an action later turns it into a normal one.
                    </chakra.p>
                </chakra.section>
            )}
            {!editor && !full && (
                <Flex gap="12px" align="center" wrap="wrap">
                    <Button variant={hgVariant('secondary')} size="md" w={{base: nested ? 'auto' : '100%', md: 'auto'}} onClick={() => setPicking(true)} data-testid="add-action">
                        <LuPlus aria-hidden />Add an action
                    </Button>
                    {!nested && <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" display={{base: 'none', md: 'inline'}} data-testid="text-only-hint">No action = a text-only (signalling) proposal.</chakra.span>}
                </Flex>
            )}
            {full && !editor && <chakra.span fontSize="13px" color="hg.text.faint" data-testid="actions-full">{`A proposal can run at most ${maxActions} actions.`}</chakra.span>}
            <Picker
                open={picking}
                onClose={() => setPicking(false)}
                ctx={ctx}
                entries={entries}
                stale={staleNominations}
                textOnly={!nested && drafts.length === 0}
                onText={() => { setPicking(false); setTextOnly(true); }}
                onPick={pick}
            />
        </Flex>
    );
};
