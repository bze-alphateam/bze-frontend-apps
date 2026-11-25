import { describe, expect, it } from 'vitest'
import { Any } from '@bze/bzejs/google/protobuf/any'
import { MsgSend } from '@bze/bzejs/cosmos/bank/v1beta1/tx'
import { DaoType, DepositRefundPolicy, FundsDestination, VoteOption } from '@bze/bzejs/bze/dao/store'
import {
    MsgAcceptAdminNomination,
    MsgAdminExecute,
    MsgCancelProposal,
    MsgCleanupProposal,
    MsgCreateDao,
    MsgNominateAdmin,
    MsgSettleProposal,
    MsgSubmitProposal,
    MsgUpdateDaoConfig,
    MsgUpdateElectorate,
    MsgUpdateMembers,
    MsgUpdateMetadata,
    MsgVote,
    MsgWithdrawAdminNomination,
} from '@bze/bzejs/bze/dao/tx'
import { encodeMsgValue, getMsgCodec } from '../signing_client_setup'
import type { DaoConfig } from '../../types/dao'
import {
    buildAcceptAdminNominationMsg,
    buildAdminExecuteMsg,
    buildCancelDaoProposalMsg,
    buildCleanupDaoProposalMsg,
    buildCreateDaoMsg,
    buildDaoVoteMsg,
    buildNominateAdminMsg,
    buildSettleDaoProposalMsg,
    buildSubmitProposalMsg,
    buildUpdateDaoConfigMsg,
    buildUpdateDaoElectorateMsg,
    buildUpdateDaoMembersMsg,
    buildUpdateDaoMetadataMsg,
    buildWithdrawAdminNominationMsg,
    daoConfigFromWire,
    daoMsgsSize,
    daoTxOptions,
    daysHoursFromDuration,
    durationFromSeconds,
    durationSeconds,
    durationString,
    packDaoMsgs,
    percentFromRatio,
    ratioFromPercent,
    secondsFromDaysHours,
} from './msgs'

const ME = 'bze1me'
const DAO = 'bze1dao'

const CONFIG: DaoConfig = {
    min_quorum: '0.400000000000000000',
    threshold: '0.5',
    voting_period: '259200s',
    allow_expedite: true,
    expedited_period: '86400s',
    expedite_quorum: '0.6',
    expedite_threshold: '0.66',
    open_submission: false,
    proposal_cost: null,
    proposal_deposit: { denom: 'ubze', amount: '1000000' },
    deposit_refund_policy: 'ONLY_PASSED',
    cost_destination: 'BURN',
    kept_deposit_destination: 'TREASURY',
}

const send = (amount = '5') => ({
    typeUrl: MsgSend.typeUrl,
    value: { fromAddress: DAO, toAddress: ME, amount: [{ denom: 'ubze', amount }] },
})

/** Encode the way the signing client does, then decode: what the chain receives. */
const roundTrip = <T>(codec: { decode: (b: Uint8Array) => T }, msg: { typeUrl: string; value: unknown }): T =>
    codec.decode(encodeMsgValue(msg.typeUrl, msg.value))

describe('daoTxOptions', () => {
    it('signs direct and never signs when the simulation fails', () => {
        expect(daoTxOptions).toEqual({ useDirectSign: true, abortOnSimulationError: true })
    })
})

describe('config helpers', () => {
    it('converts percentages and ratios both ways', () => {
        expect(ratioFromPercent(40)).toBe('0.4')
        expect(ratioFromPercent('66.6')).toBe('0.666')
        expect(ratioFromPercent(100)).toBe('1')
        expect(ratioFromPercent('33.33333333333333333333')).toBe('0.333333333333333333')
        expect(() => ratioFromPercent(-1)).toThrow()
        expect(() => ratioFromPercent('abc')).toThrow()
        expect(percentFromRatio('0.400000000000000000')).toBe(40)
        expect(percentFromRatio('0.66')).toBe(66)
    })

    it('converts durations between days/hours, seconds and the gateway form', () => {
        expect(secondsFromDaysHours({ days: 3 })).toBe(259_200)
        expect(secondsFromDaysHours({ days: 1, hours: 2 })).toBe(93_600)
        expect(secondsFromDaysHours({ hours: 1 })).toBe(3600)
        expect(durationString(259_200)).toBe('259200s')
        expect(durationSeconds('259200s')).toBe(259_200)
        expect(durationSeconds('1.5s')).toBe(1.5)
        expect(() => durationSeconds('3d')).toThrow()
        expect(daysHoursFromDuration('262800s')).toEqual({ days: 3, hours: 1 })
        expect(durationFromSeconds(86_400)).toEqual({ seconds: 86_400n, nanos: 0 })
    })

    it('maps the gateway config to the protobuf one', () => {
        expect(daoConfigFromWire(CONFIG)).toEqual({
            minQuorum: '0.400000000000000000',
            threshold: '0.5',
            votingPeriod: { seconds: 259_200n, nanos: 0 },
            allowExpedite: true,
            expeditedPeriod: { seconds: 86_400n, nanos: 0 },
            expediteQuorum: '0.6',
            expediteThreshold: '0.66',
            openSubmission: false,
            proposalCost: undefined,
            proposalDeposit: { denom: 'ubze', amount: '1000000' },
            depositRefundPolicy: DepositRefundPolicy.ONLY_PASSED,
            costDestination: FundsDestination.BURN,
            keptDepositDestination: FundsDestination.TREASURY,
        })
    })
})

describe('message builders', () => {
    it('every builder uses a type URL the signing client has an encoder for', () => {
        const msgs = [
            buildCreateDaoMsg({ creator: ME, type: 'DAO_TYPE_STATIC_LIST', name: 'n', config: CONFIG, members: [ME] }),
            buildAdminExecuteMsg({ admin: ME, daoId: 1, msgs: [send()] }),
            buildNominateAdminMsg({ authority: ME, daoId: 1, nominee: '' }),
            buildAcceptAdminNominationMsg({ nominee: ME, daoId: 1 }),
            buildWithdrawAdminNominationMsg({ authority: ME, daoId: 1 }),
            buildSubmitProposalMsg({ proposer: ME, daoId: 1, title: 't' }),
            buildDaoVoteMsg({ voter: ME, proposalId: 1, option: 'YES' }),
            buildCancelDaoProposalMsg({ proposer: ME, proposalId: 1 }),
            buildSettleDaoProposalMsg({ sender: ME, proposalId: 1 }),
            buildCleanupDaoProposalMsg({ sender: ME, proposalId: 1 }),
            buildUpdateDaoConfigMsg({ daoAddress: DAO, daoId: 1, config: CONFIG }),
            buildUpdateDaoMetadataMsg({ daoAddress: DAO, daoId: 1, name: 'n', description: '' }),
            buildUpdateDaoElectorateMsg({ daoAddress: DAO, daoId: 1, electorate: null }),
            buildUpdateDaoMembersMsg({ daoAddress: DAO, daoId: 1, add: [ME] }),
        ]
        expect(msgs.map(m => m.typeUrl)).toEqual([
            '/bze.dao.MsgCreateDao', '/bze.dao.MsgAdminExecute', '/bze.dao.MsgNominateAdmin',
            '/bze.dao.MsgAcceptAdminNomination', '/bze.dao.MsgWithdrawAdminNomination', '/bze.dao.MsgSubmitProposal',
            '/bze.dao.MsgVote', '/bze.dao.MsgCancelProposal', '/bze.dao.MsgSettleProposal',
            '/bze.dao.MsgCleanupProposal', '/bze.dao.MsgUpdateDaoConfig', '/bze.dao.MsgUpdateMetadata',
            '/bze.dao.MsgUpdateElectorate', '/bze.dao.MsgUpdateMembers',
        ])
        for (const m of msgs) {
            expect(getMsgCodec(m.typeUrl), m.typeUrl).toBeDefined()
        }
    })

    it('MsgCreateDao (static list) carries every field and the full config to the chain', () => {
        const msg = buildCreateDaoMsg({
            creator: ME, admin: 'bze1admin', type: 'DAO_TYPE_STATIC_LIST', name: 'BZE builders',
            description: 'Funds tooling', config: CONFIG, members: [ME, 'bze1other'],
        })
        const decoded = roundTrip(MsgCreateDao, msg)

        expect(decoded).toEqual({
            creator: ME,
            admin: 'bze1admin',
            type: DaoType.DAO_TYPE_STATIC_LIST,
            name: 'BZE builders',
            description: 'Funds tooling',
            config: {
                minQuorum: '0.4',
                threshold: '0.5',
                votingPeriod: { seconds: 259_200n, nanos: 0 },
                allowExpedite: true,
                expeditedPeriod: { seconds: 86_400n, nanos: 0 },
                expediteQuorum: '0.6',
                expediteThreshold: '0.66',
                openSubmission: false,
                proposalDeposit: { denom: 'ubze', amount: '1000000' },
                depositRefundPolicy: DepositRefundPolicy.ONLY_PASSED,
                costDestination: FundsDestination.BURN,
                keptDepositDestination: FundsDestination.TREASURY,
            },
            members: [ME, 'bze1other'],
        })
    })

    it('MsgCreateDao (stake) carries the electorate and no members; a self-owned DAO has an empty admin', () => {
        const decoded = roundTrip(MsgCreateDao, buildCreateDaoMsg({
            creator: ME, type: 'DAO_TYPE_STAKE', name: 'Stakers', config: CONFIG,
            electorate: { sr_ids: ['3', '7'], dr_denom: 'ubze' },
        }))

        expect(decoded.type).toBe(DaoType.DAO_TYPE_STAKE)
        expect(decoded.admin).toBe('')
        expect(decoded.members).toEqual([])
        expect(decoded.electorate).toEqual({ srIds: ['3', '7'], drDenom: 'ubze' })
    })

    it('writes ratios as the chain\'s 18-decimal atomics', () => {
        const bytes = encodeMsgValue('/bze.dao.MsgUpdateDaoConfig', buildUpdateDaoConfigMsg({ daoAddress: DAO, daoId: 1, config: CONFIG }).value)
        const text = new TextDecoder().decode(bytes)
        expect(text).toContain('400000000000000000')
        expect(text).toContain('660000000000000000')
    })

    it('the admin and proposal messages keep the nested messages byte for byte', () => {
        const inner = [send('5'), buildUpdateDaoMetadataMsg({ daoAddress: DAO, daoId: 1, name: 'Bee Guild', description: '' })]

        const submitted = roundTrip(MsgSubmitProposal, buildSubmitProposalMsg({
            proposer: ME, daoId: '12', title: 'Fund tooling', summary: 'Pays the team', msgs: inner, expedited: true,
        }))
        expect(submitted).toMatchObject({ proposer: ME, daoId: 12n, title: 'Fund tooling', summary: 'Pays the team', expedited: true })
        expect(submitted.msgs.map(a => a.typeUrl)).toEqual(['/cosmos.bank.v1beta1.MsgSend', '/bze.dao.MsgUpdateMetadata'])
        expect(MsgSend.decode(submitted.msgs[0].value)).toEqual({ fromAddress: DAO, toAddress: ME, amount: [{ denom: 'ubze', amount: '5' }] })
        expect(MsgUpdateMetadata.decode(submitted.msgs[1].value)).toEqual({ authority: DAO, daoId: 1n, name: 'Bee Guild', description: '' })

        const executed = roundTrip(MsgAdminExecute, buildAdminExecuteMsg({ admin: ME, daoId: 4, msgs: [send('9')] }))
        expect(executed).toMatchObject({ admin: ME, daoId: 4n })
        expect(MsgSend.decode(executed.msgs[0].value).amount).toEqual([{ denom: 'ubze', amount: '9' }])
    })

    it('a signalling proposal has no messages and is not expedited by default', () => {
        const decoded = roundTrip(MsgSubmitProposal, buildSubmitProposalMsg({ proposer: ME, daoId: 1, title: 'Signal' }))
        expect(decoded).toEqual({ proposer: ME, daoId: 1n, title: 'Signal', summary: '', msgs: [], expedited: false })
    })

    it('admin handover messages', () => {
        expect(roundTrip(MsgNominateAdmin, buildNominateAdminMsg({ authority: ME, daoId: 2, nominee: 'bze1next' })))
            .toEqual({ authority: ME, daoId: 2n, nominee: 'bze1next' })
        expect(roundTrip(MsgNominateAdmin, buildNominateAdminMsg({ authority: DAO, daoId: 2, nominee: '' })))
            .toEqual({ authority: DAO, daoId: 2n, nominee: '' })
        expect(roundTrip(MsgAcceptAdminNomination, buildAcceptAdminNominationMsg({ nominee: ME, daoId: 2 })))
            .toEqual({ nominee: ME, daoId: 2n })
        expect(roundTrip(MsgWithdrawAdminNomination, buildWithdrawAdminNominationMsg({ authority: ME, daoId: 2 })))
            .toEqual({ authority: ME, daoId: 2n })
    })

    it('proposal lifecycle messages', () => {
        expect(roundTrip(MsgVote, buildDaoVoteMsg({ voter: ME, proposalId: 3, option: 'NO' })))
            .toEqual({ voter: ME, proposalId: 3n, option: VoteOption.NO })
        expect(roundTrip(MsgVote, buildDaoVoteMsg({ voter: ME, proposalId: 3, option: 'ABSTAIN' })).option).toBe(VoteOption.ABSTAIN)
        expect(roundTrip(MsgCancelProposal, buildCancelDaoProposalMsg({ proposer: ME, proposalId: 3 })))
            .toEqual({ proposer: ME, proposalId: 3n })
        expect(roundTrip(MsgSettleProposal, buildSettleDaoProposalMsg({ sender: ME, proposalId: 3 })))
            .toEqual({ sender: ME, proposalId: 3n })
        expect(roundTrip(MsgCleanupProposal, buildCleanupDaoProposalMsg({ sender: ME, proposalId: 3, limit: 50 })))
            .toEqual({ sender: ME, proposalId: 3n, limit: 50n })
        expect(roundTrip(MsgCleanupProposal, buildCleanupDaoProposalMsg({ sender: ME, proposalId: 3 })).limit).toBe(0n)
    })

    it('DAO-signed messages use the DAO address as the authority', () => {
        expect(roundTrip(MsgUpdateDaoConfig, buildUpdateDaoConfigMsg({ daoAddress: DAO, daoId: 1, config: CONFIG })))
            .toMatchObject({ authority: DAO, daoId: 1n, config: { minQuorum: '0.4', expediteThreshold: '0.66' } })
        expect(roundTrip(MsgUpdateElectorate, buildUpdateDaoElectorateMsg({ daoAddress: DAO, daoId: 1, electorate: { sr_ids: ['3'], dr_denom: '' } })))
            .toEqual({ authority: DAO, daoId: 1n, electorate: { srIds: ['3'], drDenom: '' } })
        expect(roundTrip(MsgUpdateMembers, buildUpdateDaoMembersMsg({ daoAddress: DAO, daoId: 1, add: ['bze1a'], remove: ['bze1b'] })))
            .toEqual({ authority: DAO, daoId: 1n, add: ['bze1a'], remove: ['bze1b'] })
    })
})

describe('packDaoMsgs and daoMsgsSize', () => {
    it('packs each message with the signing client\'s bytes, and round-trips', () => {
        const [any] = packDaoMsgs([send('42')])
        expect(any.typeUrl).toBe(MsgSend.typeUrl)
        expect(any.value).toEqual(encodeMsgValue(MsgSend.typeUrl, send('42').value))
        expect(MsgSend.decode(any.value).amount).toEqual([{ denom: 'ubze', amount: '42' }])
    })

    it('refuses a message type the ui-kit has no encoder for', () => {
        expect(() => packDaoMsgs([{ typeUrl: '/unknown.Msg', value: {} }])).toThrow('/unknown.Msg')
    })

    it('measures the sum of each Any\'s own encoding, as the chain does', () => {
        const anys = packDaoMsgs([send('1'), send('1000000')])
        const expected = anys.reduce((n, a) => n + Any.encode(a).finish().length, 0)
        expect(daoMsgsSize(anys)).toBe(expected)

        // type_url (tag + length + bytes) + value (tag + length + bytes)
        const first = anys[0]
        const typeUrlBytes = new TextEncoder().encode(first.typeUrl).length
        expect(Any.encode(first).finish().length).toBe(1 + 1 + typeUrlBytes + 1 + 1 + first.value.length)
        expect(daoMsgsSize([])).toBe(0)
    })
})
