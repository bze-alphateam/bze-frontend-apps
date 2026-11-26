import {
    buildUpdateDaoConfigMsg, rulesFromConfig, rulesToConfig, validateDaoConfig,
    type DaoConfig, type DaoDepositRefundPolicy, type DaoFundsDestination, type DaoRulePresetId, type DaoRulesDraft,
} from '@bze/bze-ui-kit';
import {tryDescribe} from '../propose/describe';
import type {ActionContext, ActionEntry, ActionFields} from './types';

export const RULES_ID = 'update-rules';

const PRESETS: readonly DaoRulePresetId[] = ['small-council', 'simple-majority', 'token-community', 'custom'];
const POLICIES: readonly DaoDepositRefundPolicy[] = ['ALWAYS', 'ONLY_PASSED', 'NEVER'];
const DESTINATIONS: readonly DaoFundsDestination[] = ['BURN', 'TREASURY'];

const TEXT_KEYS = [
    'quorumPct', 'thresholdPct', 'votingDays', 'expeditedDays', 'expediteQuorumPct', 'expediteThresholdPct',
    'costAmount', 'costDenom', 'depositAmount', 'depositDenom',
] as const;
const BOOLEAN_KEYS = ['allowExpedite', 'openSubmission'] as const;

const decimalsFor = (ctx: Pick<ActionContext, 'decimalsOf'>) => (denom: string): number => ctx.decimalsOf(denom) ?? 0;

/** The rules form as the text fields an action draft stores (booleans as "true" / "false"). */
export const rulesToFields = (presetId: DaoRulePresetId, rules: DaoRulesDraft): ActionFields => ({
    preset: presetId,
    quorumPct: rules.quorumPct,
    thresholdPct: rules.thresholdPct,
    votingDays: rules.votingDays,
    allowExpedite: String(rules.allowExpedite),
    expeditedDays: rules.expeditedDays,
    expediteQuorumPct: rules.expediteQuorumPct,
    expediteThresholdPct: rules.expediteThresholdPct,
    openSubmission: String(rules.openSubmission),
    costAmount: rules.costAmount,
    costDenom: rules.costDenom,
    depositAmount: rules.depositAmount,
    depositDenom: rules.depositDenom,
    refundPolicy: rules.refundPolicy,
    costDestination: rules.costDestination,
    keptDepositDestination: rules.keptDepositDestination,
});

/**
 * The rules form behind stored text fields. A draft comes back from storage, so every field is checked
 * (present, text, and for the switches and choices one of their values) and anything else is a sentence,
 * never a crash or a silently defaulted value.
 */
export function rulesFromFields(fields: ActionFields): {ok: true; presetId: DaoRulePresetId; rules: DaoRulesDraft} | {ok: false; error: string} {
    const broken = {ok: false as const, error: 'The saved rules are incomplete. Remove this action and add it again.'};
    const preset = fields.preset as DaoRulePresetId;
    if (!PRESETS.includes(preset)) return broken;
    for (const key of TEXT_KEYS) if (typeof fields[key] !== 'string') return broken;
    for (const key of BOOLEAN_KEYS) if (fields[key] !== 'true' && fields[key] !== 'false') return broken;
    if (!POLICIES.includes(fields.refundPolicy as DaoDepositRefundPolicy)) return broken;
    for (const key of ['costDestination', 'keptDepositDestination'] as const) {
        if (!DESTINATIONS.includes(fields[key] as DaoFundsDestination)) return broken;
    }
    return {
        ok: true,
        presetId: preset,
        rules: {
            quorumPct: fields.quorumPct, thresholdPct: fields.thresholdPct, votingDays: fields.votingDays,
            allowExpedite: fields.allowExpedite === 'true', expeditedDays: fields.expeditedDays,
            expediteQuorumPct: fields.expediteQuorumPct, expediteThresholdPct: fields.expediteThresholdPct,
            openSubmission: fields.openSubmission === 'true',
            costAmount: fields.costAmount, costDenom: fields.costDenom, depositAmount: fields.depositAmount, depositDenom: fields.depositDenom,
            refundPolicy: fields.refundPolicy as DaoDepositRefundPolicy,
            costDestination: fields.costDestination as DaoFundsDestination,
            keptDepositDestination: fields.keptDepositDestination as DaoFundsDestination,
        },
    };
}

/** The config field each group of form fields writes. */
const GROUPS: {config: keyof DaoConfig; fields: (keyof DaoRulesDraft)[]}[] = [
    {config: 'min_quorum', fields: ['quorumPct']},
    {config: 'threshold', fields: ['thresholdPct']},
    {config: 'voting_period', fields: ['votingDays']},
    {config: 'allow_expedite', fields: ['allowExpedite']},
    {config: 'expedited_period', fields: ['expeditedDays']},
    {config: 'expedite_quorum', fields: ['expediteQuorumPct']},
    {config: 'expedite_threshold', fields: ['expediteThresholdPct']},
    {config: 'open_submission', fields: ['openSubmission']},
    {config: 'proposal_cost', fields: ['costAmount', 'costDenom']},
    {config: 'proposal_deposit', fields: ['depositAmount', 'depositDenom']},
    {config: 'deposit_refund_policy', fields: ['refundPolicy']},
    {config: 'cost_destination', fields: ['costDestination']},
    {config: 'kept_deposit_destination', fields: ['keptDepositDestination']},
];

export type RulesConfig = {config: DaoConfig} | {error: string};

/**
 * The whole config the form describes. A form shows rounded values (percentages to 8 decimals, periods in
 * days), so a setting nobody touched is sent exactly as the DAO has it today: opening the form and sending
 * it changes nothing it did not show a change for. The result passes the creation rules against the current
 * params' period bounds.
 */
export function rulesConfig(fields: ActionFields, ctx: ActionContext): RulesConfig {
    const read = rulesFromFields(fields);
    if (!read.ok) return {error: read.error};

    const typed = rulesToConfig(read.rules, {params: ctx.params, decimalsOf: decimalsFor(ctx), nativeDenom: ctx.nativeDenom});
    if ('error' in typed) return typed;

    const shown = rulesFromConfig(ctx.dao.config, decimalsFor(ctx));
    const config: DaoConfig = {...typed.config};
    for (const group of GROUPS) {
        if (group.fields.every((key) => read.rules[key] === shown[key])) {
            (config as unknown as Record<string, unknown>)[group.config] = ctx.dao.config[group.config];
        }
    }
    const error = validateDaoConfig(config, ctx.params);
    return error ? {error} : {config};
}

const SAME = "These are the same rules the DAO has today: change at least one setting.";

/** Change the DAO's voting rules: the whole config is replaced (the chain has no partial update). */
export const rulesEntry: ActionEntry = {
    id: RULES_ID,
    label: 'Change the voting rules',
    description: 'Quorum, threshold, voting period, expedite, who may submit, cost and deposit.',
    available: () => true,
    initialFields: (ctx) => rulesToFields('custom', rulesFromConfig(ctx.dao.config, decimalsFor(ctx))),
    validate(fields, ctx) {
        const result = rulesConfig(fields, ctx);
        if ('error' in result) return result.error;
        const read = tryDescribe(buildUpdateDaoConfigMsg({daoAddress: ctx.dao.address, daoId: ctx.dao.id, config: result.config}), ctx.dao, (c) => c.amount);
        return read.ok && read.action.type === 'update_config' && read.action.unchanged ? SAME : undefined;
    },
    warnings(fields, ctx) {
        const result = rulesConfig(fields, ctx);
        if ('error' in result) return [];
        return ['Proposals that are open now keep the rules they started with; only proposals submitted once this has run use the new rules.'];
    },
    build(fields, ctx) {
        const result = rulesConfig(fields, ctx);
        if ('error' in result) throw new Error(result.error);
        return buildUpdateDaoConfigMsg({daoAddress: ctx.dao.address, daoId: ctx.dao.id, config: result.config});
    },
};
