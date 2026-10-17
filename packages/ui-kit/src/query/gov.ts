import {fromBase64} from "@interchainjs/encoding";
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";
import {ProposalStatus} from "@bze/bzejs/cosmos/gov/v1/gov";
import {getRestClient} from "./client";
import {GovParams, GovProposal, GovProposalsPage, GovProposalStatus, GovTally, GovVote} from "../types/gov";

// Gov v1 queries. Unlike the other query files these throw on a network or
// HTTP failure, so a page can show its error state instead of an empty list.
// Only the chain's "not found" answers become null.

const FINISHED_PAGE_SIZE = 10;
// Deposit-period proposals cost nothing to submit (min_initial_deposit_ratio
// is 0), so a page can be all of them: stop refilling after this many requests
// and let "older" continue from the key.
const FINISHED_MAX_REQUESTS = 10;
const OPEN_LIMIT = 50;

const FINISHED_STATUSES: GovProposalStatus[] = [
    'PROPOSAL_STATUS_PASSED',
    'PROPOSAL_STATUS_REJECTED',
    'PROPOSAL_STATUS_FAILED',
];

// The LCD client is typed with the decoded protobuf shapes, but it returns the
// chain's JSON as is; see types/gov.ts.
const wire = <T>(value: unknown): T => value as T;

/** Whether `e` is the chain's answer with this HTTP status and gRPC code. */
const isChainError = (e: unknown, httpStatus: number, grpcCode: number): boolean => {
    const response = (e as {response?: {status?: number; data?: {code?: number; message?: string}}})?.response;
    return response?.status === httpStatus && response.data?.code === grpcCode;
};

const errorMessage = (e: unknown): string =>
    (e as {response?: {data?: {message?: string}}})?.response?.data?.message ?? '';

/** The gov v1 params (the tallying route answers with all of them). */
export const getGovParams = async (): Promise<GovParams> => {
    const client = await getRestClient();
    const response = await client.cosmos.gov.v1.params({paramsType: 'tallying'});

    return wire<{params: GovParams}>(response).params;
}

/** Every proposal in its voting period. */
export const getOpenProposals = async (): Promise<GovProposal[]> => {
    const client = await getRestClient();
    const response = await client.cosmos.gov.v1.proposals({
        proposalStatus: ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD,
        voter: '',
        depositor: '',
        pagination: PageRequest.fromPartial({limit: BigInt(OPEN_LIMIT)}),
    });

    return wire<{proposals: GovProposal[]}>(response).proposals ?? [];
}

/**
 * Finished proposals (passed, rejected, failed), newest first, ten per page.
 * Pages holding open or deposit-period proposals are refilled from the next
 * key. Pass the returned `nextKey` back for the older page.
 */
export const getFinishedProposals = async (key?: Uint8Array): Promise<GovProposalsPage> => {
    const client = await getRestClient();
    const proposals: GovProposal[] = [];
    let nextKey: Uint8Array | null = key ?? null;

    for (let requests = 0; requests < FINISHED_MAX_REQUESTS; requests++) {
        const response = wire<{proposals: GovProposal[]; pagination?: {next_key?: string | null}}>(
            await client.cosmos.gov.v1.proposals({
                proposalStatus: ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED,
                voter: '',
                depositor: '',
                pagination: PageRequest.fromPartial({
                    limit: BigInt(FINISHED_PAGE_SIZE),
                    reverse: true,
                    ...(nextKey ? {key: nextKey} : {}),
                }),
            })
        );

        proposals.push(...(response.proposals ?? []).filter(p => FINISHED_STATUSES.includes(p.status)));
        const rawKey = response.pagination?.next_key;
        nextKey = rawKey ? fromBase64(rawKey) : null;

        if (proposals.length >= FINISHED_PAGE_SIZE || !nextKey) {
            break;
        }
    }

    return {proposals, nextKey};
}

/** One proposal; null when the chain doesn't have it. */
export const getProposal = async (id: string | number | bigint): Promise<GovProposal | null> => {
    const client = await getRestClient();
    try {
        const response = await client.cosmos.gov.v1.proposal({proposalId: BigInt(id)});

        return wire<{proposal: GovProposal}>(response).proposal;
    } catch (e) {
        // 404, code 5: "proposal N doesn't exist".
        if (isChainError(e, 404, 5)) return null;
        throw e;
    }
}

/** The live tally of an open proposal. */
export const getProposalTally = async (id: string | number | bigint): Promise<GovTally> => {
    const client = await getRestClient();
    const response = await client.cosmos.gov.v1.tallyResult({proposalId: BigInt(id)});

    return wire<{tally: GovTally}>(response).tally;
}

/** The voter's vote on a proposal; null when they haven't voted (or the vote was cleared at tally). */
export const getProposalVote = async (id: string | number | bigint, voter: string): Promise<GovVote | null> => {
    const client = await getRestClient();
    try {
        const response = await client.cosmos.gov.v1.vote({proposalId: BigInt(id), voter});

        return wire<{vote: GovVote}>(response).vote;
    } catch (e) {
        // 400, code 3: "voter: <addr> not found for proposal: <id>".
        if (isChainError(e, 400, 3) && errorMessage(e).includes('not found')) return null;
        throw e;
    }
}
