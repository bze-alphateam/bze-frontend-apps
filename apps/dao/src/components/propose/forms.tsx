'use client';

import type {ReactNode} from 'react';
import {chakra, Field, Flex, Input, NativeSelect, Textarea} from '@chakra-ui/react';
import {
    DAO_MAX_NAME_BYTES, Notice, utf8Length, DaoRulesForm, DaoSourcePicker, daoSourceRows, rulesFromConfig, summarizeDaoElectorate, toggleDaoSource,
    type DaoRulePresetId, type DaoRulesDraft, type DaoStakeSource,
} from '@bze/bze-ui-kit';
import {electorateOf, electorateToFields} from '@/lib/actions/electorate';
import {rulesFromFields, rulesToFields} from '@/lib/actions/rules';
import {memberLists} from '@/lib/actions/members';
import {innerFromField, SUB_ADMIN_MODES, subContext, type SubAdminMode} from '@/lib/actions/sub-dao';
import {bytesLine} from '@/lib/propose/composer-text';
import {NeutralNote} from './neutral-note';
import type {ActionContext, ActionDraft, ActionFields} from '@/lib/actions/types';

/** What every action form gets: the fields typed so far, how to change them, and the DAO. */
export interface ActionFormProps {
    fields: ActionFields;
    onChange: (fields: ActionFields) => void;
    ctx: ActionContext;
    /** The first problem of these fields, shown only once the user has typed something. */
    error?: string;
    /** Draws an editable list of actions for a context (the sub-DAO's): the composer's own list, injected so a form needs no import of it. */
    renderActions: (props: {drafts: ActionDraft[]; ctx: ActionContext; onChange: (drafts: ActionDraft[]) => void}) => ReactNode;
    /**
     * The composer's form card (`ActionsList` with `staged`): the card's header and its segmented control already
     * say which SubDAO and what to do, so the forms leave those pickers out.
     */
    staged?: boolean;
}

/** The boards' field: 48 px, 12 px radius, inset fill, 15 px text. */
export const inputProps = {h: '48px', px: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: '500', bg: 'hg.inset', borderColor: 'hg.lineStrong'} as const;
/** A textarea in the same field style. */
export const textareaProps = {px: '14px', py: '12px', borderRadius: '12px', fontSize: '15px', fontWeight: '500', lineHeight: '1.5', bg: 'hg.inset', borderColor: 'hg.lineStrong'} as const;
/** An address field: the mono face at 14 px. */
export const monoProps = {fontFamily: 'mono', fontSize: '14px', autoCapitalize: 'none', spellCheck: false} as const;

const Problem = ({error}: {error?: string}) =>
    error ? <chakra.p m="0" fontSize="13px" fontWeight="500" color="hg.danger.text" role="alert" data-testid="action-error">{error}</chakra.p> : null;

/** A paragraph of a form card (13 px, secondary text). */
const Note = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.p m="0" fontSize="13px" lineHeight="1.55" color="hg.text.secondary" data-testid={testId}>{children}</chakra.p>
);

/** The faint line under a form. */
const Faint = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid={testId}>{children}</chakra.span>
);

const helper = {fontSize: '12px', color: 'hg.text.faint'} as const;

const label = {fontSize: '14px', fontWeight: '600'} as const;

/** A DAO in a list is named, never numbered. */
const daoLabel = (d: {id: string; name: string}): string => d.name;

export const MetadataForm = ({fields, onChange, error}: ActionFormProps) => {
    const name = bytesLine(utf8Length(fields.name ?? ''), DAO_MAX_NAME_BYTES);
    return (
        <Flex direction="column" gap="16px">
            <Field.Root invalid={name.over}>
                <Field.Label {...label}>Name</Field.Label>
                <Input {...inputProps} value={fields.name ?? ''} onChange={(e) => onChange({...fields, name: e.target.value})} data-testid="meta-name" />
                <Field.HelperText {...helper} color={name.over ? 'hg.danger.text' : helper.color} data-testid="meta-name-count">{name.text}</Field.HelperText>
            </Field.Root>
            <Field.Root>
                <Field.Label {...label}>Description</Field.Label>
                <Textarea {...textareaProps} rows={2} value={fields.description ?? ''} onChange={(e) => onChange({...fields, description: e.target.value})} data-testid="meta-description" />
                <Field.HelperText {...helper}>Both are always sent; an empty description clears it.</Field.HelperText>
            </Field.Root>
            <Problem error={error} />
        </Flex>
    );
};

export const RulesForm = ({fields, onChange, ctx, error}: ActionFormProps) => {
    const read = rulesFromFields(fields);
    const stake = ctx.dao.type === 'DAO_TYPE_STAKE';
    const denoms = [...new Set([
        ctx.nativeDenom,
        ...[ctx.dao.config.proposal_cost, ctx.dao.config.proposal_deposit].flatMap((c) => (c ? [c.denom] : [])),
        ...(ctx.sources ?? []).filter((s) => ctx.dao.electorate && (ctx.dao.electorate.sr_ids.some((id) => s.kind === 'sr' && s.id === id) || (s.kind === 'dr' && s.id === ctx.dao.electorate.dr_denom))).map((s) => s.stakingDenom),
    ])];
    const decimalsOf = (denom: string) => ctx.decimalsOf(denom) ?? 0;

    return (
        <Flex direction="column" gap="12px">
            <Note testId="rules-note">Prefilled with today&apos;s rules; the same form as creation. The whole set is sent, and the action card lists only what changes.</Note>
            {read.ok ? (
                <DaoRulesForm
                    presetId={read.presetId}
                    rules={read.rules}
                    onChange={(presetId: DaoRulePresetId, rules: DaoRulesDraft) => onChange(rulesToFields(presetId, rules))}
                    params={ctx.params}
                    voters={stake ? 'voting power' : 'members'}
                    denoms={denoms}
                    depositDenom={denoms[1] ?? denoms[0]}
                    tickerOf={ctx.ticker}
                    decimalsOf={decimalsOf}
                    nativeDenom={ctx.nativeDenom}
                />
            ) : (
                <Flex gap="10px" align="center" wrap="wrap">
                    <Note>The saved rules could not be read.</Note>
                    <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => onChange(rulesToFields('custom', rulesFromConfig(ctx.dao.config, decimalsOf)))} data-testid="rules-reset">Start again</chakra.button>
                </Flex>
            )}
            <NeutralNote>Proposals already open keep the rules they started with. The new rules apply to proposals submitted after this one passes.</NeutralNote>
            <Problem error={error} />
        </Flex>
    );
};

export const MembersForm = ({fields, onChange, ctx, error}: ActionFormProps) => {
    const {add, remove} = memberLists(fields);
    const now = new Set(ctx.dao.members.map((m) => m.toLowerCase()));
    add.forEach((a) => now.add(a.toLowerCase()));
    remove.forEach((r) => now.delete(r.toLowerCase()));
    return (
        <Flex direction="column" gap="16px">
            <chakra.div display="grid" gridTemplateColumns={{base: '1fr', md: 'repeat(2, minmax(0, 1fr))'}} gap="12px">
                <Field.Root>
                    <Field.Label {...label}>Add</Field.Label>
                    <Textarea {...textareaProps} {...monoProps} rows={2} placeholder="bze1…" value={fields.add ?? ''} onChange={(e) => onChange({...fields, add: e.target.value})} data-testid="members-add" />
                </Field.Root>
                <Field.Root>
                    <Field.Label {...label}>Remove</Field.Label>
                    <Textarea {...textareaProps} {...monoProps} rows={2} placeholder="bze1…" value={fields.remove ?? ''} onChange={(e) => onChange({...fields, remove: e.target.value})} data-testid="members-remove" />
                </Field.Root>
            </chakra.div>
            <Faint testId="members-result">
                {`Result: ${now.size} member${now.size === 1 ? '' : 's'} (1 to ${ctx.params.max_static_members}). One address per line (commas and spaces also separate). Removed members' votes on proposals still in voting drop to 0 at once. Added members vote only on proposals submitted after they join.`}
            </Faint>
            <Problem error={error} />
        </Flex>
    );
};

/** The rows of the picker: a source the DAO already has is never greyed out for its lock (the chain checks added sources only). */
const pickerRows = (ctx: ActionContext, electorate: ReturnType<typeof electorateOf>) => {
    const sources = ctx.sources ?? [];
    const min = ctx.params.min_electorate_lock_days;
    const kept = new Set([...(ctx.dao.electorate?.sr_ids ?? []).map((id) => `sr/${id}`), ...(ctx.dao.electorate?.dr_denom ? [`dr/${ctx.dao.electorate.dr_denom}`] : [])]);
    const lenient = sources.map((s) => (kept.has(`${s.kind}/${s.id}`) ? {...s, lock: Math.max(s.lock, min)} : s));
    const lockOf = new Map(sources.map((s) => [`${s.kind}/${s.id}`, s.lock]));
    return daoSourceRows({sources: lenient, electorate, params: ctx.params, tickerOf: ctx.ticker})
        .map((row) => ({...row, lock: lockOf.get(`${row.kind}/${row.id}`) ?? row.lock}));
};

export const ElectorateForm = ({fields, onChange, ctx, error}: ActionFormProps) => {
    const electorate = electorateOf(fields);
    if (ctx.sources === null) {
        return <Note>The staking rewards could not be read right now, so the voters cannot be changed. Reload the page to try again.</Note>;
    }
    const decimalsOf = (denom: string) => ctx.decimalsOf(denom) ?? 0;
    return (
        <Flex direction="column" gap="12px">
            <Note>
                {`Pick the rewards again (the whole list is replaced): the same picker as creation. Added rewards need at least a ${ctx.params.min_electorate_lock_days}-day lock; rewards already in use stay valid.`}
            </Note>
            {ctx.sources.length === 0
                ? <Note testId="no-sources">There is no staking reward or Denom Reward to vote with.</Note>
                : <DaoSourcePicker
                    rows={pickerRows(ctx, electorate)}
                    summary={summarizeDaoElectorate(electorate, ctx.sources)}
                    params={ctx.params}
                    onToggle={(source: DaoStakeSource, on: boolean) => onChange({...fields, ...electorateToFields(toggleDaoSource(electorate, source, on))})}
                    tickerOf={ctx.ticker}
                    decimalsOf={decimalsOf}
                />}
            {ctx.dao.admin === ctx.dao.address && <Faint>A DAO that governs itself must keep someone able to vote: at least one reward with stake.</Faint>}
            <Problem error={error} />
        </Flex>
    );
};

export const NominateForm = ({fields, onChange, error}: ActionFormProps) => (
    <Flex direction="column" gap="16px">
        <Field.Root>
            <Field.Label {...label}>Nominate as admin</Field.Label>
            <Input {...inputProps} {...monoProps} placeholder="bze1…" value={fields.nominee ?? ''} onChange={(e) => onChange({...fields, nominee: e.target.value})} data-testid="nominee" />
            <Field.HelperText {...helper}>A person or another DAO, never this DAO itself. One nomination at a time.</Field.HelperText>
        </Field.Root>
        <Notice status="warning">
            If this passes and the nominee accepts, they become a superuser: they can run any message as the DAO, including spending the treasury. Until they accept, the DAO keeps governing itself; a later proposal can withdraw the nomination.
        </Notice>
        <Problem error={error} />
    </Flex>
);

export const WithdrawForm = ({ctx, error}: ActionFormProps) => (
    <Flex direction="column" gap="8px">
        <Note>{`This cancels the pending nomination of ${ctx.dao.pending_admin || 'the nominee'}. The DAO stays self-owned and can nominate again.`}</Note>
        <Problem error={error} />
    </Flex>
);

export const AcceptForm = ({fields, onChange, ctx, error, staged}: ActionFormProps) => {
    const incoming = ctx.incoming ?? [];
    const picked = incoming.find((d) => d.id === fields.daoId);
    return (
        <Flex direction="column" gap="16px">
            {/* the picker row already chose the DAO: the select is only for a list that did not */}
            {!(staged && picked) && (
                <Field.Root>
                    <Field.Label {...label}>DAO that nominated this DAO</Field.Label>
                    <NativeSelect.Root>
                        <NativeSelect.Field {...inputProps} value={fields.daoId ?? ''} onChange={(e) => onChange({...fields, daoId: e.target.value})} data-testid="accept-dao" aria-label="DAO that nominated this DAO">
                            {incoming.map((d) => <option key={d.id} value={d.id}>{daoLabel(d)}</option>)}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                </Field.Root>
            )}
            {picked && (
                <Note testId="accept-text">
                    {`${picked.name} nominated `}<strong>{ctx.dao.name}</strong>{` as its admin. If this passes, ${ctx.dao.name} runs ${picked.name} through its own proposals.`}
                </Note>
            )}
            <NeutralNote>
                {`If control of any DAO above ${picked?.name ?? 'the nominating DAO'} changes before this passes, the nomination goes stale and the chain refuses it (1135).`}
            </NeutralNote>
            <Problem error={error} />
        </Flex>
    );
};

const SubDaoSelect = ({fields, onPick, ctx, testId}: {fields: ActionFields; onPick: (id: string) => void; ctx: ActionContext; testId: string}) => (
    <Field.Root>
        <Field.Label {...label}>SubDAO</Field.Label>
        <NativeSelect.Root>
            <NativeSelect.Field value={fields.daoId ?? ''} onChange={(e) => onPick(e.target.value)} data-testid={testId} aria-label="SubDAO">
                {(ctx.subDaos ?? []).map((s) => <option key={s.dao.id} value={s.dao.id}>{daoLabel(s.dao)}</option>)}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
        </NativeSelect.Root>
    </Field.Root>
);

const MODE_TEXT: Record<SubAdminMode, string> = {
    nominate: 'Nominate a new admin',
    withdraw: 'Withdraw its pending nomination',
    voters: 'Hand it to its own voters',
};

export const SubAdminForm = ({fields, onChange, ctx, error, staged}: ActionFormProps) => {
    if (ctx.subDaos === null) return <Note>The SubDAOs could not be read right now. Reload the page to try again.</Note>;
    const mode = fields.mode ?? 'nominate';
    return (
        <Flex direction="column" gap="16px">
            {!staged && <SubDaoSelect fields={fields} ctx={ctx} testId="sub-admin-dao" onPick={(daoId) => onChange({...fields, daoId})} />}
            {!staged && <Field.Root>
                <Field.Label {...label}>What to do</Field.Label>
                <NativeSelect.Root>
                    <NativeSelect.Field value={fields.mode ?? 'nominate'} onChange={(e) => onChange({...fields, mode: e.target.value})} data-testid="sub-admin-mode" aria-label="What to do with the admin">
                        {SUB_ADMIN_MODES.map((m) => <option key={m} value={m}>{MODE_TEXT[m]}</option>)}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                </NativeSelect.Root>
            </Field.Root>}
            {mode === 'nominate' && (
                <Field.Root>
                    <Field.Label {...label}>New admin</Field.Label>
                    <Input {...inputProps} {...monoProps} placeholder="bze1…" value={fields.nominee ?? ''} onChange={(e) => onChange({...fields, nominee: e.target.value})} data-testid="sub-admin-nominee" />
                </Field.Root>
            )}
            {staged && mode === 'withdraw' && <Note>Its pending nomination is withdrawn; this DAO stays its admin.</Note>}
            {staged && mode === 'voters' && <Note>This DAO stops being its admin: from then on its own voters run it through their proposals.</Note>}
            <Problem error={error} />
        </Flex>
    );
};

export const SubExecuteForm = ({fields, onChange, ctx, error, renderActions, staged}: ActionFormProps) => {
    if (ctx.subDaos === null) return <Note>The SubDAOs could not be read right now. Reload the page to try again.</Note>;
    const sub = ctx.subDaos.find((s) => s.dao.id === fields.daoId);
    return (
        <Flex direction="column" gap="16px">
            {!staged && (
                <Note>
                    The DAO you pick signs these actions and this DAO runs them as its admin. Authz grants, fee allowances and authz exec are refused on this path.
                </Note>
            )}
            {/* the actions depend on the sub-DAO (its treasury, its members), so a new pick starts the list again */}
            {!staged && <SubDaoSelect fields={fields} ctx={ctx} testId="sub-execute-dao" onPick={(daoId) => onChange({...fields, daoId, inner: ''})} />}
            {sub && renderActions({
                drafts: innerDrafts(fields.inner ?? ''),
                ctx: subContext(ctx, sub),
                onChange: (drafts) => onChange({...fields, inner: JSON.stringify(drafts.map(({type, fields: f}) => ({type, fields: f})))}),
            })}
            {staged && sub && (
                <Faint>{`Sent as MsgAdminExecute from ${ctx.dao.name}. Actions come from the same list, signed by ${sub.dao.name}. Grants (authz, feegrant) are refused on this path, and DAOs can nest at most 5 levels.`}</Faint>
            )}
            <Problem error={error} />
        </Flex>
    );
};


/** The stored inner actions as rows; unreadable text shows as an empty list (the entry's check reports it). */
const innerDrafts = (text: string): ActionDraft[] => {
    const drafts = innerFromField(text);
    return typeof drafts === 'string' ? [] : drafts;
};
