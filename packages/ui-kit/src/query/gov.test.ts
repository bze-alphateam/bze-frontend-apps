import {beforeEach, describe, expect, it, vi} from 'vitest'
import {toBase64} from '@interchainjs/encoding'

const {gov} = vi.hoisted(() => ({
    gov: {
        params: vi.fn(),
        proposals: vi.fn(),
        proposal: vi.fn(),
        tallyResult: vi.fn(),
        vote: vi.fn(),
    },
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({cosmos: {gov: {v1: gov}}}),
}))

import {
    getFinishedProposals,
    getGovParams,
    getOpenProposals,
    getProposal,
    getProposalTally,
    getProposalVote,
} from './gov'

// An axios error as the LCD client rejects with it.
const httpError = (status: number, code: number, message: string) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
        response: {status, data: {code, message, details: []}},
    })

const proposal = (id: number, status: string) => ({id: String(id), status, messages: [], title: `P${id}`})

const page = (proposals: unknown[], nextKey: string | null) => ({
    proposals,
    pagination: {next_key: nextKey, total: '0'},
})

beforeEach(() => {
    for (const fn of Object.values(gov)) fn.mockReset()
})

describe('getGovParams', () => {
    it('returns the params of the tallying route', async () => {
        gov.params.mockResolvedValue({params: {quorum: '0.334'}, voting_params: null})

        await expect(getGovParams()).resolves.toEqual({quorum: '0.334'})
        expect(gov.params).toHaveBeenCalledWith({paramsType: 'tallying'})
    })

    it('throws when the node fails', async () => {
        gov.params.mockRejectedValue(new Error('Network Error'))

        await expect(getGovParams()).rejects.toThrow('Network Error')
    })
})

describe('getOpenProposals', () => {
    it('asks for the voting-period proposals', async () => {
        gov.proposals.mockResolvedValue(page([proposal(48, 'PROPOSAL_STATUS_VOTING_PERIOD')], null))

        const open = await getOpenProposals()

        expect(open.map(p => p.id)).toEqual(['48'])
        expect(gov.proposals.mock.calls[0][0].proposalStatus).toBe(2)
    })

    it('throws on a network error', async () => {
        gov.proposals.mockRejectedValue(new Error('timeout of 10000ms exceeded'))

        await expect(getOpenProposals()).rejects.toThrow('timeout')
    })
})

describe('getFinishedProposals', () => {
    it('keeps only passed, rejected and failed proposals, newest first', async () => {
        gov.proposals.mockResolvedValue(page([
            proposal(50, 'PROPOSAL_STATUS_DEPOSIT_PERIOD'),
            proposal(49, 'PROPOSAL_STATUS_VOTING_PERIOD'),
            proposal(48, 'PROPOSAL_STATUS_PASSED'),
            proposal(47, 'PROPOSAL_STATUS_REJECTED'),
            proposal(46, 'PROPOSAL_STATUS_FAILED'),
        ], null))

        const result = await getFinishedProposals()

        expect(result.proposals.map(p => p.id)).toEqual(['48', '47', '46'])
        expect(result.nextKey).toBeNull()
        const request = gov.proposals.mock.calls[0][0]
        expect(request.pagination.reverse).toBe(true)
        expect(request.pagination.limit).toBe(BigInt(10))
    })

    it('refills a short page from the next key until it has ten', async () => {
        const passed = (from: number, n: number) =>
            Array.from({length: n}, (_, i) => proposal(from - i, 'PROPOSAL_STATUS_PASSED'))
        gov.proposals
            .mockResolvedValueOnce(page([proposal(60, 'PROPOSAL_STATUS_DEPOSIT_PERIOD'), ...passed(59, 9)], 'AAAAAAAAADI='))
            .mockResolvedValueOnce(page(passed(50, 10), 'AAAAAAAAACg='))

        const result = await getFinishedProposals()

        expect(gov.proposals).toHaveBeenCalledTimes(2)
        // The second request continues from the first page's key.
        expect(toBase64(gov.proposals.mock.calls[1][0].pagination.key)).toBe('AAAAAAAAADI=')
        expect(result.proposals).toHaveLength(19)
        expect(result.nextKey && toBase64(result.nextKey)).toBe('AAAAAAAAACg=')
    })

    it('continues from the key it is given', async () => {
        gov.proposals.mockResolvedValue(page([proposal(5, 'PROPOSAL_STATUS_PASSED')], null))

        await getFinishedProposals(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 6]))

        expect(toBase64(gov.proposals.mock.calls[0][0].pagination.key)).toBe('AAAAAAAAAAY=')
    })

    it('stops after ten requests when every page is unfinished proposals', async () => {
        gov.proposals.mockResolvedValue(page([proposal(9, 'PROPOSAL_STATUS_DEPOSIT_PERIOD')], 'AAAAAAAAAAk='))

        const result = await getFinishedProposals()

        expect(gov.proposals).toHaveBeenCalledTimes(10)
        expect(result.proposals).toEqual([])
        expect(result.nextKey).not.toBeNull()
    })
})

describe('getProposal', () => {
    it('returns the proposal', async () => {
        gov.proposal.mockResolvedValue({proposal: proposal(48, 'PROPOSAL_STATUS_VOTING_PERIOD')})

        await expect(getProposal('48')).resolves.toMatchObject({id: '48'})
        expect(gov.proposal).toHaveBeenCalledWith({proposalId: BigInt(48)})
    })

    it('returns null when the chain answers 404 code 5', async () => {
        gov.proposal.mockRejectedValue(httpError(404, 5, "proposal 9999 doesn't exist"))

        await expect(getProposal(9999)).resolves.toBeNull()
    })

    it('throws on any other failure', async () => {
        gov.proposal.mockRejectedValue(httpError(502, 13, 'bad gateway'))

        await expect(getProposal(1)).rejects.toThrow()
    })
})

describe('getProposalTally', () => {
    it('returns the live tally', async () => {
        const tally = {yes_count: '1', abstain_count: '0', no_count: '0', no_with_veto_count: '0'}
        gov.tallyResult.mockResolvedValue({tally})

        await expect(getProposalTally(48)).resolves.toEqual(tally)
    })
})

describe('getProposalVote', () => {
    it('returns the vote', async () => {
        const vote = {proposal_id: '48', voter: 'bze1abc', options: [{option: 'VOTE_OPTION_YES', weight: '1.0'}], metadata: ''}
        gov.vote.mockResolvedValue({vote})

        await expect(getProposalVote(48, 'bze1abc')).resolves.toEqual(vote)
        expect(gov.vote).toHaveBeenCalledWith({proposalId: BigInt(48), voter: 'bze1abc'})
    })

    it('returns null when the chain answers 400 code 3 "not found"', async () => {
        gov.vote.mockRejectedValue(httpError(400, 3, 'voter: bze1abc not found for proposal: 48'))

        await expect(getProposalVote(48, 'bze1abc')).resolves.toBeNull()
    })

    it('throws on another invalid-argument answer', async () => {
        gov.vote.mockRejectedValue(httpError(400, 3, 'invalid voter address: decoding bech32 failed'))

        await expect(getProposalVote(48, 'nope')).rejects.toThrow()
    })

    it('throws on a network error', async () => {
        gov.vote.mockRejectedValue(new Error('Network Error'))

        await expect(getProposalVote(48, 'bze1abc')).rejects.toThrow('Network Error')
    })
})
