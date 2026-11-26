'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuArrowDown, LuArrowUp, LuTrash2} from 'react-icons/lu';
import type {DaoCoin} from '@bze/bze-ui-kit';
import {composeAction, type ComposedAction} from '@/lib/actions/compose-action';
import {availableActions, findAction} from '@/lib/actions/registry';
import {innerKey} from '@/lib/actions/sub-dao';
import type {ActionContext, ActionDraft} from '@/lib/actions/types';
import {tryDescribe} from '@/lib/propose/describe';
import {Described} from '@/components/proposal/actions-panel';
import {Panel} from '@/components/dao/page/panel';
import {ACTION_FORMS} from './action-forms';

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
}

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
                            ? <Described action={read.action} formatCoin={formatCoin} nameOf={(a) => (a === ctx.dao.address ? 'The DAO' : undefined)} signerOf={(id) => ctx.subDaos?.find((s) => s.dao.id === id)?.dao.address} />
                            : <chakra.p m="0" fontSize="13px" color="red.500" role="alert">{`This message could not be read back: ${read.error}`}</chakra.p>}
                    </Flex>
                )}
            </Flex>
        </chakra.li>
    );
};

/** The ordered list of actions: add from the registry, edit, move, remove. */
export const ActionsList = ({drafts, composed: given, ctx, maxActions, formatCoin, onChange, nested = false}: Props) => {
    const [picking, setPicking] = useState(false);
    const entries = availableActions(ctx.dao, ctx);
    const composed = given ?? drafts.map((draft) => composeAction(draft, ctx, findAction));
    const full = drafts.length >= maxActions;

    const add = (type: string) => {
        const entry = findAction(type);
        if (!entry) return;
        onChange([...drafts, {key: nested ? innerKey(drafts.length) : newKey(), type, fields: entry.initialFields(ctx)}]);
        setPicking(false);
    };
    const move = (index: number, by: -1 | 1) => {
        const next = [...drafts];
        [next[index], next[index + by]] = [next[index + by], next[index]];
        onChange(next);
    };

    const body = (
        <>
            <chakra.p m="0" fontSize="14px" color="fg.muted">
                {nested
                    ? `What ${ctx.dao.name} does, in this order, all or nothing.`
                    : "What the DAO does if the proposal passes, in this order, all or nothing. Leave the list empty for a text-only proposal that just records the DAO's decision."}
            </chakra.p>
            {drafts.length === 0 && <chakra.p m="0" fontSize="14px" data-testid={nested ? 'no-inner-actions' : 'no-actions'}>{nested ? 'No actions yet.' : 'No actions: this is a text-only proposal.'}</chakra.p>}
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
            {full && <chakra.p m="0" fontSize="13px" color="fg.muted">{`A proposal can run at most ${maxActions} actions.`}</chakra.p>}
            {!full && !picking && (
                <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setPicking(true)} data-testid="add-action">
                    + Add an action
                </chakra.button>
            )}
            {!full && picking && (
                <Flex direction="column" gap="8px" data-testid="action-picker">
                    {entries.map((entry) => (
                        <chakra.button
                            key={entry.id}
                            type="button"
                            textAlign="start"
                            borderWidth="1px"
                            borderColor="app.border"
                            borderRadius="12px"
                            p="12px"
                            cursor="pointer"
                            _hover={{borderColor: 'hg.link'}}
                            onClick={() => add(entry.id)}
                            data-testid={`add-${entry.id}`}
                        >
                            <chakra.span display="block" fontWeight="600">{entry.label}</chakra.span>
                            <chakra.span display="block" fontSize="13px" color="fg.muted">{entry.description}</chakra.span>
                        </chakra.button>
                    ))}
                    <chakra.button type="button" alignSelf="flex-start" color="fg.muted" fontSize="14px" cursor="pointer" onClick={() => setPicking(false)}>Cancel</chakra.button>
                </Flex>
            )}
        </>
    );

    return nested
        ? <Flex direction="column" gap="12px" ps="12px" borderStartWidth="2px" borderColor="app.border" data-testid="nested-actions">{body}</Flex>
        : <Panel id="actions" title="Actions" testId="actions-editor">{body}</Panel>;
};
