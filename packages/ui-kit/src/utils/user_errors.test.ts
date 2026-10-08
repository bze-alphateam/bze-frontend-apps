import { describe, expect, it } from 'vitest'
import { prettyError } from './user_errors'

// The chain's raw_log wraps the registered error message: "failed to execute message; message
// index: 0: <wrapped detail>: <registered message>".
describe('prettyError — Denom Rewards (x/rewards)', () => {
    it.each([
        ['failed to execute message; message index: 0: denom reward not found', /no denom reward yet/],
        ['failed to execute message; message index: 0: a denom reward already exists for this denom', /already has a denom reward/],
        ['failed to execute message; message index: 0: prize denom cap reached for this denom reward', /maximum number of prize tokens/],
        ['failed to execute message; message index: 0: the new duration exceeds the maximum allowed of 36500 days: invalid duration', /between 1 and 36,500 days/],
        ['failed to execute message; message index: 0: denom reward schedule not found: key not found', /no longer exists/],
        ['failed to execute message; message index: 0: denom reward has no stakers', /no one to pay/],
    ])('maps %s', (raw, expected) => {
        expect(prettyError(raw)).toMatch(expected)
    })

    it('passes unknown errors through unchanged', () => {
        expect(prettyError('something else')).toBe('something else')
    })
})
