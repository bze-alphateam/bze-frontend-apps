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

// Regression table: every key that existed before v8.3.0, with the exact message it maps to.
describe('prettyError — every existing key', () => {
    it.each([
        ["failed to execute message; message index: 0: amount is smaller than staking reward min stake", "Amount is smaller than minimum required stake"],
        ["the resulted amount is too low", "The minimum amount could not be met (the price moved). Increase the slippage and try again."],
        ["amount is too low to be traded", "Amount is too low to be traded"],
        ["can not buy more than 50 tickets", "You can only contribute up to 50 times per transaction."],
        ["can be used to pay for fees only if enough liquidity is available", "Your selected fee token does not have enough liquidity. Please switch to the native token in Settings."],
        ["you are not a participant in this denom reward", "You have no stake in this denom reward any more — it may already have been exited. Refresh the page."],
        ["amount is smaller than denom reward min stake", "Your stake would stay below this denom reward's minimum stake. Stake enough for your whole position to reach it."],
        ["amount should be greater than 0", "Enter an amount greater than zero."],
        ["no rewards available to claim", "There is nothing to claim yet — amounts smaller than one base unit keep accruing until they add up."],
        ["denom reward not found", "This token has no denom reward yet — create it first."],
        ["a denom reward already exists for this denom", "This token already has a denom reward — there can only be one per token. Refresh the page to see it."],
        ["prize denom cap reached for this denom reward", "This denom reward already uses the maximum number of prize tokens. Fund it with a prize token it already has."],
        ["invalid duration", "Invalid duration: a schedule runs between 1 and 36,500 days, also after extending it."],
        ["denom reward has no stakers", "Nobody is staking this token yet, so there is no one to pay — nothing left your wallet. Try again once someone stakes."],
        ["denom reward schedule not found", "This schedule no longer exists — it may have paid its last day. Refresh the page."],
        ["staking reward is not finished", "This program still has days left to pay — it can only be deleted once it has finished. Refresh the page."],
        ["staking reward still has staked funds", "Someone still has a stake in this program — it can only be deleted once every staker has exited. Refresh the page."],
        ["invalid branding", "The brand kit was refused: it needs a lowercase font slug and all eight colours as 6-digit hex values like #1A2B3C. Check the fields and try again."],
        ["validator for this address is currently jailed", "This validator is jailed, so its unbonding can not be cancelled until it is unjailed."],
        ["unbonding delegation is already processed", "This unbonding has already completed, so it can not be cancelled any more. Refresh the page."],
        ["unbonding delegation entry is not found at block height", "This unbonding entry no longer exists — it may have completed or been cancelled already. Refresh the page."],
        ["broadcast failed with code 7", "Transaction rejected: your selected fee token may not have enough liquidity. Try switching to the native token in Settings."],
    ])('maps "%s"', (raw, expected) => {
        expect(prettyError(raw)).toBe(expected)
        // the chain wraps the registered message; the mapping must survive the wrapping
        expect(prettyError(`x: ${raw}`)).toBe(expected)
    })

    // Ordering: the participant key is listed before "denom reward not found" because the chain
    // wraps that error. Without the order, the participant refusal would read as "no denom reward".
    it('maps the wrapped participant error to the participant message, not to "denom reward not found"', () => {
        const raw = 'failed to execute message; message index: 0: you are not a participant in this denom reward: denom reward not found'
        expect(prettyError(raw)).toMatch(/no stake in this denom reward/)
        expect(prettyError(raw)).not.toMatch(/no denom reward yet/)
    })
})

describe('prettyError - order book', () => {
    it('explains a cancel of an order that was merged, filled or cancelled', () => {
        expect(prettyError('failed to execute message; message index: 0: order not found')).toMatch(/merged into a newer order/)
    })
})

describe('prettyError — empty input', () => {
    it('returns undefined for an empty message', () => {
        expect(prettyError(undefined)).toBeUndefined()
        expect(prettyError('')).toBeUndefined()
    })
})

// x/dao (chain v8.3.0): raw logs as the chain builds them (errorsmod.Wrapf(<sentinel>, <detail>)
// puts the detail first), one per listed code.
describe('prettyError — DAOs (x/dao)', () => {
    const raw = (detail: string) => `failed to execute message; message index: 0: ${detail}`

    it.each([
        [1103, raw('expedite_quorum 0.300000000000000000 is lower than min_quorum 0.400000000000000000: invalid dao config'), /DAO rules were refused/],
        [1104, raw('duplicate member bze1abc: invalid dao members'), /member list was refused/],
        [1105, raw('staking reward 3 stakes ubze, the electorate stakes uvdl: all sources must share one staking denom: invalid dao electorate'), /voters were refused/],
        [1108, raw('dao 5: dao not found'), /DAO doesn't exist/],
        [1109, raw('dao 5: signer is not the dao\'s admin'), /Only this DAO's admin/],
        [1111, raw('message 0: message must be signed by the dao account only'), /A DAO can only act as itself/],
        [1112, raw('dao 5: an admin nomination is already pending'), /already pending/],
        [1113, raw('a self-owned dao needs voters: the dao electorate cannot vote'), /nobody who can vote/],
        [1114, raw('the nominee is the current admin: invalid admin nominee'), /nominee must be a valid address/],
        [1116, raw('dao 5: signer is not the dao\'s pending admin'), /Only the nominated address/],
        [1118, raw('dao 5: signer cannot submit proposals to this dao'), /Only this DAO's voters/],
        [1119, raw('dao 5 has no voters: no voting power'), /no voting power to count/],
        [1120, raw('dao 5 already has 10 proposals in voting: the dao has too many open proposals'), /most proposals open/],
        [1121, raw('dao 5: the dao does not allow expedited proposals'), /doesn't allow expedited/],
        [1124, raw('proposal 7: the proposal is not open for voting'), /Voting on this proposal is closed/],
        [1125, raw('proposal 7: the ballot already has this option'), /already voted this way/],
        [1126, raw('proposal 7: signer is not the proposal\'s proposer'), /Only the address that submitted/],
        [1127, raw('proposal 7: the proposal\'s voting period has not ended'), /Voting is still open/],
        [1128, raw('proposal 7 is EXECUTED: the proposal is finished'), /already finished/],
        [1130, raw('proposal 7: the expedited proposal does not meet the expedite bars yet'), /enough votes to settle early/],
        [1131, raw('proposal 7 is VOTING: the proposal is not finished'), /can't be cleaned up yet/],
        [1132, raw('proposal 7: the expedited proposal cannot settle early yet'), /minimum time to react/],
        [1133, raw('message 0 (/cosmos.authz.v1beta1.MsgGrant): the message is not allowed in this dao execution'), /isn't allowed here/],
        [1115, raw('dao 5: no admin nomination is pending'), /no pending admin nomination/],
        [1134, raw('at most 5 nested dao executions: dao executions are nested too deep'), /nested too deep/],
        [1135, raw('dao 5: the admin nomination is stale: control of the nominating dao changed since'), /no longer valid/],
    ])('maps code %i', (_code, log, expected) => {
        expect(prettyError(log)).toMatch(expected)
    })

    it('tells the pending-admin and admin errors apart', () => {
        expect(prettyError(raw('signer is not the dao\'s pending admin'))).toMatch(/nominated address/)
        expect(prettyError(raw('signer is not the dao\'s admin'))).toMatch(/admin's wallet/)
    })

    it('tells finished and not-finished proposals apart', () => {
        expect(prettyError(raw('the proposal is not finished'))).toMatch(/cleaned up/)
        expect(prettyError(raw('the proposal is finished'))).toMatch(/already finished/)
    })

    it('leaves the existing mappings as they were', () => {
        expect(prettyError(raw('denom reward not found'))).toMatch(/no denom reward yet/)
        expect(prettyError('broadcast failed with code 7')).toMatch(/fee token/)
    })
})
