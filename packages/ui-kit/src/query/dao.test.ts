import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The queries read the REST endpoint with a raw fetch; the settings are mocked so each test
// controls the endpoint and the wire response.
const { settingsMock } = vi.hoisted(() => ({ settingsMock: vi.fn() }))
vi.mock('../storage/settings', () => ({ getSettings: settingsMock }))

import {
    DaoModuleNotSupportedError,
    DaoQueryError,
    getDao,
    getDaoBallot,
    getDaoBallots,
    getDaoByAddress,
    getDaoController,
    getDaoJoinRecord,
    getDaoParams,
    getDaoProposal,
    getDaoProposals,
    getDaos,
    getDaosByAdmin,
    getDaoVotingPower,
    daoDenomRewardSource,
    daoStakingRewardSource,
    isDaoModuleSupported,
} from './dao'
import {
    ADDRESS,
    HAND_BALLOT,
    HAND_CONTROLLER,
    HAND_DAO,
    HAND_DAOS_PAGE,
    HAND_JOIN_RECORD,
    HAND_PROPOSAL_RESPONSE,
    HAND_VOTING_POWER,
    RECORDED_DAO_NOT_FOUND,
    RECORDED_EMPTY_BALLOTS,
    RECORDED_EMPTY_DAOS,
    RECORDED_EMPTY_PROPOSALS,
    RECORDED_INVALID_ADDRESS,
    RECORDED_INVALID_STATUS,
    RECORDED_INVALID_VOTER,
    RECORDED_MAINNET_501,
    RECORDED_NO_BALLOT,
    RECORDED_NO_DAO_OWNS,
    RECORDED_NO_JOIN_RECORD,
    RECORDED_PARAMS,
    RECORDED_PROPOSAL_NOT_FOUND,
} from './dao.fixtures'

// A fresh endpoint per test: isDaoModuleSupported remembers its answer per endpoint.
let endpointCount = 0
let REST = ''
const respond = (status: number, body: unknown) => ({ status, json: async () => body }) as Response

describe('x/dao queries', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        REST = `https://rest-${++endpointCount}.example`
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: REST } })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const calledUrl = () => fetchMock.mock.calls[0][0] as string

    describe('params', () => {
        it('reads the recorded params as the gateway sends them', async () => {
            fetchMock.mockResolvedValue(respond(200, RECORDED_PARAMS))

            const params = await getDaoParams()

            expect(calledUrl()).toBe(`${REST}/bze/dao/params`)
            expect(params.max_static_members).toBe('128')
            expect(params.min_voting_period).toBe('3600s')
            expect(params.min_electorate_lock_days).toBe(5)
            expect(params.dao_creation_fee).toEqual({ denom: 'ubze', amount: '50000000000' })
        })

        it('throws DaoModuleNotSupportedError on the 501 of a v8.2.x node', async () => {
            fetchMock.mockResolvedValue(respond(501, RECORDED_MAINNET_501))

            await expect(getDaoParams()).rejects.toBeInstanceOf(DaoModuleNotSupportedError)
        })

        it('throws when a 200 carries no params', async () => {
            fetchMock.mockResolvedValue(respond(200, {}))

            await expect(getDaoParams()).rejects.toBeInstanceOf(DaoQueryError)
        })
    })

    describe('single objects', () => {
        it('getDao returns the DAO, and null on the recorded NotFound', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, { dao: HAND_DAO }))
            expect(await getDao(1)).toEqual(HAND_DAO)
            expect(calledUrl()).toBe(`${REST}/bze/dao/dao/1`)

            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_DAO_NOT_FOUND))
            expect(await getDao(1n)).toBeNull()
        })

        it('getDaoByAddress returns null when no DAO owns the address and throws on an invalid one', async () => {
            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_NO_DAO_OWNS))
            expect(await getDaoByAddress(ADDRESS)).toBeNull()
            expect(calledUrl()).toBe(`${REST}/bze/dao/dao_by_address/${ADDRESS}`)

            fetchMock.mockResolvedValueOnce(respond(400, RECORDED_INVALID_ADDRESS))
            const error = await getDaoByAddress('notanaddress').catch(e => e)
            expect(error).toBeInstanceOf(DaoQueryError)
            expect(error.isInvalidArgument).toBe(true)
            expect(error.httpStatus).toBe(400)
            expect(error.message).toContain('invalid address')
        })

        it('getDaoController follows the admin chain, null for an unknown DAO', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, HAND_CONTROLLER))
            expect(await getDaoController('1')).toEqual(HAND_CONTROLLER)
            expect(calledUrl()).toBe(`${REST}/bze/dao/dao_controller/1`)

            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_DAO_NOT_FOUND))
            expect(await getDaoController('1')).toBeNull()
        })

        it('getDaoProposal returns the live status, null for an unknown or cleaned-up proposal', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, HAND_PROPOSAL_RESPONSE))
            const resp = await getDaoProposal(7)
            expect(calledUrl()).toBe(`${REST}/bze/dao/proposal/7`)
            expect(resp?.proposal.msgs[0]['@type']).toBe('/cosmos.bank.v1beta1.MsgSend')
            expect(resp?.expedite_settleable).toBe(true)
            expect(resp?.retry_deadline).toBe('0')

            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_PROPOSAL_NOT_FOUND))
            expect(await getDaoProposal(1)).toBeNull()
        })

        it('getDaoBallot returns the ballot, null without one and throws on an invalid voter', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, HAND_BALLOT))
            expect(await getDaoBallot(7, ADDRESS)).toEqual(HAND_BALLOT.ballot)
            expect(calledUrl()).toBe(`${REST}/bze/dao/ballot/7/${ADDRESS}`)

            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_NO_BALLOT))
            expect(await getDaoBallot(1, ADDRESS)).toBeNull()

            fetchMock.mockResolvedValueOnce(respond(400, RECORDED_INVALID_VOTER))
            await expect(getDaoBallot(1, 'bad')).rejects.toMatchObject({ isInvalidArgument: true })
        })

        it('getDaoVotingPower returns the power now and per open proposal, null for an unknown DAO', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, HAND_VOTING_POWER))
            expect(await getDaoVotingPower(1, ADDRESS)).toEqual(HAND_VOTING_POWER)
            expect(calledUrl()).toBe(`${REST}/bze/dao/voting_power/1/${ADDRESS}`)

            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_DAO_NOT_FOUND))
            expect(await getDaoVotingPower(1, ADDRESS)).toBeNull()
        })

        it('getDaoJoinRecord puts the source in the query string and returns null without a record', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, HAND_JOIN_RECORD))
            expect(await getDaoJoinRecord(daoStakingRewardSource('1'), ADDRESS)).toBe('4400000')
            expect(calledUrl()).toBe(`${REST}/bze/dao/join_record?source=sr%2F1&address=${ADDRESS}`)

            fetchMock.mockResolvedValueOnce(respond(404, RECORDED_NO_JOIN_RECORD))
            expect(await getDaoJoinRecord(daoDenomRewardSource('ubze'), ADDRESS)).toBeNull()
            expect(fetchMock.mock.calls[1][0]).toBe(`${REST}/bze/dao/join_record?source=dr%2Fubze&address=${ADDRESS}`)
        })

        it('throws a typed error on other failures instead of returning null', async () => {
            fetchMock.mockResolvedValueOnce(respond(500, { code: 13, message: 'internal' }))
            await expect(getDao(1)).rejects.toMatchObject({ httpStatus: 500, grpcCode: 13, message: 'internal' })

            fetchMock.mockRejectedValueOnce(new TypeError('network down'))
            await expect(getDao(1)).rejects.toThrow('network down')
        })

        it('throws on a 200 that is not JSON instead of reading it as a missing object or an empty list', async () => {
            const notJson = () => ({ status: 200, json: async () => { throw new SyntaxError('Unexpected token <') } }) as unknown as Response

            fetchMock.mockResolvedValueOnce(notJson())
            await expect(getDao(1)).rejects.toMatchObject({ httpStatus: 200 })

            fetchMock.mockResolvedValueOnce(notJson())
            await expect(getDaos()).rejects.toBeInstanceOf(DaoQueryError)
        })

        it('treats a 404 without the NotFound code as an error, not as a missing object', async () => {
            fetchMock.mockResolvedValueOnce(respond(404, '<html>no route</html>'))
            await expect(getDao(1)).rejects.toBeInstanceOf(DaoQueryError)
        })
    })

    describe('listings', () => {
        it('getDaos passes the pagination and returns the next key', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, HAND_DAOS_PAGE))

            const page = await getDaos({ limit: 2, key: 'AAAAAAAAAAE=', reverse: true })

            expect(calledUrl()).toBe(`${REST}/bze/dao/daos?pagination.key=AAAAAAAAAAE%3D&pagination.limit=2&pagination.reverse=true`)
            expect(page.items.map(d => d.id)).toEqual(['1', '2'])
            expect(page.nextKey).toBe('AAAAAAAAAAI=')
            expect(page.total).toBeUndefined()
        })

        it('reads the recorded empty listings, with the total when asked', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, RECORDED_EMPTY_DAOS))
            expect(await getDaos({ countTotal: true })).toEqual({ items: [], nextKey: null, total: '0' })
            expect(calledUrl()).toBe(`${REST}/bze/dao/daos?pagination.count_total=true`)

            fetchMock.mockResolvedValueOnce(respond(200, RECORDED_EMPTY_DAOS))
            expect(await getDaosByAdmin(ADDRESS)).toEqual({ items: [], nextKey: null })
            expect(fetchMock.mock.calls[1][0]).toBe(`${REST}/bze/dao/daos_by_admin/${ADDRESS}`)

            fetchMock.mockResolvedValueOnce(respond(200, RECORDED_EMPTY_BALLOTS))
            expect(await getDaoBallots(1, { limit: 50 })).toEqual({ items: [], nextKey: null })
            expect(fetchMock.mock.calls[2][0]).toBe(`${REST}/bze/dao/ballots/1?pagination.limit=50`)
        })

        it('getDaoProposals repeats statuses once per value, never as an array parameter', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, RECORDED_EMPTY_PROPOSALS))

            await getDaoProposals(1, ['VOTING', 'EXECUTION_FAILED', 'VOTING'], { limit: 5 })

            expect(calledUrl()).toBe(`${REST}/bze/dao/proposals/1?statuses=VOTING&statuses=EXECUTION_FAILED&pagination.limit=5`)
        })

        it('getDaoProposals without statuses lists every status', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, { proposals: [HAND_PROPOSAL_RESPONSE.proposal], pagination: { next_key: null, total: '0' } }))

            const page = await getDaoProposals('1')

            expect(calledUrl()).toBe(`${REST}/bze/dao/proposals/1`)
            expect(page.items).toHaveLength(1)
        })

        it('throws InvalidArgument for an unknown status (recorded)', async () => {
            fetchMock.mockResolvedValueOnce(respond(400, RECORDED_INVALID_STATUS))
            // @ts-expect-error the type refuses it; the chain does too
            await expect(getDaoProposals(1, ['BOGUS'])).rejects.toMatchObject({ isInvalidArgument: true })
        })

        it('throws DaoModuleNotSupportedError on a v8.2.x node', async () => {
            fetchMock.mockResolvedValueOnce(respond(501, RECORDED_MAINNET_501))
            await expect(getDaos()).rejects.toBeInstanceOf(DaoModuleNotSupportedError)
        })
    })

    describe('isDaoModuleSupported', () => {
        it('is true when the params answer, and asks only once per endpoint', async () => {
            fetchMock.mockResolvedValue(respond(200, RECORDED_PARAMS))

            expect(await isDaoModuleSupported()).toBe(true)
            expect(await isDaoModuleSupported()).toBe(true)
            expect(fetchMock).toHaveBeenCalledTimes(1)

            settingsMock.mockReturnValue({ endpoints: { restEndpoint: 'https://other.example' } })
            expect(await isDaoModuleSupported()).toBe(true)
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })

        it('is false on a 501 and remembers it', async () => {
            fetchMock.mockResolvedValue(respond(501, RECORDED_MAINNET_501))

            expect(await isDaoModuleSupported()).toBe(false)
            expect(await isDaoModuleSupported()).toBe(false)
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })

        it('does not remember a node that answers 200 without params', async () => {
            fetchMock.mockResolvedValueOnce(respond(200, {}))
            await expect(isDaoModuleSupported()).rejects.toBeInstanceOf(DaoQueryError)

            fetchMock.mockResolvedValueOnce(respond(200, RECORDED_PARAMS))
            expect(await isDaoModuleSupported()).toBe(true)
        })

        it('throws on a network failure and asks again next time', async () => {
            fetchMock.mockRejectedValueOnce(new TypeError('network down'))
            await expect(isDaoModuleSupported()).rejects.toThrow('network down')

            fetchMock.mockResolvedValueOnce(respond(200, RECORDED_PARAMS))
            expect(await isDaoModuleSupported()).toBe(true)
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })
    })
})
