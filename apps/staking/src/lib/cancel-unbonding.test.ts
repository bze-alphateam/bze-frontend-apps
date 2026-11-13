import {describe, it, expect} from 'vitest';
import type {UnbondingDelegationSDKType, ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {
    buildUnbondingEntries,
    cancelUnbondingValues,
    CANCEL_COMPLETION_MARGIN_MS,
    missingValidatorAddresses,
    splitCancellable,
    totalBalance,
} from './cancel-unbonding';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

// Shaped like the REST JSON: int64 and times arrive as strings whatever the SDK type says.
const entry = (height: string, completesInMs: number, balance: string) => ({
    creation_height: height,
    completion_time: new Date(NOW + completesInMs).toISOString(),
    initial_balance: balance,
    balance,
    unbonding_id: '1',
    unbonding_on_hold_ref_count: '0',
}) as unknown as UnbondingDelegationSDKType['entries'][number];

const ubd = (validator: string, entries: ReturnType<typeof entry>[]) => ({
    delegator_address: 'bze1delegator',
    validator_address: validator,
    entries,
}) as unknown as UnbondingDelegationSDKType;

const validator = (address: string, moniker: string, jailed = false) => ({
    operator_address: address,
    jailed,
    description: {moniker},
}) as unknown as ValidatorSDKType;

const build = (unbonding: UnbondingDelegationSDKType[], validators: ValidatorSDKType[]) =>
    buildUnbondingEntries({unbondingDelegations: unbonding, validators, now: NOW, fallbackName: a => `short:${a}`});

describe('buildUnbondingEntries', () => {
    it('makes one view per entry, sorted by completion time, with its creation height and balance', () => {
        const views = build(
            [
                ubd('valA', [entry('300', 20 * DAY, '5000000'), entry('100', 2 * DAY, '1000000')]),
                ubd('valB', [entry('200', 10 * DAY, '2000000')]),
            ],
            [validator('valA', 'Alpha'), validator('valB', 'Beta')],
        );

        expect(views.map(v => v.key)).toEqual(['valA-100', 'valB-200', 'valA-300']);
        expect(views[0]).toMatchObject({validatorAddress: 'valA', moniker: 'Alpha', creationHeight: '100', jailed: false, completed: false});
        expect(views[0].balance.toFixed()).toBe('1000000');
        expect(views.every(v => v.blockReason === undefined)).toBe(true);
    });

    it('blocks entries of a jailed validator', () => {
        const [view] = build([ubd('valJ', [entry('1', 10 * DAY, '10')])], [validator('valJ', 'Jailed', true)]);
        expect(view.jailed).toBe(true);
        expect(view.blockReason).toBe('jailed');
    });

    it('blocks entries that completed or complete within the safety margin', () => {
        const views = build(
            [ubd('valA', [
                entry('1', -DAY, '10'),
                entry('2', CANCEL_COMPLETION_MARGIN_MS - 1000, '10'),
                entry('3', CANCEL_COMPLETION_MARGIN_MS + 60_000, '10'),
            ])],
            [validator('valA', 'Alpha')],
        );
        expect(views.map(v => [v.creationHeight, v.completed, v.blockReason])).toEqual([
            ['1', true, 'completed'],
            ['2', false, 'completed'],
            ['3', false, undefined],
        ]);
    });

    it('blocks an empty entry', () => {
        const [view] = build([ubd('valA', [entry('1', 10 * DAY, '0')])], [validator('valA', 'Alpha')]);
        expect(view.blockReason).toBe('empty');
    });

    it('falls back to the given name and leaves the chain to judge an unknown validator', () => {
        const [view] = build([ubd('valX', [entry('1', 10 * DAY, '10')])], []);
        expect(view.moniker).toBe('short:valX');
        expect(view.blockReason).toBeUndefined();
    });
});

describe('splitCancellable / totalBalance', () => {
    it('keeps only the entries the chain accepts and counts the rest as skipped', () => {
        const views = build(
            [
                ubd('valA', [entry('1', 10 * DAY, '1000')]),
                ubd('valJ', [entry('2', 10 * DAY, '2000')]),
                ubd('valB', [entry('3', -DAY, '4000'), entry('4', 5 * DAY, '8000')]),
            ],
            [validator('valA', 'Alpha'), validator('valJ', 'Jailed', true), validator('valB', 'Beta')],
        );
        const {cancellable, skipped} = splitCancellable(views);

        expect(cancellable.map(v => v.key).sort()).toEqual(['valA-1', 'valB-4']);
        expect(skipped.map(v => v.key).sort()).toEqual(['valB-3', 'valJ-2']);
        expect(totalBalance(cancellable).toFixed()).toBe('9000');
    });
});

describe('cancelUnbondingValues', () => {
    it('builds one message value per entry with the full balance in the bond denom and a bigint height', () => {
        const views = build(
            [ubd('valA', [entry('25505480', 10 * DAY, '2384000000000')]), ubd('valB', [entry('7', 10 * DAY, '15')])],
            [validator('valA', 'Alpha'), validator('valB', 'Beta')],
        );
        expect(cancelUnbondingValues('bze1me', 'ubze', views)).toEqual([
            {delegatorAddress: 'bze1me', validatorAddress: 'valA', amount: {denom: 'ubze', amount: '2384000000000'}, creationHeight: BigInt(25505480)},
            {delegatorAddress: 'bze1me', validatorAddress: 'valB', amount: {denom: 'ubze', amount: '15'}, creationHeight: BigInt(7)},
        ]);
    });

    it('sends one message per entry for many validators in one tx', () => {
        const unbonding = Array.from({length: 11}, (_, i) => ubd(`val${i}`, [entry(String(100 + i), 21 * DAY, '1000000')]));
        const views = build(unbonding, unbonding.map(u => validator(u.validator_address, u.validator_address)));
        expect(cancelUnbondingValues('bze1me', 'ubze', views)).toHaveLength(11);
    });
});

describe('missingValidatorAddresses', () => {
    it('lists each unbonding validator missing from the known list once', () => {
        expect(missingValidatorAddresses(
            [ubd('valA', []), ubd('valJ', []), ubd('valJ', [])],
            [validator('valA', 'Alpha')],
        )).toEqual(['valJ']);
    });
});
