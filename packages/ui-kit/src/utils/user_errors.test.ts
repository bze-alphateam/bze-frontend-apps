import { describe, expect, it } from 'vitest'
import { prettyError } from './user_errors'

// The chain's raw_log wraps the registered error message: "failed to execute message; message
// index: 0: <wrapped detail>: <registered message>".
describe('prettyError — Denom Rewards (x/rewards)', () => {
    it.each([
        ['failed to execute message; message index: 0: denom reward not found', /no denom reward yet/],
        ['failed to execute message; message index: 0: you are not a participant in this denom reward: denom reward not found', /no stake in this denom reward/],
        ['failed to execute message; message index: 0: amount is smaller than denom reward min stake', /minimum stake/],
        ['failed to execute message; message index: 0: amount should be greater than 0: invalid amount', /greater than zero/],
        ['failed to execute message; message index: 0: no rewards available to claim', /nothing to claim yet/],
        ['failed to execute message; message index: 0: a denom reward already exists for this denom', /already has a denom reward/],
        ['failed to execute message; message index: 0: prize denom cap reached for this denom reward', /maximum number of prize tokens/],
        ['failed to execute message; message index: 0: the new duration exceeds the maximum allowed of 36500 days: invalid duration', /between 1 and 36,500 days/],
        ['failed to execute message; message index: 0: denom reward schedule not found: key not found', /no longer exists/],
        ['failed to execute message; message index: 0: denom reward has no stakers', /no one to pay/],
    ])('maps %s', (raw, expected) => {
        expect(prettyError(raw)).toMatch(expected)
    })

    it.each([
        ['failed to execute message; message index: 0: payouts 3 of 10 executed: staking reward is not finished', /still has days left to pay/],
        ['failed to execute message; message index: 0: staking reward still has staked funds: stakers must exit first', /every staker has exited/],
    ])('maps the staking reward delete error %s', (raw, expected) => {
        expect(prettyError(raw)).toMatch(expected)
    })

    it('maps the brand kit validation error', () => {
        expect(prettyError('failed to execute message; message index: 0: invalid light primary color: #12: invalid branding')).toMatch(/brand kit was refused/)
    })

    it('passes unknown errors through unchanged', () => {
        expect(prettyError('something else')).toBe('something else')
    })
})

describe('prettyError — v8.3.0 refusals', () => {
    it.each([
        ['failed to execute message; message index: 0: Outflow exceeds quota - Net Outflow: 5, Channel Value: 100, Threshold: 2%: quota exceeded', /over today's limit for this route/],
        ['failed to execute message; message index: 0: denom factory/bze1abc/x is blacklisted: denom is blacklisted', /to and from other chains are stopped/],
        ['failed to execute message; message index: 0: channel channel-3: ibc transfers on this channel are stopped', /Transfers on this route are stopped/],
        ['circuit breaker disables execution of this message: /bze.tradebin.MsgMultiSwap', /paused on BeeZee/],
        ['failed to execute message; message index: 0: minting is disabled for this denom', /Minting is turned off/],
        ['failed to execute message; message index: 0: spendable balance 5ubze is smaller than 10ubze: insufficient funds', /don't have enough balance/],
    ])('maps %s', (raw, expected) => {
        expect(prettyError(raw)).toMatch(expected)
    })
})

// Regression table: the messages that existed before v8.3.0 keep their mapping.
describe('prettyError — existing keys', () => {
    it.each([
        ['failed to execute message; message index: 0: amount is smaller than staking reward min stake', 'Amount is smaller than minimum required stake'],
        ['the resulted amount is too low', 'The minimum amount could not be met (the price moved). Increase the slippage and try again.'],
        ['amount is too low to be traded', 'Amount is too low to be traded'],
        ['can not buy more than 50 tickets', 'You can only contribute up to 50 times per transaction.'],
        ['x can be used to pay for fees only if enough liquidity is available', 'Your selected fee token does not have enough liquidity. Please switch to the native token in Settings.'],
        ['broadcast failed with code 7', 'Transaction rejected: your selected fee token may not have enough liquidity. Try switching to the native token in Settings.'],
    ])('maps %s', (raw, expected) => {
        expect(prettyError(raw)).toBe(expected)
    })

    it('returns undefined for an empty message', () => {
        expect(prettyError(undefined)).toBeUndefined()
        expect(prettyError('')).toBeUndefined()
    })
})
