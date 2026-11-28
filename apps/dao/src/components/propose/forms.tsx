'use client';

import type {ReactNode} from 'react';
import {chakra, Field, Flex, Input, NativeSelect, Textarea} from '@chakra-ui/react';
import {
    DaoRulesForm, DaoSourcePicker, daoSourceRows, rulesFromConfig, summarizeDaoElectorate, toggleDaoSource,
    type DaoRulePresetId, type DaoRulesDraft, type DaoStakeSource,
} from '@bze/bze-ui-kit';
import {electorateOf, electorateToFields} from '@/lib/actions/electorate';
import {rulesFromFields, rulesToFields} from '@/lib/actions/rules';
import {innerFromField, SUB_ADMIN_MODES, subContext, type SubAdminMode} from '@/lib/actions/sub-dao';
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
}

export const inputProps = {h: '44px', borderRadius: '12px', fontSize: '16px', bg: 'bg.panel'} as const;

const Problem = ({error}: {error?: string}) =>
    error ? <chakra.p m="0" fontSize="13px" color="red.500" role="alert" data-testid="action-error">{error}</chakra.p> : null;

const Note = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid={testId}>{children}</chakra.p>
);

const label = {fontSize: '14px', fontWeight: '600'} as const;

/** A DAO in a list is named, never numbered. */
const daoLabel = (d: {id: string; name: string}): string => d.name;

export const MetadataForm = ({fields, onChange, error}: ActionFormProps) => (
    <Flex direction="column" gap="12px">
        <Field.Root>
            <Field.Label {...label}>Name</Field.Label>
            <Input {...inputProps} value={fields.name ?? ''} onChange={(e) => onChange({...fields, name: e.target.value})} data-testid="meta-name" />
            <Field.HelperText>1 to 64 bytes.</Field.HelperText>
        </Field.Root>
        <Field.Root>
            <Field.Label {...label}>Description</Field.Label>
            <Textarea rows={4} bg="bg.panel" borderRadius="12px" value={fields.description ?? ''} onChange={(e) => onChange({...fields, description: e.target.value})} data-testid="meta-description" />
            <Field.HelperText>Up to 2,000 bytes. Leave it empty to clear the description.</Field.HelperText>
        </Field.Root>
        <Problem error={error} />
    </Flex>
);

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
            <Note testId="rules-note">
                This replaces all of the DAO&apos;s voting rules at once: the form starts from today&apos;s rules and what changes is listed below. Proposals that are open now keep the rules they started with; only later proposals use the new ones.
            </Note>
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
            <Problem error={error} />
        </Flex>
    );
};

export const MembersForm = ({fields, onChange, ctx, error}: ActionFormProps) => (
    <Flex direction="column" gap="12px">
        <Note>
            {`${ctx.dao.members.length} of at most ${ctx.params.max_static_members} members today. One address per line (commas and spaces also separate).`}
        </Note>
        <Field.Root>
            <Field.Label {...label}>Add members</Field.Label>
            <Textarea rows={3} bg="bg.panel" borderRadius="12px" fontFamily="mono" fontSize="13px" placeholder="bze1…" spellCheck={false} autoCapitalize="none"
                      value={fields.add ?? ''} onChange={(e) => onChange({...fields, add: e.target.value})} data-testid="members-add" />
            <Field.HelperText>They vote only on proposals submitted after the block they are added in.</Field.HelperText>
        </Field.Root>
        <Field.Root>
            <Field.Label {...label}>Remove members</Field.Label>
            <Textarea rows={3} bg="bg.panel" borderRadius="12px" fontFamily="mono" fontSize="13px" placeholder="bze1…" spellCheck={false} autoCapitalize="none"
                      value={fields.remove ?? ''} onChange={(e) => onChange({...fields, remove: e.target.value})} data-testid="members-remove" />
            <Field.HelperText>Their votes on proposals still in voting drop to 0 at once and they cannot vote on those again.</Field.HelperText>
        </Field.Root>
        <Problem error={error} />
    </Flex>
);

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
                This replaces all the sources the DAO votes with. A source that is added needs an unstaking lock of at least {ctx.params.min_electorate_lock_days} days; the sources it has today stay valid.
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
            <Problem error={error} />
        </Flex>
    );
};

export const NominateForm = ({fields, onChange, error}: ActionFormProps) => (
    <Flex direction="column" gap="12px">
        <Note>
            Nominate a person or another DAO. The DAO stays in the hands of its voters until the nominee accepts. An external admin can run any message as the DAO, including spending the treasury.
        </Note>
        <Field.Root>
            <Field.Label {...label}>New admin</Field.Label>
            <Input {...inputProps} fontFamily="mono" fontSize="14px" placeholder="bze1…" autoCapitalize="none" spellCheck={false}
                   value={fields.nominee ?? ''} onChange={(e) => onChange({...fields, nominee: e.target.value})} data-testid="nominee" />
        </Field.Root>
        <Problem error={error} />
    </Flex>
);

export const WithdrawForm = ({ctx, error}: ActionFormProps) => (
    <Flex direction="column" gap="8px">
        <Note>{`This cancels the pending nomination of ${ctx.dao.pending_admin || 'the nominee'}. The DAO stays self-owned and can nominate again.`}</Note>
        <Problem error={error} />
    </Flex>
);

export const AcceptForm = ({fields, onChange, ctx, error}: ActionFormProps) => (
    <Flex direction="column" gap="12px">
        <Note>
            Choose the DAO that nominated this DAO. This DAO then administers it and can run any message as it. A nomination goes stale when control of a DAO above it changes after it was made.
        </Note>
        <Field.Root>
            <Field.Label {...label}>DAO that nominated this DAO</Field.Label>
            <NativeSelect.Root>
                <NativeSelect.Field value={fields.daoId ?? ''} onChange={(e) => onChange({...fields, daoId: e.target.value})} data-testid="accept-dao" aria-label="DAO that nominated this DAO">
                    {(ctx.incoming ?? []).map((d) => <option key={d.id} value={d.id}>{daoLabel(d)}</option>)}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
            </NativeSelect.Root>
        </Field.Root>
        <Problem error={error} />
    </Flex>
);

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

export const SubAdminForm = ({fields, onChange, ctx, error}: ActionFormProps) => {
    if (ctx.subDaos === null) return <Note>The SubDAOs could not be read right now. Reload the page to try again.</Note>;
    return (
        <Flex direction="column" gap="12px">
            <SubDaoSelect fields={fields} ctx={ctx} testId="sub-admin-dao" onPick={(daoId) => onChange({...fields, daoId})} />
            <Field.Root>
                <Field.Label {...label}>What to do</Field.Label>
                <NativeSelect.Root>
                    <NativeSelect.Field value={fields.mode ?? 'nominate'} onChange={(e) => onChange({...fields, mode: e.target.value})} data-testid="sub-admin-mode" aria-label="What to do with the admin">
                        {SUB_ADMIN_MODES.map((m) => <option key={m} value={m}>{MODE_TEXT[m]}</option>)}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                </NativeSelect.Root>
            </Field.Root>
            {(fields.mode ?? 'nominate') === 'nominate' && (
                <Field.Root>
                    <Field.Label {...label}>New admin</Field.Label>
                    <Input {...inputProps} fontFamily="mono" fontSize="14px" placeholder="bze1…" autoCapitalize="none" spellCheck={false}
                           value={fields.nominee ?? ''} onChange={(e) => onChange({...fields, nominee: e.target.value})} data-testid="sub-admin-nominee" />
                </Field.Root>
            )}
            <Problem error={error} />
        </Flex>
    );
};

export const SubExecuteForm = ({fields, onChange, ctx, error, renderActions}: ActionFormProps) => {
    if (ctx.subDaos === null) return <Note>The SubDAOs could not be read right now. Reload the page to try again.</Note>;
    const sub = ctx.subDaos.find((s) => s.dao.id === fields.daoId);
    return (
        <Flex direction="column" gap="12px">
            <Note>
                The DAO you pick signs these actions and this DAO runs them as its admin. Authz grants, fee allowances and authz exec are refused on this path.
            </Note>
            {/* the actions depend on the sub-DAO (its treasury, its members), so a new pick starts the list again */}
            <SubDaoSelect fields={fields} ctx={ctx} testId="sub-execute-dao" onPick={(daoId) => onChange({...fields, daoId, inner: ''})} />
            {sub && renderActions({
                drafts: innerDrafts(fields.inner ?? ''),
                ctx: subContext(ctx, sub),
                onChange: (drafts) => onChange({...fields, inner: JSON.stringify(drafts.map(({type, fields: f}) => ({type, fields: f})))}),
            })}
            <Problem error={error} />
        </Flex>
    );
};


/** The stored inner actions as rows; unreadable text shows as an empty list (the entry's check reports it). */
const innerDrafts = (text: string): ActionDraft[] => {
    const drafts = innerFromField(text);
    return typeof drafts === 'string' ? [] : drafts;
};
