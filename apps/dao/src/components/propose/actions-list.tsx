'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuArrowDown, LuArrowUp, LuTrash2} from 'react-icons/lu';
import type {DaoCoin} from '@bze/bze-ui-kit';
import {composeAction, type ComposedAction} from '@/lib/actions/compose-action';
import {availableActions, findAction} from '@/lib/actions/registry';
import {ACCEPT_ID} from '@/lib/actions/admin';
import {innerKey, SUB_ADMIN_ID, SUB_EXECUTE_ID} from '@/lib/actions/sub-dao';
import type {ActionContext, ActionDraft, ActionEntry, ActionFields} from '@/lib/actions/types';
import {tryDescribe} from '@/lib/propose/describe';
import {staleNominationText, type StaleNomination} from '@/lib/propose/relations';
import {Described} from '@/components/proposal/actions-panel';
import {Panel} from '@/components/dao/page/panel';
import {ACTION_FORMS} from './action-forms';
import {groupOf, PICKER_GROUPS, pickerTestId, STALE_NOTE, SUB_IDS} from './picker-groups';
import {StagedList} from './staged-list';

interface Props {
    drafts: ActionDraft[];
    /** What each draft composes to; left out for a nested list, which works it out itself. */
    composed?: ComposedAction[];
    ctx: ActionContext;
    maxActions: number;
    formatCoin: (coin: DaoCoin) => string;
    onChange: (drafts: ActionDraft[]) => void;
    /** The list inside another action (run as a sub-DAO): no panel of its own. */
    nested?: boolean;
    /** The wording of a list that is not a proposal's (the admin console's); the defaults are a proposal's. */
    wording?: ListWording;
    /** Nominations of this DAO that went stale: listed in the picker greyed out, never added. */
    staleNominations?: StaleNomination[];
    /**
     * The composer's list (boards F1–F3): numbered summary cards, a picker dialog, and one form card at a time
     * whose action joins the list only on "Add to proposal". Without it (the admin console) every form stays open.
     */
    staged?: boolean;
    /** The connected wallet, which a card names "(you)" (staged lists only). */
    wallet?: string | null;
    /** Told when a form card opens or closes (staged lists only): its action is not in the list until it is added. */
    onEditing?: (open: boolean) => void;
}

export type ActionsListProps = Props;

/**
 * The words of a list that is not a proposal's (the admin console's). Every field is optional and falls back to
 * the composer's own words. `intro`, `empty` and `title` are the inline list's; `header`, `hint`, `commit` and
 * `textOnly` are the staged list's (top level).
 */
export interface ListWording {
    title?: string;
    intro?: string;
    empty?: string;
    /** The note once the list is full. */
    full?: (max: number) => string;
    /** Staged: false leaves out the "What it does if it passes" header. */
    header?: boolean;
    /** Staged: the hint next to "Add an action"; null leaves it out. */
    hint?: string | null;
    /** Staged: the button that adds a new action from its form card ("Add to proposal"). */
    commit?: string;
    /** Staged: false leaves "Text only" out of the picker. */
    textOnly?: boolean;
    /** Staged, nested (a SubDAO's actions): the line of an empty list, given the SubDAO's name. */
    nestedEmpty?: (daoName: string) => string;
    /** Staged, nested: the button that adds a new inner action ("Add to the list"). */
    nestedCommit?: string;
}


const pickerButton = {
    type: 'button',
    textAlign: 'start',
    borderWidth: '1px',
    borderColor: 'app.border',
    borderRadius: '12px',
    p: '12px',
    cursor: 'pointer',
    _hover: {borderColor: 'hg.link'},
} as const;

const PickerItem = ({testId, title, text, onClick}: {testId: string; title: string; text: string; onClick: () => void}) => (
    <chakra.button {...pickerButton} onClick={onClick} data-testid={testId}>
        <chakra.span display="block" fontWeight="600">{title}</chakra.span>
        <chakra.span display="block" fontSize="13px" color="fg.muted">{text}</chakra.span>
    </chakra.button>
);

/** A nomination that went stale: shown so its absence is explained, but it cannot be picked. */
const StaleItem = ({stale, nominee}: {stale: StaleNomination; nominee: string}) => (
    <chakra.button {...pickerButton} disabled aria-disabled="true" cursor="not-allowed" opacity={0.55} _hover={{}} data-testid={`stale-nomination-${stale.dao.id}`}>
        <Flex as="span" gap="8px" align="center" wrap="wrap">
            <chakra.span fontWeight="600">{`Accept: become the admin of ${stale.dao.name}`}</chakra.span>
            <chakra.span fontSize="12px" fontWeight="600" px="8px" py="1px" borderRadius="999px" borderWidth="1px" borderColor="app.border" color="fg.muted" data-testid="stale-pill">Stale</chakra.span>
        </Flex>
        <chakra.span display="block" fontSize="13px" color="fg.muted" data-testid="stale-nomination-text">{staleNominationText(stale, nominee)}</chakra.span>
    </chakra.button>
);

/** The picker items of one entry: one per nominating DAO for an accept, one per SubDAO for the SubDAO actions (grouped by the caller). */
const EntryItems = ({entry, ctx, onAdd}: {entry: ActionEntry; ctx: ActionContext; onAdd: (type: string, preset?: ActionFields) => void}) => {
    if (entry.id === ACCEPT_ID && ctx.incoming) {
        return (
            <>
                {ctx.incoming.map((n) => (
                    <PickerItem key={n.id} testId={`add-${ACCEPT_ID}-${n.id}`} title={`Accept: become the admin of ${n.name}`} text={`${n.name} nominated ${ctx.dao.name}.`} onClick={() => onAdd(ACCEPT_ID, {daoId: n.id})} />
                ))}
            </>
        );
    }
    return <PickerItem testId={`add-${entry.id}`} title={entry.label} text={entry.description} onClick={() => onAdd(entry.id)} />;
};

/** One row per SubDAO: "Manage <name> (SubDAO)", with the SubDAO actions on offer for it. */
const SubDaoItems = ({entries, ctx, onAdd}: {entries: ActionEntry[]; ctx: ActionContext; onAdd: (type: string, preset?: ActionFields) => void}) => {
    const admin = entries.some((e) => e.id === SUB_ADMIN_ID);
    const execute = entries.some((e) => e.id === SUB_EXECUTE_ID);
    return (
        <>
            {(ctx.subDaos ?? []).map((sub) => (
                <Flex key={sub.dao.id} direction="column" gap="8px" borderWidth="1px" borderColor="app.border" borderRadius="12px" p="12px" data-testid={`manage-sub-dao-${sub.dao.id}`}>
                    <chakra.span display="block" fontWeight="600">{`Manage ${sub.dao.name} (SubDAO)`}</chakra.span>
                    <chakra.span display="block" fontSize="13px" color="fg.muted">Hand over, or run actions as it.</chakra.span>
                    <Flex gap="16px" wrap="wrap">
                        {admin && <chakra.button type="button" color="hg.link" fontWeight="600" fontSize="14px" cursor="pointer" onClick={() => onAdd(SUB_ADMIN_ID, {daoId: sub.dao.id})} data-testid={`add-${SUB_ADMIN_ID}-${sub.dao.id}`}>Change its admin</chakra.button>}
                        {execute && <chakra.button type="button" color="hg.link" fontWeight="600" fontSize="14px" cursor="pointer" onClick={() => onAdd(SUB_EXECUTE_ID, {daoId: sub.dao.id, inner: ''})} data-testid={`add-${SUB_EXECUTE_ID}-${sub.dao.id}`}>Run actions as it</chakra.button>}
                    </Flex>
                </Flex>
            ))}
        </>
    );
};

const iconButton = {
    display: 'inline-flex',
    alignItems: 'center',
    p: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'fg.muted',
    _hover: {color: 'hg.link'},
    _disabled: {opacity: 0.35, cursor: 'default'},
} as const;

const newKey = (): string => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const ActionRow = ({index, count, draft, composed, ctx, formatCoin, onChange, onMove, onRemove}: {
    index: number;
    count: number;
    draft: ActionDraft;
    composed: ComposedAction | undefined;
    ctx: ActionContext;
    formatCoin: (coin: DaoCoin) => string;
    onChange: (draft: ActionDraft) => void;
    onMove: (by: -1 | 1) => void;
    onRemove: () => void;
}) => {
    const entry = findAction(draft.type);
    const Form = ACTION_FORMS[draft.type];
    if (!entry || !Form) return null;

    // an untouched form is not an error yet
    const dirty = JSON.stringify(draft.fields) !== JSON.stringify(entry.initialFields(ctx));
    const read = composed?.msg ? tryDescribe(composed.msg, ctx.dao, formatCoin, ctx.subDaos) : null;

    return (
        <chakra.li listStyleType="none" borderWidth="1px" borderColor="app.border" borderRadius="14px" p="14px" data-testid="action-row">
            <Flex direction="column" gap="12px">
                <Flex justify="space-between" align="center" gap="8px">
                    <chakra.span fontWeight="700" fontSize="15px">{`${index + 1}. ${entry.label}`}</chakra.span>
                    <Flex gap="2px">
                        <chakra.button type="button" {...iconButton} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move action ${index + 1} up`}><LuArrowUp size={16} aria-hidden /></chakra.button>
                        <chakra.button type="button" {...iconButton} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move action ${index + 1} down`}><LuArrowDown size={16} aria-hidden /></chakra.button>
                        <chakra.button type="button" {...iconButton} onClick={onRemove} aria-label={`Remove action ${index + 1}`} data-testid="action-remove"><LuTrash2 size={16} aria-hidden /></chakra.button>
                    </Flex>
                </Flex>
                <Form
                    fields={draft.fields}
                    onChange={(fields) => onChange({...draft, fields})}
                    ctx={ctx}
                    error={dirty ? composed?.error : undefined}
                    renderActions={(nested) => (
                        <ActionsList drafts={nested.drafts} ctx={nested.ctx} maxActions={Number(nested.ctx.params.max_msgs_per_proposal)} formatCoin={formatCoin} onChange={nested.onChange} nested />
                    )}
                />
                {composed?.warnings.map((w) => <chakra.p key={w} m="0" fontSize="13px" color="orange.500" data-testid="action-warning">{w}</chakra.p>)}
                {read && (
                    <Flex direction="column" gap="6px" p="12px" bg="hg.inset" borderRadius="10px" data-testid="action-preview">
                        <chakra.span fontSize="12px" color="hg.text.faint">What the DAO would do</chakra.span>
                        {read.ok
                            ? <Described action={read.action} formatCoin={formatCoin} nameOf={(a) => (a === ctx.dao.address ? 'The DAO' : undefined)} signerOf={(id) => ctx.subDaos?.find((s) => s.dao.id === id)?.dao.address} daoOf={(id) => (id === ctx.dao.id ? ctx.dao : ctx.subDaos?.find((s) => s.dao.id === id)?.dao)} />
                            : <chakra.p m="0" fontSize="13px" color="red.500" role="alert">{`This message could not be read back: ${read.error}`}</chakra.p>}
                    </Flex>
                )}
            </Flex>
        </chakra.li>
    );
};

/** The ordered list of actions: add from the registry, edit, move, remove. */
export const ActionsList = (props: Props) => (props.staged ? <StagedList {...props} /> : <InlineList {...props} />);

/** Every action's form open in the list (the admin console's). */
const InlineList = ({drafts, composed: given, ctx, maxActions, formatCoin, onChange, nested = false, wording, staleNominations = []}: Props) => {
    const [picking, setPicking] = useState(false);
    const entries = availableActions(ctx.dao, ctx);
    const composed = given ?? drafts.map((draft) => composeAction(draft, ctx, findAction));
    const full = drafts.length >= maxActions;

    const add = (type: string, preset: ActionFields = {}) => {
        const entry = findAction(type);
        if (!entry) return;
        onChange([...drafts, {key: nested ? innerKey(1 + Math.max(-1, ...drafts.map((d) => Number(d.key.replace('inner', '')) || 0))) : newKey(), type, fields: {...entry.initialFields(ctx), ...preset}}]);
        setPicking(false);
    };
    // the SubDAO actions are offered per SubDAO when the list is known; unreadable, the entries stay generic (their form says so)
    const perSub = ctx.subDaos !== null && ctx.subDaos.length > 0;
    const groups = PICKER_GROUPS.map((group, i) => {
        const inGroup = entries.filter((e) => groupOf(e.id) === i);
        const subs = perSub ? inGroup.filter((e) => SUB_IDS.includes(e.id)) : [];
        const plain = inGroup.filter((e) => !subs.includes(e));
        const stale = group.ids.includes(ACCEPT_ID) ? staleNominations : [];
        const nominations = stale.length > 0 || plain.some((e) => e.id === ACCEPT_ID);
        return {title: group.title, plain, subs, stale, nominations};
    }).filter((g) => g.plain.length + g.subs.length + g.stale.length > 0);
    const move = (index: number, by: -1 | 1) => {
        const next = [...drafts];
        [next[index], next[index + by]] = [next[index + by], next[index]];
        onChange(next);
    };

    const body = (
        <>
            <chakra.p m="0" fontSize="14px" color="fg.muted">
                {wording?.intro ?? (nested
                    ? `What ${ctx.dao.name} does, in this order, all or nothing.`
                    : "What the DAO does if the proposal passes, in this order, all or nothing. Leave the list empty for a text-only proposal that just records the DAO's decision.")}
            </chakra.p>
            {drafts.length === 0 && <chakra.p m="0" fontSize="14px" data-testid={nested ? 'no-inner-actions' : 'no-actions'}>{wording?.empty ?? (nested ? 'No actions yet.' : 'No actions: this is a text-only proposal.')}</chakra.p>}
            {drafts.length > 0 && (
                <chakra.ol m="0" p="0" display="flex" flexDirection="column" gap="12px">
                    {drafts.map((draft, i) => (
                        <ActionRow
                            key={draft.key}
                            index={i}
                            count={drafts.length}
                            draft={draft}
                            composed={composed.find((c) => c.key === draft.key)}
                            ctx={ctx}
                            formatCoin={formatCoin}
                            onChange={(d) => onChange(drafts.map((x) => (x.key === d.key ? d : x)))}
                            onMove={(by) => move(i, by)}
                            onRemove={() => onChange(drafts.filter((x) => x.key !== draft.key))}
                        />
                    ))}
                </chakra.ol>
            )}
            {full && <chakra.p m="0" fontSize="13px" color="fg.muted">{wording?.full?.(maxActions) ?? `A proposal can run at most ${maxActions} actions.`}</chakra.p>}
            {!full && !picking && (
                <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setPicking(true)} data-testid="add-action">
                    + Add an action
                </chakra.button>
            )}
            {!full && picking && (
                <Flex direction="column" gap="14px" data-testid="action-picker">
                    {groups.map((group) => (
                        <Flex key={group.title} direction="column" gap="8px" data-testid={pickerTestId(group.title)}>
                            <chakra.span fontSize="12px" fontWeight="700" textTransform="uppercase" letterSpacing="0.04em" color="hg.text.faint">{group.title}</chakra.span>
                            {group.nominations && (
                                <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="picker-stale-note">{STALE_NOTE}</chakra.p>
                            )}
                            {group.plain.map((entry) => <EntryItems key={entry.id} entry={entry} ctx={ctx} onAdd={add} />)}
                            {group.stale.map((stale) => <StaleItem key={stale.dao.id} stale={stale} nominee={ctx.dao.name} />)}
                            {group.subs.length > 0 && <SubDaoItems entries={group.subs} ctx={ctx} onAdd={add} />}
                        </Flex>
                    ))}
                    <chakra.button type="button" alignSelf="flex-start" color="fg.muted" fontSize="14px" cursor="pointer" onClick={() => setPicking(false)}>Cancel</chakra.button>
                </Flex>
            )}
        </>
    );

    return nested
        ? <Flex direction="column" gap="12px" ps="12px" borderStartWidth="2px" borderColor="app.border" data-testid="nested-actions">{body}</Flex>
        : <Panel id="actions" title={wording?.title ?? 'Actions'} testId="actions-editor">{body}</Panel>;
};
