import BigNumber from "bignumber.js";
import {EncodeObject} from "@bze/bzejs/types";
import {
    DaoConfig,
    DaoCoin,
    DaoDepositRefundPolicy,
    DaoFundsDestination,
    DaoParams,
    DaoStakeElectorate,
    DaoType,
} from "../../types/dao";
import {prettyAmount, uAmountToBigNumberAmount} from "../amount";
import {
    buildCreateDaoMsg,
    durationSeconds,
    durationString,
    percentFromRatio,
    ratioFromPercent,
    secondsFromDaysHours,
} from "./msgs";
import {
    DaoStakeSource,
    electorateStakingDenom,
    summarizeDaoElectorate,
    validateDaoSources,
} from "./create-sources";
import {
    canonicalAddress,
    validateDaoConfig,
    validateDaoDescription,
    validateDaoElectorate,
    validateDaoMembers,
    validateDaoName,
} from "./validate";

// The model of the Create-DAO flow: the draft a user fills in, the rules presets, the
// per-step validation and the MsgCreateDao built from it. Everything here is pure; the
// component only draws it and the hook only signs it.

export type CreateDaoStep = 'type' | 'name' | 'voters' | 'admin' | 'rules' | 'review';
export const CREATE_DAO_STEPS: CreateDaoStep[] = ['type', 'name', 'voters', 'admin', 'rules', 'review'];

export type DaoAdminChoice = 'voters' | 'me' | 'other';
export type DaoRulePresetId = 'small-council' | 'simple-majority' | 'token-community' | 'custom';

/** The rules form: every field as the user types it (percentages, days, display-unit amounts). */
export interface DaoRulesDraft {
    quorumPct: string;
    thresholdPct: string;
    votingDays: string;
    allowExpedite: boolean;
    expeditedDays: string;
    expediteQuorumPct: string;
    expediteThresholdPct: string;
    openSubmission: boolean;
    costAmount: string;
    costDenom: string;
    depositAmount: string;
    depositDenom: string;
    refundPolicy: DaoDepositRefundPolicy;
    costDestination: DaoFundsDestination;
    keptDepositDestination: DaoFundsDestination;
}

export interface CreateDaoDraft {
    type: DaoType;
    name: string;
    description: string;
    /** Static list: one address per line (commas and spaces also separate). */
    membersText: string;
    /** Stake: the picked sources. */
    electorate: DaoStakeElectorate;
    adminChoice: DaoAdminChoice;
    adminAddress: string;
    presetId: DaoRulePresetId;
    rules: DaoRulesDraft;
}

/** What a host (the Factory) can fill in beforehand. */
export interface CreateDaoPreset {
    type?: DaoType;
    name?: string;
    description?: string;
    members?: string[];
    electorate?: DaoStakeElectorate;
    /** The token the stakers stake; fixes the picker when `locked.stakingDenom` is set. */
    stakingDenom?: string;
    /** `''` (or unset): the voters decide. Otherwise the admin address. */
    admin?: string;
    config?: DaoConfig;
}

/** What a host fixes: the type step and/or the staking token. */
export interface CreateDaoLocked {
    /** The type of the preset cannot be changed: the Type step is skipped. */
    type?: boolean;
    /** The staking token the voters must stake; only its rewards can be picked. */
    stakingDenom?: string;
}

export interface CreateDaoContext {
    creator: string;
    params: DaoParams;
    /** Loaded stake sources (only needed for stake DAOs). */
    sources: DaoStakeSource[];
    /** The staking token a host fixed. */
    lockedStakingDenom?: string;
    nativeDenom: string;
    decimalsOf: (denom: string) => number;
    tickerOf: (denom: string) => string;
}

// ---------------------------------------------------------------------------
// Presets (design canvas, board H6)

const BASE_RULES: DaoRulesDraft = {
    quorumPct: '40',
    thresholdPct: '50',
    votingDays: '7',
    allowExpedite: false,
    expeditedDays: '1',
    expediteQuorumPct: '40',
    expediteThresholdPct: '50',
    openSubmission: false,
    costAmount: '',
    costDenom: '',
    depositAmount: '',
    depositDenom: '',
    refundPolicy: 'ALWAYS',
    costDestination: 'BURN',
    keptDepositDestination: 'TREASURY',
};

export const DAO_RULE_PRESETS: {id: DaoRulePresetId; name: string; forWhom: string; summary: string}[] = [
    {
        id: 'small-council',
        name: 'Small council',
        forWhom: 'Member lists of 3–15 people who act fast.',
        summary: '3-day vote · 50 % quorum · more than half of yes+no · expedite: more than half of ALL members settles it at once',
    },
    {
        id: 'simple-majority',
        name: 'Simple majority',
        forWhom: 'Any DAO. Calm, predictable.',
        summary: '7-day vote · 40 % quorum · more than half of yes+no · no expedite',
    },
    {
        id: 'token-community',
        name: 'Token community',
        forWhom: 'Stakers DAOs with many voters.',
        summary: '7-day vote · 33.4 % quorum · more than half · expedite after 24 h with 66.7 % of all stake voting yes · 1,000-token deposit, kept if rejected',
    },
    {
        id: 'custom',
        name: 'Custom',
        forWhom: 'Set every field yourself.',
        summary: 'Start from Simple majority and change any field.',
    },
];

const TOKEN_COMMUNITY_DEPOSIT = '1000';

/** The rules of a preset. `depositDenom` is the token a Token community deposit is paid in. */
export const presetRules = (id: DaoRulePresetId, depositDenom?: string): DaoRulesDraft => {
    switch (id) {
        case 'small-council':
            return {...BASE_RULES, quorumPct: '50', thresholdPct: '50', votingDays: '3', allowExpedite: true, expeditedDays: '1', expediteQuorumPct: '50', expediteThresholdPct: '50'};
        case 'token-community':
            return {
                ...BASE_RULES,
                quorumPct: '33.4',
                thresholdPct: '50',
                votingDays: '7',
                allowExpedite: true,
                expeditedDays: '1',
                expediteQuorumPct: '66.7',
                expediteThresholdPct: '66.7',
                depositAmount: depositDenom ? TOKEN_COMMUNITY_DEPOSIT : '',
                depositDenom: depositDenom ?? '',
                refundPolicy: 'ONLY_PASSED',
                keptDepositDestination: 'TREASURY',
            };
        case 'simple-majority':
        case 'custom':
        default:
            return {...BASE_RULES};
    }
}

// ---------------------------------------------------------------------------
// Addresses and members

export const validateDaoAdminAddress = (address: string): string | undefined =>
    canonicalAddress(address.trim()) ? undefined : 'Enter a valid BZE address.';

/** The addresses of a pasted list or CSV: separated by lines, commas, semicolons or spaces. */
export const parseMemberTokens = (text: string): string[] => text.split(/[\s,;]+/).filter(t => t !== '');

export interface MemberRow {
    line: number;
    address: string;
    error?: string;
}

/** One row per entry with its own error: not an address, or already listed above. */
export const memberRows = (text: string): MemberRow[] => {
    const seen = new Map<string, number>();
    return parseMemberTokens(text).map((address, i) => {
        const line = i + 1;
        const key = canonicalAddress(address);
        if (!key) return {line, address, error: 'Not a BZE address'};
        const first = seen.get(key);
        if (first !== undefined) return {line, address, error: `Already in the list (line ${first})`};
        seen.set(key, line);
        return {line, address};
    });
}

/** The valid, distinct members of the text, lowercase, in order. */
export const validMembers = (text: string): string[] =>
    memberRows(text).filter(r => !r.error).map(r => r.address.toLowerCase());

// ---------------------------------------------------------------------------
// Rules <-> config

const NUMBER = /^\d+(\.\d+)?$/;

const toMicro = (label: string, amount: string, decimals: number): string | undefined | Error => {
    const trimmed = amount.trim();
    if (trimmed === '') return undefined;
    if (!NUMBER.test(trimmed)) return new Error(`${label} must be a number.`);
    const value = new BigNumber(trimmed);
    if ((value.decimalPlaces() ?? 0) > decimals) return new Error(`${label} can have at most ${decimals} decimals.`);
    const micro = value.shiftedBy(decimals);
    return micro.isZero() ? undefined : micro.toFixed(0);
}

const percent = (label: string, value: string): string | Error => {
    if (!NUMBER.test(value.trim())) return new Error(`${label} must be a percentage.`);
    return ratioFromPercent(value.trim());
}

/** The config a rules form describes, or the first reason it cannot be one. */
export const rulesToConfig = (
    rules: DaoRulesDraft,
    ctx: Pick<CreateDaoContext, 'params' | 'decimalsOf' | 'nativeDenom'>,
): {config: DaoConfig} | {error: string} => {
    const fields = [
        percent('The quorum', rules.quorumPct),
        percent('The threshold', rules.thresholdPct),
        percent('The expedite quorum', rules.expediteQuorumPct),
        percent('The expedite threshold', rules.expediteThresholdPct),
    ];
    for (const f of fields) if (f instanceof Error) return {error: f.message};
    const [min_quorum, threshold, expedite_quorum, expedite_threshold] = fields as string[];

    for (const [label, days] of [['The voting period', rules.votingDays], ['The expedited period', rules.expeditedDays]] as const) {
        if (!NUMBER.test(days.trim())) return {error: `${label} must be a number of days.`};
    }

    const coin = (label: string, amount: string, denom: string): DaoCoin | null | Error => {
        const d = denom || ctx.nativeDenom;
        const micro = toMicro(label, amount, ctx.decimalsOf(d));
        if (micro instanceof Error) return micro;
        return micro === undefined ? null : {denom: d, amount: micro};
    }
    const cost = coin('The proposal cost', rules.costAmount, rules.costDenom);
    if (cost instanceof Error) return {error: cost.message};
    const deposit = coin('The proposal deposit', rules.depositAmount, rules.depositDenom);
    if (deposit instanceof Error) return {error: deposit.message};

    const config: DaoConfig = {
        min_quorum,
        threshold,
        voting_period: durationString(secondsFromDaysHours({days: Number(rules.votingDays)})),
        allow_expedite: rules.allowExpedite,
        expedited_period: durationString(secondsFromDaysHours({days: Number(rules.expeditedDays)})),
        expedite_quorum,
        expedite_threshold,
        open_submission: rules.openSubmission,
        proposal_cost: cost,
        proposal_deposit: deposit,
        deposit_refund_policy: rules.refundPolicy,
        cost_destination: rules.costDestination,
        kept_deposit_destination: rules.keptDepositDestination,
    };
    const error = validateDaoConfig(config, ctx.params);
    return error ? {error} : {config};
}

const trimNumber = (n: number): string => new BigNumber(n).decimalPlaces(8).toFixed();

/** The rules form of an existing config (a preset a host brings). */
export const rulesFromConfig = (config: DaoConfig, decimalsOf: (denom: string) => number): DaoRulesDraft => {
    const amount = (c?: DaoCoin | null) => (c ? uAmountToBigNumberAmount(c.amount, decimalsOf(c.denom)).toFixed() : '');
    return {
        quorumPct: trimNumber(percentFromRatio(config.min_quorum)),
        thresholdPct: trimNumber(percentFromRatio(config.threshold)),
        votingDays: trimNumber(durationSeconds(config.voting_period) / 86_400),
        allowExpedite: config.allow_expedite,
        expeditedDays: trimNumber(durationSeconds(config.expedited_period) / 86_400),
        expediteQuorumPct: trimNumber(percentFromRatio(config.expedite_quorum)),
        expediteThresholdPct: trimNumber(percentFromRatio(config.expedite_threshold)),
        openSubmission: config.open_submission,
        costAmount: amount(config.proposal_cost),
        costDenom: config.proposal_cost?.denom ?? '',
        depositAmount: amount(config.proposal_deposit),
        depositDenom: config.proposal_deposit?.denom ?? '',
        refundPolicy: config.deposit_refund_policy,
        costDestination: config.cost_destination,
        keptDepositDestination: config.kept_deposit_destination,
    };
}

const isSet = (c?: DaoCoin | null): boolean => !!c && /[1-9]/.test(c.amount);

/**
 * The chain doc's warning: with no cost and no deposit (or a deposit that is always refunded)
 * a proposal is free, so anyone who may submit can keep every open-proposal slot busy.
 */
export const freeProposalsWarning = (config: DaoConfig, maxOpen?: string): string | null => {
    const free = !isSet(config.proposal_cost) && (!isSet(config.proposal_deposit) || config.deposit_refund_policy === 'ALWAYS');
    if (!free) return null;
    const slots = maxOpen ? `all ${maxOpen} open-proposal slots` : 'every open-proposal slot';
    return `Proposals are free here, so anyone allowed to submit can keep ${slots} busy. Fine for a council you trust; for open DAOs add a cost or a deposit that isn't always refunded. A self-owned DAO can only fix this by a proposal.`;
}

// ---------------------------------------------------------------------------
// The draft

export const initialDraft = (input: {creator: string; preset?: CreateDaoPreset; locked?: CreateDaoLocked; ctx?: Pick<CreateDaoContext, 'decimalsOf' | 'nativeDenom'>}): CreateDaoDraft => {
    const {creator, preset} = input;
    const depositDenom = input.locked?.stakingDenom ?? preset?.stakingDenom;
    const decimalsOf = input.ctx?.decimalsOf ?? (() => 6);
    const type = preset?.type ?? 'DAO_TYPE_STATIC_LIST';
    const admin = preset?.admin ?? '';
    const adminChoice: DaoAdminChoice = admin === '' ? 'voters' : admin.toLowerCase() === creator.toLowerCase() ? 'me' : 'other';
    const hasConfig = !!preset?.config;
    return {
        type,
        name: preset?.name ?? '',
        description: preset?.description ?? '',
        membersText: (preset?.members ?? (creator ? [creator] : [])).join('\n'),
        electorate: preset?.electorate ? {sr_ids: [...preset.electorate.sr_ids], dr_denom: preset.electorate.dr_denom} : {sr_ids: [], dr_denom: ''},
        adminChoice,
        adminAddress: adminChoice === 'other' ? admin : '',
        presetId: hasConfig ? 'custom' : type === 'DAO_TYPE_STAKE' ? 'token-community' : 'simple-majority',
        rules: hasConfig
            ? rulesFromConfig(preset!.config!, decimalsOf)
            : presetRules(type === 'DAO_TYPE_STAKE' ? 'token-community' : 'simple-majority', type === 'DAO_TYPE_STAKE' ? depositDenom : undefined),
    };
}

/**
 * A draft restored from storage with what the host gave laid over it: every field the preset
 * fills in, and a locked type or staking token, beats whatever was saved. The rest of the saved
 * draft is kept.
 */
export const restoreDraft = (
    saved: CreateDaoDraft | undefined,
    base: CreateDaoDraft,
    locked?: CreateDaoLocked,
    preset?: CreateDaoPreset,
): CreateDaoDraft => {
    if (!saved) return base;
    const win: Partial<CreateDaoDraft> = {};
    if (preset?.type !== undefined || locked?.type) win.type = base.type;
    if (preset?.name !== undefined) win.name = base.name;
    if (preset?.description !== undefined) win.description = base.description;
    if (preset?.members !== undefined) win.membersText = base.membersText;
    if (preset?.electorate !== undefined || locked?.stakingDenom) win.electorate = base.electorate;
    if (preset?.admin !== undefined) { win.adminChoice = base.adminChoice; win.adminAddress = base.adminAddress; }
    if (preset?.config !== undefined) { win.presetId = base.presetId; win.rules = base.rules; }
    return {...base, ...saved, ...win};
}

/**
 * The Token community preset pays its deposit in the staking token, which a DAO app only knows
 * once the voters are picked. Once it is known (and again if the voters change token), an
 * unedited Token community preset gets its deposit; any edit turns the preset into Custom and
 * is left alone.
 */
export const withPresetDeposit = (draft: CreateDaoDraft, stakingDenom: string | undefined): CreateDaoDraft => {
    if (draft.type !== 'DAO_TYPE_STAKE' || draft.presetId !== 'token-community' || !stakingDenom) return draft;
    if (draft.rules.depositDenom === stakingDenom && draft.rules.depositAmount !== '') return draft;
    const {depositAmount, depositDenom} = presetRules('token-community', stakingDenom);
    return {...draft, rules: {...draft.rules, depositAmount, depositDenom}};
}

// ---------------------------------------------------------------------------
// Validation

/** The staking token the rules' deposit and cost options revolve around (stake DAOs). */
export const stakingDenomOf = (draft: CreateDaoDraft, ctx: Pick<CreateDaoContext, 'sources' | 'lockedStakingDenom'>): string | undefined =>
    draft.type === 'DAO_TYPE_STAKE' ? electorateStakingDenom(draft.electorate, ctx.sources, ctx.lockedStakingDenom) : undefined;

/**
 * Self-owned (no admin) DAOs must be able to vote at creation (chain: "a self-owned dao needs
 * a live electorate"). Returns the reason it cannot, or undefined.
 */
export const liveElectorateError = (draft: CreateDaoDraft, ctx: Pick<CreateDaoContext, 'sources' | 'lockedStakingDenom'>): string | undefined => {
    if (draft.adminChoice !== 'voters') return undefined;
    if (draft.type === 'DAO_TYPE_STATIC_LIST') {
        return validMembers(draft.membersText).length > 0 ? undefined : 'With nobody as admin the DAO needs at least one member who can vote.';
    }
    return summarizeDaoElectorate(draft.electorate, ctx.sources, ctx.lockedStakingDenom).live
        ? undefined
        : 'With nobody as admin the voters must be able to vote from day one: pick a reward that has something staked, or choose an admin who sets it up later.';
}

export const validateCreateDaoStep = (step: CreateDaoStep, draft: CreateDaoDraft, ctx: CreateDaoContext): string | undefined => {
    switch (step) {
        case 'type':
            return undefined;
        case 'name':
            return validateDaoName(draft.name) ?? validateDaoDescription(draft.description);
        case 'voters': {
            if (draft.type === 'DAO_TYPE_STATIC_LIST') {
                const rows = memberRows(draft.membersText);
                const bad = rows.find(r => r.error);
                if (bad) return `Line ${bad.line}: ${bad.error}.`;
                return validateDaoMembers(rows.map(r => r.address), ctx.params);
            }
            return validateDaoElectorate(draft.electorate, ctx.params)
                ?? validateDaoSources({sources: ctx.sources, electorate: draft.electorate, params: ctx.params, lockedDenom: ctx.lockedStakingDenom, tickerOf: ctx.tickerOf});
        }
        case 'admin':
            if (draft.adminChoice === 'other') {
                const bad = validateDaoAdminAddress(draft.adminAddress);
                if (bad) return bad;
            }
            return liveElectorateError(draft, ctx);
        case 'rules': {
            const r = rulesToConfig(draft.rules, ctx);
            return 'error' in r ? r.error : undefined;
        }
        case 'review':
            return CREATE_DAO_STEPS.slice(0, -1).map(s => validateCreateDaoStep(s, draft, ctx)).find(Boolean);
    }
}

/** The first step whose input is not valid, or undefined. */
export const firstInvalidStep = (draft: CreateDaoDraft, ctx: CreateDaoContext): CreateDaoStep | undefined =>
    CREATE_DAO_STEPS.slice(0, -1).find(s => validateCreateDaoStep(s, draft, ctx) !== undefined);

/** The signed address of the admin field: empty when the DAO governs itself. */
export const adminOf = (draft: CreateDaoDraft, creator: string): string =>
    draft.adminChoice === 'voters' ? '' : draft.adminChoice === 'me' ? creator : draft.adminAddress.trim();

/** The MsgCreateDao of a valid draft, or the first problem. */
export const buildCreateDaoFromDraft = (draft: CreateDaoDraft, ctx: CreateDaoContext): {msg: EncodeObject} | {error: string} => {
    const error = validateCreateDaoStep('review', draft, ctx);
    if (error) return {error};
    const rules = rulesToConfig(draft.rules, ctx);
    if ('error' in rules) return {error: rules.error};
    const stake = draft.type === 'DAO_TYPE_STAKE';
    return {
        msg: buildCreateDaoMsg({
            creator: ctx.creator,
            admin: adminOf(draft, ctx.creator),
            type: draft.type,
            name: draft.name,
            description: draft.description,
            config: rules.config,
            members: stake ? [] : validMembers(draft.membersText),
            electorate: stake ? {sr_ids: [...draft.electorate.sr_ids], dr_denom: draft.electorate.dr_denom} : null,
        }),
    };
}

// ---------------------------------------------------------------------------
// Plain words for the review

export const daoFeeDestinationText = (destination: string): string =>
    destination === 'community_pool' ? 'goes to the community pool' : 'is burned';

/**
 * The creation fee in words: the amount, where it goes, and what it is paid in. The chain takes it
 * in the transaction fee token when that can be swapped to the fee denom (BZE), otherwise in BZE;
 * a factory token charging a transfer fee adds that on top.
 */
export const daoCreationFeeText = (input: {
    fee: DaoCoin;
    destination: string;
    txFeeDenom: string;
    decimalsOf: (denom: string) => number;
    tickerOf: (denom: string) => string;
}): {amount: string; destination: string; paidIn: string; transferFeeNote?: string} => {
    const {fee, txFeeDenom, decimalsOf, tickerOf} = input;
    const ticker = tickerOf(fee.denom);
    const amount = `${prettyAmount(uAmountToBigNumberAmount(fee.amount, decimalsOf(fee.denom)))} ${ticker}`;
    const same = txFeeDenom === fee.denom;
    return {
        amount,
        destination: daoFeeDestinationText(input.destination),
        paidIn: same
            ? ticker
            : `Your fee token (${tickerOf(txFeeDenom)}) if it can be swapped to ${ticker}, otherwise ${ticker}.`,
        transferFeeNote: !same && txFeeDenom.startsWith('factory/')
            ? `If ${tickerOf(txFeeDenom)} charges a transfer fee, it is added on top.`
            : undefined,
    };
}

/** The sentence under the rules form, rebuilt from the numbers. */
export const rulesSentence = (config: DaoConfig, voters: string): string => {
    const days = durationSeconds(config.voting_period) / 86_400;
    const period = days >= 1 ? `${trimNumber(days)} day${days === 1 ? '' : 's'}` : `${trimNumber(days * 24)} hours`;
    const q = trimNumber(percentFromRatio(config.min_quorum));
    const t = trimNumber(percentFromRatio(config.threshold));
    const base = `A proposal passes when at least ${q} % of all ${voters} vote and more than ${t} % of the yes and no votes are yes, after ${period}.`;
    if (!config.allow_expedite) return `${base} No expedited voting.`;
    return `${base} With expedite, more than ${trimNumber(percentFromRatio(config.expedite_threshold))} % of ALL ${voters} voting yes settles it right away.`;
}

/** What a proposal costs and what must be put down with it, in words, from the config that is signed. */
export const describeProposalMoney = (
    config: DaoConfig,
    fmt: {decimalsOf: (denom: string) => number; tickerOf: (denom: string) => string},
): {cost: string; deposit: string} => {
    const coin = (c: DaoCoin) => `${prettyAmount(uAmountToBigNumberAmount(c.amount, fmt.decimalsOf(c.denom)))} ${fmt.tickerOf(c.denom)}`;
    const dest = (d: DaoFundsDestination) => (d === 'BURN' ? 'burned' : "sent to the DAO's treasury");
    const refund: Record<DaoDepositRefundPolicy, string> = {
        ALWAYS: 'returned whatever the result',
        ONLY_PASSED: 'returned only when the proposal passes',
        NEVER: 'never returned',
    };
    return {
        cost: isSet(config.proposal_cost) ? `${coin(config.proposal_cost!)}, paid on submit and ${dest(config.cost_destination)}` : 'None',
        deposit: isSet(config.proposal_deposit)
            ? `${coin(config.proposal_deposit!)}, ${refund[config.deposit_refund_policy]}${config.deposit_refund_policy === 'ALWAYS' ? '' : `; a kept deposit is ${dest(config.kept_deposit_destination)}`}`
            : 'None',
    };
}
