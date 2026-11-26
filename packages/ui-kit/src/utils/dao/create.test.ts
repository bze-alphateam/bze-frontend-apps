import {describe, expect, it} from 'vitest'
import {toBech32} from '@interchainjs/encoding'
import {MsgCreateDao} from '@bze/bzejs/bze/dao/tx'
import {DaoType as DaoTypeProto} from '@bze/bzejs/bze/dao/store'
import type {DaoParams} from '../../types/dao'
import {RECORDED_PARAMS} from '../../query/dao.fixtures'
import {
    adminOf,
    buildCreateDaoFromDraft,
    CREATE_DAO_STEPS,
    DAO_RULE_PRESETS,
    daoCreationFeeText,
    firstInvalidStep,
    freeProposalsWarning,
    initialDraft,
    liveElectorateError,
    memberRows,
    presetRules,
    restoreDraft,
    withPresetDeposit,
    describeProposalMoney,
    rulesFromConfig,
    rulesToConfig,
    validateCreateDaoStep,
    validMembers,
    type CreateDaoContext,
    type CreateDaoDraft,
} from './create'
import {validateDaoConfig} from './validate'
import type {DaoStakeSource} from './create-sources'

const addr = (n: number) => toBech32('bze', new Uint8Array(20).fill(n))
const CREATOR = addr(1)
const PARAMS: DaoParams = RECORDED_PARAMS.params
const SOURCES: DaoStakeSource[] = [
    {kind: 'sr', id: '1', stakingDenom: 'factory/bze1x/honey', lock: 14, staked: '5000000'},
    {kind: 'sr', id: '2', stakingDenom: 'factory/bze1x/honey', lock: 2, staked: '1'},
    {kind: 'sr', id: '3', stakingDenom: 'ubze', lock: 21, staked: '9'},
    {kind: 'sr', id: '4', stakingDenom: 'factory/bze1x/honey', lock: 30, staked: '0'},
    {kind: 'dr', id: 'factory/bze1x/honey', stakingDenom: 'factory/bze1x/honey', lock: 7, staked: '1000'},
]
const ctx = (over: Partial<CreateDaoContext> = {}): CreateDaoContext => ({
    creator: CREATOR,
    params: PARAMS,
    sources: SOURCES,
    nativeDenom: 'ubze',
    decimalsOf: (d) => (d === 'ubze' || d.startsWith('factory/') ? 6 : 0),
    tickerOf: (d) => (d === 'ubze' ? 'BZE' : d.split('/').pop()!.toUpperCase()),
    ...over,
})
const draft = (over: Partial<CreateDaoDraft> = {}): CreateDaoDraft => ({...initialDraft({creator: CREATOR}), name: 'Hive Council', ...over})
const stakeDraft = (over: Partial<CreateDaoDraft> = {}) => draft({type: 'DAO_TYPE_STAKE', electorate: {sr_ids: ['1'], dr_denom: ''}, membersText: '', ...over})

describe('rule presets', () => {
    it.each(DAO_RULE_PRESETS.map(p => p.id))('%s passes the chain rules against the recorded params', (id) => {
        const r = rulesToConfig(presetRules(id, 'factory/bze1x/honey'), ctx())
        expect('config' in r).toBe(true)
        if ('config' in r) expect(validateDaoConfig(r.config, PARAMS)).toBeUndefined()
    })

    it('has the numbers of canvas board H6', () => {
        const council = presetRules('small-council')
        expect(council).toMatchObject({votingDays: '3', quorumPct: '50', thresholdPct: '50', allowExpedite: true})
        expect(presetRules('simple-majority')).toMatchObject({votingDays: '7', quorumPct: '40', thresholdPct: '50', allowExpedite: false})
        const token = rulesToConfig(presetRules('token-community', 'factory/bze1x/honey'), ctx())
        expect(token).toMatchObject({config: {
            min_quorum: '0.334', voting_period: '604800s', expedited_period: '86400s', expedite_threshold: '0.667', allow_expedite: true,
            proposal_deposit: {denom: 'factory/bze1x/honey', amount: '1000000000'}, deposit_refund_policy: 'ONLY_PASSED',
        }})
    })

    it('keeps valid expedite values even when expedite is off', () => {
        const r = rulesToConfig(presetRules('simple-majority'), ctx())
        expect('config' in r && r.config.expedite_quorum >= r.config.min_quorum).toBe(true)
    })

    it('a token deposit needs a token: without one the preset has no deposit', () => {
        expect(presetRules('token-community').depositAmount).toBe('')
    })
})

describe('rulesToConfig', () => {
    const base = presetRules('simple-majority')
    const run = (over: object) => rulesToConfig({...base, ...over}, ctx())

    it('converts amounts with the token exponent, exactly', () => {
        expect(run({costAmount: '1.5', costDenom: ''})).toMatchObject({config: {proposal_cost: {denom: 'ubze', amount: '1500000'}}})
        expect(run({depositAmount: '0.000001'})).toMatchObject({config: {proposal_deposit: {amount: '1'}}})
    })

    it('treats an empty or zero amount as unset', () => {
        expect(run({costAmount: '0'})).toMatchObject({config: {proposal_cost: null}})
        expect(run({depositAmount: ''})).toMatchObject({config: {proposal_deposit: null}})
    })

    it('rejects more decimals than the token has', () => {
        expect(run({costAmount: '0.0000001'})).toEqual({error: 'The proposal cost can have at most 6 decimals.'})
    })

    it('reports the chain boundaries of the percentages and periods', () => {
        expect(run({quorumPct: '0'})).toHaveProperty('error', expect.stringContaining('quorum'))
        expect(run({thresholdPct: '100'})).toHaveProperty('error', expect.stringContaining('threshold'))
        expect(run({quorumPct: 'abc'})).toEqual({error: 'The quorum must be a percentage.'})
        expect(run({votingDays: '91'})).toHaveProperty('error', expect.stringContaining('voting period'))
        expect(run({votingDays: '0.04'})).toHaveProperty('error') // below one hour
        expect(run({votingDays: '1', expeditedDays: '2'})).toHaveProperty('error', expect.stringContaining('expedited'))
        expect(run({expediteQuorumPct: '10'})).toHaveProperty('error', expect.stringContaining('expedite quorum'))
    })

    it('round-trips a config through the form', () => {
        const r = rulesToConfig(presetRules('token-community', 'factory/bze1x/honey'), ctx())
        if (!('config' in r)) throw new Error('invalid')
        const back = rulesToConfig(rulesFromConfig(r.config, ctx().decimalsOf), ctx())
        expect(back).toEqual(r)
    })
})

describe('free proposals warning', () => {
    const config = (over: object) => {
        const r = rulesToConfig({...presetRules('simple-majority'), ...over}, ctx())
        if (!('config' in r)) throw new Error('invalid')
        return r.config
    }
    it('shows when neither cost nor deposit is set, or only a deposit that is always refunded', () => {
        expect(freeProposalsWarning(config({}), '10')).toContain('all 10 open-proposal slots')
        expect(freeProposalsWarning(config({depositAmount: '5', refundPolicy: 'ALWAYS'}))).not.toBeNull()
    })
    it('is gone with a cost or a deposit that can be kept', () => {
        expect(freeProposalsWarning(config({costAmount: '1'}))).toBeNull()
        expect(freeProposalsWarning(config({depositAmount: '5', refundPolicy: 'ONLY_PASSED'}))).toBeNull()
        expect(freeProposalsWarning(config({depositAmount: '5', refundPolicy: 'NEVER'}))).toBeNull()
    })
})

describe('members', () => {
    const [a, b] = [addr(2), addr(3)]
    it('marks a bad address and a duplicate (any case) on its own line', () => {
        const rows = memberRows(`${a}\nbze1abc, ${b.toUpperCase()}; ${a.toUpperCase()}`)
        expect(rows.map(r => r.error)).toEqual([undefined, 'Not a BZE address', undefined, 'Already in the list (line 1)'])
        expect(validMembers(`${a}\n${a}\n${b}`)).toEqual([a, b])
    })

    it('step validation: none, the cap and the first bad line', () => {
        expect(validateCreateDaoStep('voters', draft({membersText: ''}), ctx())).toBe('Add at least one member.')
        expect(validateCreateDaoStep('voters', draft({membersText: `${a}\nnope`}), ctx())).toBe('Line 2: Not a BZE address.')
        // 129 distinct addresses (vary the first byte)
        const distinct = Array.from({length: 129}, (_, i) => toBech32('bze', Uint8Array.from([i, 7, ...new Array(18).fill(1)]))).join('\n')
        expect(validateCreateDaoStep('voters', draft({membersText: distinct}), ctx())).toContain('at most 128')
        expect(validateCreateDaoStep('voters', draft({membersText: distinct.split('\n').slice(0, 128).join('\n')}), ctx())).toBeUndefined()
    })
})

describe('step validation', () => {
    it('name and description at their byte boundaries', () => {
        expect(validateCreateDaoStep('name', draft({name: ''}), ctx())).toBe('Enter a name.')
        expect(validateCreateDaoStep('name', draft({name: 'a'.repeat(64)}), ctx())).toBeUndefined()
        expect(validateCreateDaoStep('name', draft({name: 'a'.repeat(65)}), ctx())).toContain('at most 64 bytes')
        expect(validateCreateDaoStep('name', draft({name: 'é'.repeat(33)}), ctx())).toContain('(it has 66)')
        expect(validateCreateDaoStep('name', draft({description: 'a'.repeat(2000)}), ctx())).toBeUndefined()
        expect(validateCreateDaoStep('name', draft({description: 'a'.repeat(2001)}), ctx())).toContain('2,000 bytes')
    })

    it('stake voters: count, mixed denoms, lock below the param', () => {
        const v = (sr_ids: string[], dr_denom = '') => validateCreateDaoStep('voters', stakeDraft({electorate: {sr_ids, dr_denom}}), ctx())
        expect(v(['1'], 'factory/bze1x/honey')).toBeUndefined()
        expect(v(['1', '3'])).toContain('same token')
        expect(v(['2'])).toContain('2-day lock')
        expect(v(['1', '1'])).toContain('listed twice')
        expect(v(['1', '4', '5', '6', '7', '8'])).toContain('at most 5')
    })

    it('another admin must be a valid address', () => {
        expect(validateCreateDaoStep('admin', draft({adminChoice: 'other', adminAddress: 'bze1abc'}), ctx())).toBe('Enter a valid BZE address.')
        expect(validateCreateDaoStep('admin', draft({adminChoice: 'other', adminAddress: addr(5)}), ctx())).toBeUndefined()
    })

    it('review reports the first problem and firstInvalidStep finds its step', () => {
        const bad = draft({name: ''})
        expect(validateCreateDaoStep('review', bad, ctx())).toBe('Enter a name.')
        expect(firstInvalidStep(bad, ctx())).toBe('name')
        expect(firstInvalidStep(draft(), ctx())).toBeUndefined()
        expect(CREATE_DAO_STEPS).toHaveLength(6)
    })
})

describe('live-electorate rule', () => {
    it('a self-owned stake DAO needs a source with stake', () => {
        const none = stakeDraft({electorate: {sr_ids: [], dr_denom: ''}})
        expect(liveElectorateError(none, ctx())).toContain('something staked')
        expect(liveElectorateError(stakeDraft({electorate: {sr_ids: ['4'], dr_denom: ''}}), ctx())).toContain('something staked') // sr 4 holds 0
        expect(liveElectorateError(stakeDraft(), ctx())).toBeUndefined()
        expect(validateCreateDaoStep('admin', none, ctx())).toBeDefined()
    })

    it('an external admin may start with no sources or no stake', () => {
        for (const adminChoice of ['me', 'other'] as const) {
            const d = stakeDraft({electorate: {sr_ids: [], dr_denom: ''}, adminChoice, adminAddress: addr(6)})
            expect(validateCreateDaoStep('admin', d, ctx())).toBeUndefined()
        }
    })

    it('a self-owned member list needs a member', () => {
        expect(liveElectorateError(draft({membersText: ''}), ctx())).toContain('at least one member')
        expect(liveElectorateError(draft({membersText: addr(2)}), ctx())).toBeUndefined()
    })
})

describe('the message', () => {
    const decode = (d: CreateDaoDraft, c = ctx()) => {
        const built = buildCreateDaoFromDraft(d, c)
        if ('error' in built) throw new Error(built.error)
        return built.msg.value as MsgCreateDao
    }

    it('builds a static-list DAO for each of the three admin choices', () => {
        const members = `${CREATOR}\n${addr(2).toUpperCase()}`
        const voters = decode(draft({membersText: members}))
        expect(voters).toMatchObject({creator: CREATOR, admin: '', type: DaoTypeProto.DAO_TYPE_STATIC_LIST, name: 'Hive Council', members: [CREATOR, addr(2)]})
        expect(voters.electorate).toBeUndefined()
        expect(decode(draft({membersText: members, adminChoice: 'me'})).admin).toBe(CREATOR)
        expect(decode(draft({membersText: members, adminChoice: 'other', adminAddress: ` ${addr(7)} `})).admin).toBe(addr(7))
        expect(adminOf(draft({adminChoice: 'me'}), CREATOR)).toBe(CREATOR)
    })

    it('builds a stake DAO with the electorate and no members', () => {
        const msg = decode(stakeDraft({electorate: {sr_ids: ['1'], dr_denom: 'factory/bze1x/honey'}}))
        expect(msg.type).toBe(DaoTypeProto.DAO_TYPE_STAKE)
        expect(msg.members).toEqual([])
        expect(msg.electorate).toEqual({srIds: ['1'], drDenom: 'factory/bze1x/honey'})
        expect(msg.config?.minQuorum).toBe('0.4')
    })

    it('refuses an invalid draft instead of building it', () => {
        expect(buildCreateDaoFromDraft(stakeDraft({electorate: {sr_ids: [], dr_denom: ''}}), ctx())).toHaveProperty('error')
    })
})

describe('preset and locked', () => {
    const preset = {type: 'DAO_TYPE_STAKE' as const, name: 'HONEY Holders', electorate: {sr_ids: ['1'], dr_denom: 'factory/bze1x/honey'}, stakingDenom: 'factory/bze1x/honey'}

    it('a stake preset fills the draft and defaults to the Token community rules with the deposit token', () => {
        const d = initialDraft({creator: CREATOR, preset})
        expect(d).toMatchObject({type: 'DAO_TYPE_STAKE', name: 'HONEY Holders', adminChoice: 'voters', presetId: 'token-community'})
        expect(d.electorate).toEqual(preset.electorate)
        expect(d.rules.depositDenom).toBe('factory/bze1x/honey')
    })

    it('a preset admin of the creator is "me", another address is "other"', () => {
        expect(initialDraft({creator: CREATOR, preset: {admin: CREATOR}}).adminChoice).toBe('me')
        expect(initialDraft({creator: CREATOR, preset: {admin: addr(4)}})).toMatchObject({adminChoice: 'other', adminAddress: addr(4)})
    })

    it('a preset config opens as Custom with its own values', () => {
        const r = rulesToConfig(presetRules('small-council'), ctx())
        if (!('config' in r)) throw new Error('invalid')
        const d = initialDraft({creator: CREATOR, preset: {config: r.config}})
        expect(d.presetId).toBe('custom')
        expect(d.rules.votingDays).toBe('3')
    })

    it('the creator is pre-added to a member list and can be removed', () => {
        expect(initialDraft({creator: CREATOR}).membersText).toBe(CREATOR)
    })

    it('every preset field and a lock beat a restored draft; fields the preset leaves out are kept', () => {
        const base = initialDraft({creator: CREATOR, preset})
        const saved = {...base, type: 'DAO_TYPE_STATIC_LIST' as const, name: 'Mine', electorate: {sr_ids: ['9'], dr_denom: ''}}
        expect(restoreDraft(saved, base, {type: true, stakingDenom: 'factory/bze1x/honey'}, preset)).toMatchObject({type: 'DAO_TYPE_STAKE', name: 'HONEY Holders', electorate: preset.electorate})
        const noName = {...preset, name: undefined}
        const lockOnly = restoreDraft({...saved, name: 'Mine', adminChoice: 'me'}, initialDraft({creator: CREATOR, preset: noName}), {type: true}, noName)
        expect(lockOnly).toMatchObject({type: 'DAO_TYPE_STAKE', name: 'Mine', adminChoice: 'me'})
        const named = restoreDraft({...saved, adminChoice: 'me'}, initialDraft({creator: CREATOR, preset: {...preset, admin: addr(4)}}), undefined, {...preset, admin: addr(4)})
        expect(named).toMatchObject({adminChoice: 'other', adminAddress: addr(4)})
        expect(restoreDraft(saved, base)).toMatchObject({type: 'DAO_TYPE_STATIC_LIST'})
        expect(restoreDraft(undefined, base)).toBe(base)
    })
})

describe('the Token community deposit', () => {
    const honey = 'factory/bze1x/honey'
    const unknownDenom = () => initialDraft({creator: CREATOR, preset: {type: 'DAO_TYPE_STAKE'}})

    it('is empty while the staking token is unknown and applied once the voters name it', () => {
        const d = unknownDenom()
        expect(d.presetId).toBe('token-community')
        expect(d.rules.depositAmount).toBe('')
        const applied = withPresetDeposit(d, honey)
        expect(applied.rules).toMatchObject({depositAmount: '1000', depositDenom: honey, refundPolicy: 'ONLY_PASSED'})
        const r = rulesToConfig(applied.rules, ctx())
        expect(r).toMatchObject({config: {proposal_deposit: {denom: honey, amount: '1000000000'}}})
    })

    it('follows the token when the voters change it, but never touches an edited (Custom) deposit', () => {
        const first = withPresetDeposit(unknownDenom(), honey)
        expect(withPresetDeposit(first, 'factory/bze1x/other').rules.depositDenom).toBe('factory/bze1x/other')
        const edited = {...first, presetId: 'custom' as const, rules: {...first.rules, depositAmount: '5'}}
        expect(withPresetDeposit(edited, 'factory/bze1x/other')).toBe(edited)
    })

    it('does nothing for a member list or without a token', () => {
        const d = unknownDenom()
        expect(withPresetDeposit(d, undefined)).toBe(d)
        const staticDraft = draft()
        expect(withPresetDeposit(staticDraft, honey)).toBe(staticDraft)
    })

    it('a locked token is used from the start', () => {
        expect(initialDraft({creator: CREATOR, preset: {type: 'DAO_TYPE_STAKE'}, locked: {type: true, stakingDenom: honey}}).rules.depositDenom).toBe(honey)
    })
})

describe('what a proposal costs, for the review', () => {
    const fmt = {decimalsOf: ctx().decimalsOf, tickerOf: ctx().tickerOf}
    const configOf = (over: object) => {
        const r = rulesToConfig({...presetRules('simple-majority'), ...over}, ctx())
        if (!('config' in r)) throw new Error('invalid')
        return r.config
    }
    it('says none when free', () => {
        expect(describeProposalMoney(configOf({}), fmt)).toEqual({cost: 'None', deposit: 'None'})
    })
    it('spells the amounts, tokens, destinations and refund policy of what is signed', () => {
        const m = describeProposalMoney(configOf({costAmount: '2.5', costDestination: 'TREASURY', depositAmount: '10', depositDenom: 'factory/bze1x/honey', refundPolicy: 'ONLY_PASSED', keptDepositDestination: 'BURN'}), fmt)
        expect(m.cost).toBe("2.5 BZE, paid on submit and sent to the DAO's treasury")
        expect(m.deposit).toBe('10 HONEY, returned only when the proposal passes; a kept deposit is burned')
    })
})

describe('creation fee text', () => {
    const c = ctx()
    const fee = PARAMS.dao_creation_fee

    it('BZE paid in BZE, burned', () => {
        expect(daoCreationFeeText({fee, destination: 'burner', txFeeDenom: 'ubze', decimalsOf: c.decimalsOf, tickerOf: c.tickerOf})).toEqual({
            amount: '50,000 BZE', destination: 'is burned', paidIn: 'BZE', transferFeeNote: undefined,
        })
    })

    it('a factory fee token: swapped to BZE when possible, with the transfer-fee note', () => {
        const t = daoCreationFeeText({fee, destination: 'community_pool', txFeeDenom: 'factory/bze1x/honey', decimalsOf: c.decimalsOf, tickerOf: c.tickerOf})
        expect(t.destination).toBe('goes to the community pool')
        expect(t.paidIn).toBe('Your fee token (HONEY) if it can be swapped to BZE, otherwise BZE.')
        expect(t.transferFeeNote).toBe('If HONEY charges a transfer fee, it is added on top.')
    })

    it('another native-like fee token has no transfer-fee note', () => {
        const t = daoCreationFeeText({fee, destination: 'burner', txFeeDenom: 'ibc/ABC', decimalsOf: c.decimalsOf, tickerOf: () => 'ATOM'})
        expect(t.transferFeeNote).toBeUndefined()
    })
})
