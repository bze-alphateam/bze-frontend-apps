import { describe, expect, it } from 'vitest'
import { toBech32 } from '@interchainjs/encoding'
import type { DaoConfig } from '../../types/dao'
import {
    utf8Length,
    validateDaoAdminExecute,
    validateDaoConfig,
    validateDaoDescription,
    validateDaoElectorate,
    validateDaoElectorateKind,
    validateDaoMemberChanges,
    validateDaoMembers,
    validateDaoName,
    validateDaoProposalContent,
} from './validate'

// Each bound at, just inside and just outside, mirroring x/dao at v8.3.0-rc1.

const addr = (n: number, prefix = 'bze') => toBech32(prefix, new Uint8Array(20).fill(n))
const A = addr(1), B = addr(2), C = addr(3), DAO = addr(9)

const PARAMS = {
    min_voting_period: '3600s',
    max_voting_period: '7776000s',
    max_static_members: '3',
    max_sr_per_dao: '2',
    max_title_len: '10',
    max_summary_len: '20',
    max_msgs_per_proposal: '2',
    max_proposal_bytes: '100',
}

const CONFIG: DaoConfig = {
    min_quorum: '0.4',
    threshold: '0.5',
    voting_period: '259200s',
    allow_expedite: false,
    expedited_period: '86400s',
    expedite_quorum: '0.6',
    expedite_threshold: '0.66',
    open_submission: false,
    proposal_cost: null,
    proposal_deposit: null,
    deposit_refund_policy: 'ALWAYS',
    cost_destination: 'BURN',
    kept_deposit_destination: 'BURN',
}

const config = (patch: Partial<DaoConfig>) => validateDaoConfig({ ...CONFIG, ...patch }, PARAMS)

describe('metadata', () => {
    it('measures UTF-8 bytes, not characters', () => {
        expect(utf8Length('é')).toBe(2)
        expect(utf8Length('🐝')).toBe(4)
    })

    it('name: 1 to 64 bytes', () => {
        expect(validateDaoName('')).toBeDefined()
        expect(validateDaoName('a')).toBeUndefined()
        expect(validateDaoName('a'.repeat(64))).toBeUndefined()
        expect(validateDaoName('a'.repeat(65))).toBeDefined()
        expect(validateDaoName('é'.repeat(32))).toBeUndefined()
        expect(validateDaoName('a' + 'é'.repeat(32))).toBeDefined()
    })

    it('description: up to 2,000 bytes, empty allowed', () => {
        expect(validateDaoDescription('')).toBeUndefined()
        expect(validateDaoDescription('a'.repeat(2000))).toBeUndefined()
        expect(validateDaoDescription('a'.repeat(2001))).toBeDefined()
        expect(validateDaoDescription('é'.repeat(1001))).toBeDefined()
    })
})

describe('validateDaoConfig', () => {
    it('accepts a sound config', () => {
        expect(config({})).toBeUndefined()
    })

    it('min_quorum is in (0, 1]', () => {
        expect(config({ min_quorum: '0' })).toMatch(/quorum must be/)
        expect(config({ min_quorum: '0.000000000000000001' })).toBeUndefined()
        expect(config({ min_quorum: '1', expedite_quorum: '1' })).toBeUndefined()
        expect(config({ min_quorum: '1.000000000000000001', expedite_quorum: '1' })).toMatch(/quorum must be/)
    })

    it('expedite_quorum is in (0, 1]', () => {
        expect(config({ min_quorum: '0.000000000000000001', expedite_quorum: '0' })).toMatch(/expedite quorum must be/)
        expect(config({ min_quorum: '0.000000000000000001', expedite_quorum: '0.000000000000000001' })).toBeUndefined()
        expect(config({ expedite_quorum: '1' })).toBeUndefined()
        expect(config({ expedite_quorum: '1.000000000000000001' })).toMatch(/expedite quorum must be/)
    })

    it('threshold is in (0, 1): a threshold of 1 could never be exceeded', () => {
        expect(config({ threshold: '0' })).toBeDefined()
        expect(config({ threshold: '0.000000000000000001', })).toBeUndefined()
        expect(config({ threshold: '0.66' })).toBeUndefined()
        expect(config({ threshold: '0.66', expedite_threshold: '0.999999999999999999' })).toBeUndefined()
        expect(config({ threshold: '1', expedite_threshold: '1' })).toBeDefined()
    })

    it('expedite_threshold is in (0, 1)', () => {
        expect(config({ expedite_threshold: '0.999999999999999999' })).toBeUndefined()
        expect(config({ expedite_threshold: '1' })).toBeDefined()
    })

    it('refuses ratios that are not plain decimals with at most 18 digits', () => {
        expect(config({ min_quorum: '40%' })).toBeDefined()
        expect(config({ min_quorum: '0.4000000000000000001' })).toBeDefined()
        expect(config({ min_quorum: '' })).toBeDefined()
    })

    it('expedite values are at least the regular ones (equal is fine)', () => {
        expect(config({ expedite_quorum: '0.4' })).toBeUndefined()
        expect(config({ expedite_quorum: '0.399999999999999999' })).toMatch(/expedite quorum/)
        expect(config({ expedite_threshold: '0.5' })).toBeUndefined()
        expect(config({ expedite_threshold: '0.499999999999999999' })).toMatch(/expedite threshold/)
    })

    it('checks the expedite fields even when expedite is off', () => {
        expect(config({ allow_expedite: false, expedite_threshold: '1' })).toBeDefined()
    })

    it('periods stay within [min_voting_period, max_voting_period]', () => {
        expect(config({ voting_period: '3600s', expedited_period: '3600s' })).toBeUndefined()
        expect(config({ voting_period: '3599s', expedited_period: '3599s' })).toMatch(/between 1 hour and 90 days/)
        expect(config({ voting_period: '7776000s' })).toBeUndefined()
        expect(config({ voting_period: '7776001s' })).toBeDefined()
        expect(config({ expedited_period: '3599s' })).toMatch(/expedited period/)
    })

    it('the expedited period is at most the voting period', () => {
        expect(config({ voting_period: '86400s', expedited_period: '86400s' })).toBeUndefined()
        expect(config({ voting_period: '86400s', expedited_period: '86401s' })).toMatch(/longer than the voting period/)
    })

    it('proposal cost and deposit are optional coins with an amount ≥ 0', () => {
        expect(config({ proposal_cost: { denom: 'ubze', amount: '0' } })).toBeUndefined()
        expect(config({ proposal_deposit: { denom: 'ubze', amount: '1000000' } })).toBeUndefined()
        expect(config({ proposal_cost: { denom: 'ubze', amount: '-1' } })).toBeDefined()
        expect(config({ proposal_deposit: { denom: 'ubze', amount: '1.5' } })).toBeDefined()
        expect(config({ proposal_cost: { denom: '1x', amount: '1' } })).toBeDefined()
    })
})

describe('validateDaoMembers', () => {
    it('1 to max_static_members unique valid addresses', () => {
        expect(validateDaoMembers([], PARAMS)).toBeDefined()
        expect(validateDaoMembers([A], PARAMS)).toBeUndefined()
        expect(validateDaoMembers([A, B, C], PARAMS)).toBeUndefined()
        expect(validateDaoMembers([A, B, C, addr(4)], PARAMS)).toMatch(/at most 3/)
    })

    it('a different-case duplicate counts as a duplicate', () => {
        expect(validateDaoMembers([A, A.toUpperCase()], PARAMS)).toMatch(/twice/)
    })

    it('refuses a mixed-case address, as bech32 and the chain do', () => {
        const mixed = A.slice(0, 10).toUpperCase() + A.slice(10)
        expect(validateDaoMembers([mixed], PARAMS)).toMatch(/not a valid address/)
    })

    it('refuses invalid addresses and another chain\'s', () => {
        expect(validateDaoMembers(['bze1notanaddress'], PARAMS)).toMatch(/not a valid address/)
        expect(validateDaoMembers([addr(1, 'osmo')], PARAMS)).toMatch(/not a valid address/)
    })

    it('never the DAO itself', () => {
        expect(validateDaoMembers([A, DAO], PARAMS, DAO)).toMatch(/itself/)
    })
})

describe('validateDaoMemberChanges', () => {
    const current = { members: [A, B], daoAddress: DAO }

    it('needs at least one change', () => {
        expect(validateDaoMemberChanges({ add: [], remove: [] }, current, PARAMS)).toBeDefined()
    })

    it('adds new members and removes existing ones', () => {
        expect(validateDaoMemberChanges({ add: [C], remove: [] }, current, PARAMS)).toBeUndefined()
        expect(validateDaoMemberChanges({ add: [], remove: [B] }, current, PARAMS)).toBeUndefined()
        expect(validateDaoMemberChanges({ add: [A], remove: [] }, current, PARAMS)).toMatch(/already a member/)
        expect(validateDaoMemberChanges({ add: [], remove: [C] }, current, PARAMS)).toMatch(/not a member/)
        expect(validateDaoMemberChanges({ add: [DAO], remove: [] }, current, PARAMS)).toMatch(/itself/)
    })

    it('refuses duplicates and an address in both lists', () => {
        expect(validateDaoMemberChanges({ add: [C, C.toUpperCase()], remove: [] }, current, PARAMS)).toMatch(/twice/)
        expect(validateDaoMemberChanges({ add: [C], remove: [C] }, current, PARAMS)).toMatch(/both added and removed/)
    })

    it('keeps 1 to max_static_members members', () => {
        expect(validateDaoMemberChanges({ add: [], remove: [A, B] }, current, PARAMS)).toMatch(/at least one/)
        expect(validateDaoMemberChanges({ add: [C], remove: [] }, current, PARAMS)).toBeUndefined()
        expect(validateDaoMemberChanges({ add: [C, addr(4)], remove: [] }, current, PARAMS)).toMatch(/at most 3/)
        expect(validateDaoMemberChanges({ add: [C, addr(4)], remove: [A] }, current, PARAMS)).toBeUndefined()
    })
})

describe('validateDaoElectorateKind', () => {
    it('never mixes members and stake', () => {
        expect(validateDaoElectorateKind('DAO_TYPE_STATIC_LIST', [A], null)).toBeUndefined()
        expect(validateDaoElectorateKind('DAO_TYPE_STATIC_LIST', [A], { sr_ids: [], dr_denom: '' })).toBeUndefined()
        expect(validateDaoElectorateKind('DAO_TYPE_STATIC_LIST', [A], { sr_ids: ['1'], dr_denom: '' })).toMatch(/cannot also vote with stake/)
        expect(validateDaoElectorateKind('DAO_TYPE_STATIC_LIST', [A], { sr_ids: [], dr_denom: 'ubze' })).toMatch(/cannot also vote with stake/)
        expect(validateDaoElectorateKind('DAO_TYPE_STAKE', [], { sr_ids: ['1'], dr_denom: '' })).toBeUndefined()
        expect(validateDaoElectorateKind('DAO_TYPE_STAKE', [], null)).toBeUndefined()
        expect(validateDaoElectorateKind('DAO_TYPE_STAKE', [A], null)).toMatch(/cannot also have a member list/)
    })
})

describe('validateDaoElectorate', () => {
    it('up to max_sr_per_dao unique non-empty ids plus an optional Denom Reward', () => {
        expect(validateDaoElectorate(null, PARAMS)).toBeUndefined()
        expect(validateDaoElectorate({ sr_ids: [], dr_denom: '' }, PARAMS)).toBeUndefined()
        expect(validateDaoElectorate({ sr_ids: ['1', '2'], dr_denom: 'ubze' }, PARAMS)).toBeUndefined()
        expect(validateDaoElectorate({ sr_ids: ['1', '2', '3'], dr_denom: '' }, PARAMS)).toMatch(/at most 2/)
        expect(validateDaoElectorate({ sr_ids: ['1', '1'], dr_denom: '' }, PARAMS)).toMatch(/twice/)
        expect(validateDaoElectorate({ sr_ids: [''], dr_denom: '' }, PARAMS)).toMatch(/empty/)
        expect(validateDaoElectorate({ sr_ids: [], dr_denom: 'x' }, PARAMS)).toBeDefined()
    })
})

describe('validateDaoProposalContent', () => {
    const content = (patch: Partial<{ title: string; summary: string; msgCount: number; msgsSize: number }>) =>
        validateDaoProposalContent({ title: 'Fund', summary: '', msgCount: 0, msgsSize: 0, ...patch }, PARAMS)

    it('title 1 to max_title_len bytes', () => {
        expect(content({ title: '' })).toBeDefined()
        expect(content({ title: 'a'.repeat(10) })).toBeUndefined()
        expect(content({ title: 'a'.repeat(11) })).toBeDefined()
        expect(content({ title: 'é'.repeat(6) })).toBeDefined()
    })

    it('summary up to max_summary_len bytes', () => {
        expect(content({ summary: 'a'.repeat(20) })).toBeUndefined()
        expect(content({ summary: 'a'.repeat(21) })).toBeDefined()
    })

    it('0 to max_msgs_per_proposal messages, at most max_proposal_bytes', () => {
        expect(content({ msgCount: 0 })).toBeUndefined()
        expect(content({ msgCount: 2, msgsSize: 100 })).toBeUndefined()
        expect(content({ msgCount: 3 })).toBeDefined()
        expect(content({ msgCount: 1, msgsSize: 101 })).toBeDefined()
    })
})

describe('validateDaoAdminExecute', () => {
    it('1 to max_msgs_per_proposal messages, at most max_proposal_bytes', () => {
        expect(validateDaoAdminExecute({ msgCount: 0, msgsSize: 0 }, PARAMS)).toBeDefined()
        expect(validateDaoAdminExecute({ msgCount: 1, msgsSize: 100 }, PARAMS)).toBeUndefined()
        expect(validateDaoAdminExecute({ msgCount: 3, msgsSize: 10 }, PARAMS)).toBeDefined()
        expect(validateDaoAdminExecute({ msgCount: 1, msgsSize: 101 }, PARAMS)).toBeDefined()
    })
})
