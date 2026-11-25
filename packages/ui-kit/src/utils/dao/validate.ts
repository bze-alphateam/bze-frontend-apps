import BigNumber from "bignumber.js";
import {fromBech32} from "@interchainjs/encoding";
import {getChainAddressPrefix} from "../../constants/chain";
import {DaoConfig, DaoParams, DaoStakeElectorate} from "../../types/dao";
import {durationSeconds} from "./msgs";

// Client-side mirrors of the x/dao rules (chain v8.3.0), so a form can show the
// reason before the user signs. The chain stays authoritative. Each check keeps
// the chain's boundary: `x/dao/types` ValidateBasic / DaoConfig.Validate /
// ValidatePeriods and the msg-server param caps. Lengths are UTF-8 bytes, as
// Go's len(string).
//
// Every validator returns the first problem as a plain sentence, or undefined
// when the input passes.

export const DAO_MAX_NAME_BYTES = 64;
export const DAO_MAX_DESCRIPTION_BYTES = 2_000;

const encoder = new TextEncoder();

/** The UTF-8 byte length the chain measures (`"é"` is 2). */
export const utf8Length = (text: string): number => encoder.encode(text).length;

/**
 * The canonical (lowercase) form of a valid address of this chain, or
 * undefined. Bech32 is case-insensitive, so `BZE1…` and `bze1…` are the same
 * address, as the chain's AccAddressFromBech32 reads them.
 */
const canonicalAddress = (address: string): string | undefined => {
    try {
        const {prefix} = fromBech32(address);
        return prefix.toLowerCase() === getChainAddressPrefix() ? address.toLowerCase() : undefined;
    } catch {
        return undefined;
    }
}

export const validateDaoName = (name: string): string | undefined => {
    const bytes = utf8Length(name);
    if (bytes === 0) return 'Enter a name.';
    if (bytes > DAO_MAX_NAME_BYTES) return `The name can have at most ${DAO_MAX_NAME_BYTES} bytes (it has ${bytes}).`;
    return undefined;
}

export const validateDaoDescription = (description: string): string | undefined => {
    const bytes = utf8Length(description);
    if (bytes > DAO_MAX_DESCRIPTION_BYTES) {
        return `The description can have at most ${DAO_MAX_DESCRIPTION_BYTES.toLocaleString('en-US')} bytes (it has ${bytes.toLocaleString('en-US')}).`;
    }
    return undefined;
}

const PLAIN_DECIMAL = /^\d+(\.\d{1,18})?$/;

const ratio = (value: string): BigNumber | undefined =>
    PLAIN_DECIMAL.test(value) ? new BigNumber(value) : undefined;

const LABELS = {
    min_quorum: 'The quorum',
    threshold: 'The threshold',
    expedite_quorum: 'The expedite quorum',
    expedite_threshold: 'The expedite threshold',
} as const;

/** A quorum in (0, 1], a threshold in (0, 1): a threshold must be exceeded, so 1 could never pass. */
const checkRatio = (field: keyof typeof LABELS, value: string, isThreshold: boolean): string | undefined => {
    const v = ratio(value);
    const range = isThreshold ? 'above 0% and below 100%' : 'above 0% and at most 100%';
    if (!v || !v.isGreaterThan(0) || (isThreshold ? v.isGreaterThanOrEqualTo(1) : v.isGreaterThan(1))) {
        return `${LABELS[field]} must be ${range}.`;
    }
    return undefined;
}

const checkCoin = (label: string, c?: {denom: string; amount: string} | null): string | undefined => {
    if (!c) return undefined;
    if (!/^[a-zA-Z][a-zA-Z0-9/:._-]{2,127}$/.test(c.denom)) return `${label} needs a valid token.`;
    if (!/^\d+$/.test(c.amount)) return `${label} must be a whole, non-negative amount.`;
    return undefined;
}

const formatPeriod = (seconds: number): string => {
    if (seconds % 86_400 === 0) return `${seconds / 86_400} day${seconds === 86_400 ? '' : 's'}`;
    if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
    return `${seconds} seconds`;
}

/**
 * The config rules of MsgCreateDao and MsgUpdateDaoConfig. The expedite fields
 * are checked even when `allow_expedite` is off; the periods against the
 * current params' `[min_voting_period, max_voting_period]`.
 */
export const validateDaoConfig = (config: DaoConfig, params: Pick<DaoParams, 'min_voting_period' | 'max_voting_period'>): string | undefined => {
    const ratioError =
        checkRatio('min_quorum', config.min_quorum, false) ??
        checkRatio('threshold', config.threshold, true) ??
        checkRatio('expedite_quorum', config.expedite_quorum, false) ??
        checkRatio('expedite_threshold', config.expedite_threshold, true);
    if (ratioError) return ratioError;

    if (new BigNumber(config.expedite_quorum).isLessThan(config.min_quorum)) {
        return 'The expedite quorum cannot be lower than the quorum.';
    }
    if (new BigNumber(config.expedite_threshold).isLessThan(config.threshold)) {
        return 'The expedite threshold cannot be lower than the threshold.';
    }

    let voting: number, expedited: number, min: number, max: number;
    try {
        voting = durationSeconds(config.voting_period);
        expedited = durationSeconds(config.expedited_period);
        min = durationSeconds(params.min_voting_period);
        max = durationSeconds(params.max_voting_period);
    } catch {
        return 'Enter valid voting periods.';
    }
    if (expedited > voting) {
        return 'The expedited period cannot be longer than the voting period.';
    }
    for (const [label, value] of [['voting period', voting], ['expedited period', expedited]] as const) {
        if (value < min || value > max) {
            return `The ${label} must be between ${formatPeriod(min)} and ${formatPeriod(max)}.`;
        }
    }

    return checkCoin('The proposal cost', config.proposal_cost) ?? checkCoin('The proposal deposit', config.proposal_deposit);
}

/**
 * Static-list members: 1 to `max_static_members` unique valid addresses (the
 * same address in another case is a duplicate), never the DAO's own address
 * (pass it when known).
 */
export const validateDaoMembers = (
    members: string[],
    params: Pick<DaoParams, 'max_static_members'>,
    daoAddress?: string,
): string | undefined => {
    if (members.length === 0) return 'Add at least one member.';
    const max = Number(params.max_static_members);
    if (members.length > max) return `A member list can have at most ${max} members (it has ${members.length}).`;

    const seen = new Set<string>();
    const dao = daoAddress?.toLowerCase();
    for (const member of members) {
        const key = canonicalAddress(member);
        if (!key) return `${member} is not a valid address.`;
        if (seen.has(key)) return `${member} is listed twice.`;
        if (key === dao) return 'The DAO cannot be a member of itself.';
        seen.add(key);
    }
    return undefined;
}

/**
 * MsgUpdateMembers: at least one change, unique valid addresses in each list,
 * no address in both. `currentMembers` (the DAO's list) adds the state checks:
 * an added address is not a member yet nor the DAO, a removed one is a member,
 * and the result keeps 1 to `max_static_members` members.
 */
export const validateDaoMemberChanges = (
    changes: {add: string[]; remove: string[]},
    current: {members: string[]; daoAddress: string},
    params: Pick<DaoParams, 'max_static_members'>,
): string | undefined => {
    if (changes.add.length === 0 && changes.remove.length === 0) return 'Add or remove at least one member.';

    const unique = (list: string[], verb: string): Set<string> | string => {
        const set = new Set<string>();
        for (const a of list) {
            const key = canonicalAddress(a);
            if (!key) return `${a} is not a valid address.`;
            if (set.has(key)) return `${a} is ${verb} twice.`;
            set.add(key);
        }
        return set;
    };
    const added = unique(changes.add, 'added');
    if (typeof added === 'string') return added;
    const removed = unique(changes.remove, 'removed');
    if (typeof removed === 'string') return removed;
    for (const r of changes.remove) {
        if (added.has(r.toLowerCase())) return `${r} is both added and removed.`;
    }

    const members = new Set(current.members.map(m => m.toLowerCase()));
    for (const a of changes.add) {
        const key = a.toLowerCase();
        if (key === current.daoAddress.toLowerCase()) return 'The DAO cannot be a member of itself.';
        if (members.has(key)) return `${a} is already a member.`;
    }
    for (const r of changes.remove) {
        if (!members.has(r.toLowerCase())) return `${r} is not a member.`;
    }

    const size = members.size + added.size - removed.size;
    if (size < 1) return 'The DAO must keep at least one member.';
    const max = Number(params.max_static_members);
    if (size > max) return `A member list can have at most ${max} members (it would have ${size}).`;
    return undefined;
}

/**
 * A stake electorate: at most `max_sr_per_dao` unique, non-empty staking reward
 * ids and an optional Denom Reward denom. Whether the sources exist, share one
 * staking denom and lock long enough is checked by the chain (state).
 */
export const validateDaoElectorate = (
    electorate: DaoStakeElectorate | null | undefined,
    params: Pick<DaoParams, 'max_sr_per_dao'>,
): string | undefined => {
    if (!electorate) return undefined;
    const max = Number(params.max_sr_per_dao);
    const seen = new Set<string>();
    for (const id of electorate.sr_ids) {
        if (id === '') return 'A staking reward id is empty.';
        if (seen.has(id)) return `Staking reward ${id} is listed twice.`;
        seen.add(id);
    }
    if (electorate.sr_ids.length > max) {
        return `A DAO can vote with at most ${max} staking rewards (it has ${electorate.sr_ids.length}).`;
    }
    if (electorate.dr_denom !== '' && !/^[a-zA-Z][a-zA-Z0-9/:._-]{2,127}$/.test(electorate.dr_denom)) {
        return `${electorate.dr_denom} is not a valid token for a Denom Reward.`;
    }
    return undefined;
}

/**
 * Proposal content: title 1 to `max_title_len` bytes, summary up to
 * `max_summary_len` bytes, 0 to `max_msgs_per_proposal` messages taking at most
 * `max_proposal_bytes` (pass `daoMsgsSize` of the packed messages).
 */
export const validateDaoProposalContent = (
    content: {title: string; summary: string; msgCount: number; msgsSize: number},
    params: Pick<DaoParams, 'max_title_len' | 'max_summary_len' | 'max_msgs_per_proposal' | 'max_proposal_bytes'>,
): string | undefined => {
    const title = utf8Length(content.title);
    const maxTitle = Number(params.max_title_len);
    if (title === 0) return 'Enter a title.';
    if (title > maxTitle) return `The title can have at most ${maxTitle} bytes (it has ${title}).`;

    const summary = utf8Length(content.summary);
    const maxSummary = Number(params.max_summary_len);
    if (summary > maxSummary) return `The summary can have at most ${maxSummary} bytes (it has ${summary}).`;

    const maxMsgs = Number(params.max_msgs_per_proposal);
    if (content.msgCount > maxMsgs) return `A proposal can run at most ${maxMsgs} actions (it has ${content.msgCount}).`;

    const maxBytes = Number(params.max_proposal_bytes);
    if (content.msgsSize > maxBytes) {
        return `The actions take ${content.msgsSize.toLocaleString('en-US')} bytes, at most ${maxBytes.toLocaleString('en-US')} are allowed.`;
    }
    return undefined;
}

/**
 * MsgAdminExecute's messages: 1 to `max_msgs_per_proposal`, at most
 * `max_proposal_bytes` packed.
 */
export const validateDaoAdminExecute = (
    content: {msgCount: number; msgsSize: number},
    params: Pick<DaoParams, 'max_msgs_per_proposal' | 'max_proposal_bytes'>,
): string | undefined => {
    if (content.msgCount === 0) return 'Add at least one action.';
    const maxMsgs = Number(params.max_msgs_per_proposal);
    if (content.msgCount > maxMsgs) return `At most ${maxMsgs} actions can run at once (there are ${content.msgCount}).`;
    const maxBytes = Number(params.max_proposal_bytes);
    if (content.msgsSize > maxBytes) {
        return `The actions take ${content.msgsSize.toLocaleString('en-US')} bytes, at most ${maxBytes.toLocaleString('en-US')} are allowed.`;
    }
    return undefined;
}
