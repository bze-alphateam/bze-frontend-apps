'use client';

import {Flex, SimpleGrid, chakra} from '@chakra-ui/react';
import {Notice} from '../hive-glow/status';
import {
    DAO_RULE_PRESETS,
    DaoRulePresetId,
    DaoRulesDraft,
    freeProposalsWarning,
    presetRules,
    rulesSentence,
    rulesToConfig,
} from '../../utils/dao/create';
import type {DaoParams} from '../../types/dao';
import {Choice, Field, Select, TextInput} from './dao-form-parts';

export interface DaoRulesFormProps {
    presetId: DaoRulePresetId;
    rules: DaoRulesDraft;
    onChange: (presetId: DaoRulePresetId, rules: DaoRulesDraft) => void;
    params: DaoParams;
    /** "members" for a member list, "voting power" for stakers. */
    voters: string;
    /** The tokens a proposal cost or deposit can be paid in (the first is the default). */
    denoms: string[];
    /** The token a Token community deposit is paid in (the staking token). */
    depositDenom?: string;
    tickerOf: (denom: string) => string;
    decimalsOf: (denom: string) => number;
    nativeDenom: string;
    /** The first problem of the rules, when there is one. */
    error?: string;
}

/**
 * The rules of a DAO: four presets and the advanced form of every config field. Reused by the
 * Create-DAO flow and by the DAO app's change-the-rules action. It only edits a draft; the
 * chain's rules are checked by `rulesToConfig` (`validateDaoConfig`).
 */
export const DaoRulesForm = ({presetId, rules, onChange, params, voters, denoms, depositDenom, tickerOf, decimalsOf, nativeDenom, error}: DaoRulesFormProps) => {
    const set = (patch: Partial<DaoRulesDraft>) => onChange('custom', {...rules, ...patch});
    const parsed = rulesToConfig(rules, {params, decimalsOf, nativeDenom});
    const config = 'config' in parsed ? parsed.config : undefined;
    const warning = config ? freeProposalsWarning(config, params.max_open_proposals) : null;
    const denomSelect = (value: string, onValue: (v: string) => void, label: string) => (
        <Select aria-label={label} value={value || denoms[0]} onChange={(e) => onValue(e.target.value)}>
            {denoms.map(d => <option key={d} value={d}>{tickerOf(d)}</option>)}
        </Select>
    );

    return (
        <Flex direction="column" gap="16px" data-testid="rules-form">
            <Flex direction="column" gap="10px" role="radiogroup" aria-label="Rules preset">
                {DAO_RULE_PRESETS.map(p => (
                    <Choice
                        key={p.id}
                        type="radio"
                        name="dao-rules-preset"
                        testId={`preset-${p.id}`}
                        checked={presetId === p.id}
                        onChange={() => onChange(p.id, p.id === 'custom' ? rules : presetRules(p.id, depositDenom))}
                        title={p.name}
                        badge={p.forWhom}
                    >
                        {p.summary}
                    </Choice>
                ))}
            </Flex>

            {config && (
                <chakra.p m="0" fontSize="15px" lineHeight="1.55" data-testid="rules-sentence">{rulesSentence(config, voters)}</chakra.p>
            )}

            <chakra.details borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.md" p="14px 16px" open={presetId === 'custom' || undefined}>
                <chakra.summary cursor="pointer" fontWeight="600" fontSize="14px">Every setting</chakra.summary>
                <Flex direction="column" gap="16px" mt="14px">
                    <SimpleGrid columns={{base: 1, md: 3}} gap="14px">
                        <Field label="Quorum (% of all voting power)" hint={`Share of all ${voters} that must vote.`}>
                            <TextInput inputMode="decimal" value={rules.quorumPct} onChange={(e) => set({quorumPct: e.target.value})}/>
                        </Field>
                        <Field label="Pass threshold (% of yes + no)" hint="Yes must be MORE than this share.">
                            <TextInput inputMode="decimal" value={rules.thresholdPct} onChange={(e) => set({thresholdPct: e.target.value})}/>
                        </Field>
                        <Field label="Voting period (days)" hint="Between 1 hour and 90 days (chain setting).">
                            <TextInput inputMode="decimal" value={rules.votingDays} onChange={(e) => set({votingDays: e.target.value})}/>
                        </Field>
                    </SimpleGrid>
                    <Choice type="checkbox" checked={rules.allowExpedite} onChange={(v) => set({allowExpedite: v})} title="Allow expedited proposals">
                        A proposer can ask for a shorter vote that settles as soon as enough of ALL voters agree.
                    </Choice>
                    <SimpleGrid columns={{base: 1, md: 3}} gap="14px">
                        <Field label="Expedited period (days)" hint="At most the voting period.">
                            <TextInput inputMode="decimal" value={rules.expeditedDays} onChange={(e) => set({expeditedDays: e.target.value})}/>
                        </Field>
                        <Field label="Expedite quorum (% of all)" hint="At least the quorum.">
                            <TextInput inputMode="decimal" value={rules.expediteQuorumPct} onChange={(e) => set({expediteQuorumPct: e.target.value})}/>
                        </Field>
                        <Field label="Expedite yes (% of all)" hint="Yes must be more than this share of ALL voting power; at least the threshold.">
                            <TextInput inputMode="decimal" value={rules.expediteThresholdPct} onChange={(e) => set({expediteThresholdPct: e.target.value})}/>
                        </Field>
                    </SimpleGrid>
                    <Choice type="checkbox" checked={rules.openSubmission} onChange={(v) => set({openSubmission: v})} title="Anyone can submit proposals">
                        Off: only {voters === 'members' ? 'members' : 'stakers'} can propose. On: any address can, which also lets people ask to join.
                    </Choice>
                    <SimpleGrid columns={{base: 1, md: 2}} gap="14px">
                        <Field label="Proposal cost" hint="Paid on submit, never refunded.">
                            <Flex gap="8px">
                                <TextInput flex="1" inputMode="decimal" aria-label="Proposal cost amount" value={rules.costAmount} onChange={(e) => set({costAmount: e.target.value})}/>
                                {denomSelect(rules.costDenom, (v) => set({costDenom: v}), 'Proposal cost token')}
                            </Flex>
                        </Field>
                        <Field label="Cost goes to">
                            <Select value={rules.costDestination} onChange={(e) => set({costDestination: e.target.value as DaoRulesDraft['costDestination']})}>
                                <option value="BURN">Burned</option>
                                <option value="TREASURY">The DAO's treasury</option>
                            </Select>
                        </Field>
                        <Field label="Proposal deposit" hint="Held while voting.">
                            <Flex gap="8px">
                                <TextInput flex="1" inputMode="decimal" aria-label="Proposal deposit amount" value={rules.depositAmount} onChange={(e) => set({depositAmount: e.target.value})}/>
                                {denomSelect(rules.depositDenom, (v) => set({depositDenom: v}), 'Proposal deposit token')}
                            </Flex>
                        </Field>
                        <Field label="Deposit back">
                            <Select value={rules.refundPolicy} onChange={(e) => set({refundPolicy: e.target.value as DaoRulesDraft['refundPolicy']})}>
                                <option value="ALWAYS">Always</option>
                                <option value="ONLY_PASSED">Only if it passes</option>
                                <option value="NEVER">Never</option>
                            </Select>
                        </Field>
                        <Field label="Kept deposits go to">
                            <Select value={rules.keptDepositDestination} onChange={(e) => set({keptDepositDestination: e.target.value as DaoRulesDraft['keptDepositDestination']})}>
                                <option value="BURN">Burned</option>
                                <option value="TREASURY">The DAO's treasury</option>
                            </Select>
                        </Field>
                    </SimpleGrid>
                </Flex>
            </chakra.details>

            {error && <Notice status="danger" title="Check the rules">{error}</Notice>}
            {warning && <Notice status="warning" title="Free proposals">{warning}</Notice>}
        </Flex>
    );
};
