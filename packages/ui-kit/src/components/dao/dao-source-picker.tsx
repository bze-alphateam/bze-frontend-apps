'use client';

import {Flex, chakra} from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import {Notice} from '../hive-glow/status';
import {prettyAmount, uAmountToBigNumberAmount} from '../../utils/amount';
import {DaoSourceRow, DaoStakeSource, daoSourceKey, DaoElectorateSummary} from '../../utils/dao/create-sources';
import type {DaoParams} from '../../types/dao';
import {Choice, ChoiceNote} from './dao-form-parts';

export interface DaoSourcePickerProps {
    rows: DaoSourceRow[];
    summary: DaoElectorateSummary;
    params: Pick<DaoParams, 'max_sr_per_dao' | 'min_electorate_lock_days'>;
    onToggle: (source: DaoStakeSource, on: boolean) => void;
    tickerOf: (denom: string) => string;
    decimalsOf: (denom: string) => number;
    /** The token is fixed by the host: the "once you pick one" line is replaced. */
    locked?: boolean;
    error?: string;
}

const staked = (amount: string, denom: string, decimalsOf: (d: string) => number, tickerOf: (d: string) => string): string =>
    `${prettyAmount(uAmountToBigNumberAmount(new BigNumber(amount || 0), decimalsOf(denom)))} ${tickerOf(denom)} staked`;

/**
 * The staking rewards and Denom Reward a stake DAO can vote with, one card each: staked total,
 * lock, and the reason a source is greyed out. Reused by the Create-DAO flow and by the DAO
 * app's change-the-voters action; the rules behind it are `daoSourceRows`.
 */
export const DaoSourcePicker = ({rows, summary, params, onToggle, tickerOf, decimalsOf, locked, error}: DaoSourcePickerProps) => (
    <Flex direction="column" gap="14px" data-testid="source-picker">
        <chakra.p m="0" fontSize="14px" color="fg.muted" lineHeight="1.55">
            Pick up to {params.max_sr_per_dao} Simple rewards and/or the token's Compounded reward. Voting power = what someone stakes in the ones you pick.
        </chakra.p>
        <chakra.span fontSize="13px" color="fg.muted">
            {summary.stakingDenom
                ? <>Staking <strong>{tickerOf(summary.stakingDenom)}</strong>{locked ? ': fixed for this DAO.' : '. Once you pick one, only rewards that stake it can be added.'}</>
                : 'Once you pick one, only rewards that stake the same token can be added.'}
        </chakra.span>
        <Flex direction="column" gap="8px">
            {rows.length === 0 && <Notice status="info">There is no reward to vote with yet. With an admin you can create the DAO now and set the voters up later.</Notice>}
            {rows.map(row => (
                <Choice
                    key={daoSourceKey(row)}
                    type="checkbox"
                    testId={`source-${daoSourceKey(row).replace(/\//g, '-')}`}
                    checked={row.selected}
                    disabled={!!row.disabledReason && !row.selected}
                    onChange={(on) => onToggle(row, on)}
                    title={row.kind === 'dr' ? 'Compounded reward' : `Simple reward #${Number(row.id) || row.id}`}
                    badge={staked(row.staked, row.stakingDenom, decimalsOf, tickerOf)}
                >
                    {tickerOf(row.stakingDenom)} · {row.lock}-day unstaking lock
                    {row.disabledReason && <><br/><ChoiceNote tone="warning">{row.disabledReason}</ChoiceNote></>}
                </Choice>
            ))}
        </Flex>
        <Flex direction="column" gap="4px" p="14px 16px" borderRadius="hg.md" bg="app.subtle" borderWidth="1px" borderColor="app.border" data-testid="source-summary">
            {summary.count === 0
                ? <chakra.span fontSize="15px">No reward picked yet.</chakra.span>
                : <chakra.span fontSize="15px">
                    Voted by people staking <strong>{summary.stakingDenom ? tickerOf(summary.stakingDenom) : ''}</strong> in {summary.count} reward{summary.count === 1 ? '' : 's'}:{' '}
                    <strong>{prettyAmount(uAmountToBigNumberAmount(summary.staked, summary.stakingDenom ? decimalsOf(summary.stakingDenom) : 6))}</strong> of voting power today.
                </chakra.span>}
            <chakra.span fontSize="12px" color="fg.muted">
                Minimum unstaking lock {params.min_electorate_lock_days} days (chain setting). A reward a DAO votes with can't be deleted while the DAO uses it.
            </chakra.span>
        </Flex>
        {error && <Notice status="danger">{error}</Notice>}
    </Flex>
);
