import BigNumber from "bignumber.js";
import {EncodeObject} from "@bze/bzejs/types";
import {Any} from "@bze/bzejs/google/protobuf/any";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import {Duration} from "@bze/bzejs/google/protobuf/duration";
import {
    DaoConfig as DaoConfigProto,
    DaoType as DaoTypeProto,
    DepositRefundPolicy,
    FundsDestination,
    StakeElectorate,
    VoteOption,
} from "@bze/bzejs/bze/dao/store";
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
} from "@bze/bzejs/bze/dao/tx";
import {encodeMsgValue} from "../signing_client_setup";
import {
    DaoConfig,
    DaoDepositRefundPolicy,
    DaoFundsDestination,
    DaoStakeElectorate,
    DaoType,
    DaoVoteOption,
} from "../../types/dao";

// x/dao message builders (chain v8.3.0). Each returns the EncodeObject a
// wallet signs (`useTx`'s `tx([...], daoTxOptions)`) or, for the messages
// only the DAO account can sign, the message to pack into a proposal or a
// MsgAdminExecute with `packDaoMsgs`.
//
// Ratios are plain decimals ("0.4"; the encoder writes the chain's 18-decimal
// atomics) and periods are protobuf Durations; see the config helpers below.

/**
 * Sign options for every x/dao transaction: direct (protobuf) signing, and no
 * signing at all when the fee simulation fails.
 *
 * Direct: DAO messages carry nested `Any` messages and configs whose zero-valued
 * enums and bools have no `amino.dont_omitempty`, so the amino JSON the wallet
 * signs can differ from the bytes the chain rebuilds. That is the bug class
 * behind the 2026-09 IBC amino outage (see `ibcTransferTxOptions`). Enable amino
 * for a DAO message type only after an amino-signed tx of that exact type has
 * succeeded on a v8.3.0 chain. Until then Ledger users cannot sign DAO txs.
 *
 * Abort on simulation error: a refused DAO tx must never be signed with the
 * fixed fallback fee, it would only burn the fee.
 */
export const daoTxOptions = {
    useDirectSign: true,
    abortOnSimulationError: true,
} as const;

const TYPE: Record<DaoType, DaoTypeProto> = {
    DAO_TYPE_STATIC_LIST: DaoTypeProto.DAO_TYPE_STATIC_LIST,
    DAO_TYPE_STAKE: DaoTypeProto.DAO_TYPE_STAKE,
};

const REFUND: Record<DaoDepositRefundPolicy, DepositRefundPolicy> = {
    ALWAYS: DepositRefundPolicy.ALWAYS,
    ONLY_PASSED: DepositRefundPolicy.ONLY_PASSED,
    NEVER: DepositRefundPolicy.NEVER,
};

const DESTINATION: Record<DaoFundsDestination, FundsDestination> = {
    BURN: FundsDestination.BURN,
    TREASURY: FundsDestination.TREASURY,
};

const VOTE: Record<Exclude<DaoVoteOption, 'VOTE_OPTION_UNSPECIFIED'>, VoteOption> = {
    YES: VoteOption.YES,
    NO: VoteOption.NO,
    ABSTAIN: VoteOption.ABSTAIN,
};

type Id = string | number | bigint;

/** The protobuf enum value of a gateway enum name; throws on a name the chain doesn't have. */
const enumValue = <K extends string, V>(map: Record<K, V>, name: string, field: string): V => {
    if (!Object.prototype.hasOwnProperty.call(map, name)) {
        throw new Error(`unknown ${field}: ${name}`);
    }
    return map[name as K];
}

const toId = (id: Id): bigint => BigInt(id.toString());

// ---------------------------------------------------------------------------
// Config input helpers

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const RATIO_DECIMALS = 18;

/**
 * A ratio from a percentage: `40` → `"0.4"`. At most 18 decimals survive (the
 * chain's precision); throws on a non-finite or negative input.
 */
export const ratioFromPercent = (percent: number | string): string => {
    const value = new BigNumber(percent);
    if (!value.isFinite() || value.isNegative()) {
        throw new Error(`invalid percentage: ${percent}`);
    }
    return value.dividedBy(100).decimalPlaces(RATIO_DECIMALS, BigNumber.ROUND_DOWN).toFixed();
}

/** A percentage from a ratio, as the chain or the builders write it: `"0.400000000000000000"` → `40`. */
export const percentFromRatio = (ratio: string): number => new BigNumber(ratio).multipliedBy(100).toNumber();

/** Seconds from days and hours: `{days: 3}` → `259200`. */
export const secondsFromDaysHours = ({days = 0, hours = 0}: {days?: number; hours?: number}): number =>
    Math.round(days * SECONDS_PER_DAY + hours * SECONDS_PER_HOUR);

/** The gateway form of a duration: `259200` → `"259200s"`. */
export const durationString = (seconds: number): string => `${Math.trunc(seconds)}s`;

/** Seconds from the gateway form (`"259200s"`, also `"1.5s"`); throws on anything else. */
export const durationSeconds = (duration: string): number => {
    const match = /^(\d+)(?:\.(\d+))?s$/.exec(duration);
    if (!match) {
        throw new Error(`invalid duration: ${duration}`);
    }
    return Number(match[1]) + (match[2] ? Number(`0.${match[2]}`) : 0);
}

/** Whole days and the hours left over, for display: `"262800s"` → `{days: 3, hours: 1}`. */
export const daysHoursFromDuration = (duration: string): {days: number; hours: number} => {
    const seconds = durationSeconds(duration);
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    return {days, hours: Math.floor((seconds - days * SECONDS_PER_DAY) / SECONDS_PER_HOUR)};
}

/** A protobuf Duration from seconds; a fraction is kept as nanoseconds. */
export const durationFromSeconds = (seconds: number): Duration => {
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error(`invalid duration: ${seconds}`);
    }
    const whole = Math.trunc(seconds);
    return {seconds: BigInt(whole), nanos: Math.round((seconds - whole) * 1e9)};
}

const coin = (c?: {denom: string; amount: string} | null): Coin | undefined =>
    c ? {denom: c.denom, amount: c.amount} : undefined;

/**
 * The protobuf config from its gateway JSON (a `Dao.config` the chain sent, or
 * one a form filled in). Ratios keep their decimal strings, periods become
 * Durations, enums their numbers (an unknown enum name throws instead of
 * encoding the default). The config coins stay unset when null.
 */
export const daoConfigFromWire = (config: DaoConfig): DaoConfigProto => ({
    minQuorum: config.min_quorum,
    threshold: config.threshold,
    votingPeriod: durationFromSeconds(durationSeconds(config.voting_period)),
    allowExpedite: config.allow_expedite,
    expeditedPeriod: durationFromSeconds(durationSeconds(config.expedited_period)),
    expediteQuorum: config.expedite_quorum,
    expediteThreshold: config.expedite_threshold,
    openSubmission: config.open_submission,
    proposalCost: coin(config.proposal_cost),
    proposalDeposit: coin(config.proposal_deposit),
    depositRefundPolicy: enumValue(REFUND, config.deposit_refund_policy, 'deposit_refund_policy'),
    costDestination: enumValue(DESTINATION, config.cost_destination, 'cost_destination'),
    keptDepositDestination: enumValue(DESTINATION, config.kept_deposit_destination, 'kept_deposit_destination'),
});

const electorateFromWire = (electorate?: DaoStakeElectorate | null): StakeElectorate | undefined =>
    electorate ? {srIds: [...electorate.sr_ids], drDenom: electorate.dr_denom} : undefined;

// ---------------------------------------------------------------------------
// Nested messages

/**
 * Pack messages for the `msgs` of MsgSubmitProposal / MsgAdminExecute: each
 * becomes an `Any` with the same protobuf bytes the signing client would
 * produce for it. Throws for a message type the ui-kit doesn't register.
 */
export const packDaoMsgs = (msgs: EncodeObject[]): Any[] =>
    msgs.map(m => Any.fromPartial({typeUrl: m.typeUrl, value: encodeMsgValue(m.typeUrl, m.value)}));

/**
 * The packed size the chain compares with `max_proposal_bytes`: the sum of
 * each `Any`'s own encoding (type URL plus value, with their field tags).
 */
export const daoMsgsSize = (anys: Any[]): number =>
    anys.reduce((size, any) => size + Any.encode(any).finish().length, 0);

// ---------------------------------------------------------------------------
// Messages a wallet signs

export const buildCreateDaoMsg = (p: {
    creator: string;
    /** Empty for a DAO that owns itself. */
    admin?: string;
    type: DaoType;
    name: string;
    description?: string;
    config: DaoConfig;
    /** Static-list DAOs only. */
    members?: string[];
    /** Stake DAOs only. */
    electorate?: DaoStakeElectorate | null;
}): EncodeObject => ({
    typeUrl: MsgCreateDao.typeUrl,
    value: MsgCreateDao.fromPartial({
        creator: p.creator,
        admin: p.admin ?? '',
        type: enumValue(TYPE, p.type, 'dao type'),
        name: p.name,
        description: p.description ?? '',
        config: daoConfigFromWire(p.config),
        members: p.members ?? [],
        electorate: electorateFromWire(p.electorate),
    }),
});

/** The external admin runs messages as the DAO (they must be signed by the DAO account only). */
export const buildAdminExecuteMsg = (p: {admin: string; daoId: Id; msgs: EncodeObject[]}): EncodeObject => ({
    typeUrl: MsgAdminExecute.typeUrl,
    value: {admin: p.admin, daoId: toId(p.daoId), msgs: packDaoMsgs(p.msgs)} satisfies MsgAdminExecute,
});

/**
 * Nominate a new admin, or hand the DAO to its voters with an empty nominee.
 * `authority` is the current admin: a person signs it directly; when the admin
 * is the DAO itself (or a parent DAO) the message goes into a proposal.
 */
export const buildNominateAdminMsg = (p: {authority: string; daoId: Id; nominee: string}): EncodeObject => ({
    typeUrl: MsgNominateAdmin.typeUrl,
    value: MsgNominateAdmin.fromPartial({authority: p.authority, daoId: toId(p.daoId), nominee: p.nominee}),
});

export const buildAcceptAdminNominationMsg = (p: {nominee: string; daoId: Id}): EncodeObject => ({
    typeUrl: MsgAcceptAdminNomination.typeUrl,
    value: MsgAcceptAdminNomination.fromPartial({nominee: p.nominee, daoId: toId(p.daoId)}),
});

/** Withdraw a pending nomination; `authority` is the current admin, as for `buildNominateAdminMsg`. */
export const buildWithdrawAdminNominationMsg = (p: {authority: string; daoId: Id}): EncodeObject => ({
    typeUrl: MsgWithdrawAdminNomination.typeUrl,
    value: MsgWithdrawAdminNomination.fromPartial({authority: p.authority, daoId: toId(p.daoId)}),
});

/** Open a proposal running `msgs` (zero for a signalling proposal) as the DAO if it passes. */
export const buildSubmitProposalMsg = (p: {
    proposer: string;
    daoId: Id;
    title: string;
    summary?: string;
    msgs?: EncodeObject[];
    expedited?: boolean;
}): EncodeObject => ({
    typeUrl: MsgSubmitProposal.typeUrl,
    value: {
        proposer: p.proposer,
        daoId: toId(p.daoId),
        title: p.title,
        summary: p.summary ?? '',
        msgs: packDaoMsgs(p.msgs ?? []),
        expedited: p.expedited ?? false,
    } satisfies MsgSubmitProposal,
});

export const buildDaoVoteMsg = (p: {voter: string; proposalId: Id; option: Exclude<DaoVoteOption, 'VOTE_OPTION_UNSPECIFIED'>}): EncodeObject => ({
    typeUrl: MsgVote.typeUrl,
    value: MsgVote.fromPartial({voter: p.voter, proposalId: toId(p.proposalId), option: enumValue(VOTE, p.option, 'vote option')}),
});

export const buildCancelDaoProposalMsg = (p: {proposer: string; proposalId: Id}): EncodeObject => ({
    typeUrl: MsgCancelProposal.typeUrl,
    value: MsgCancelProposal.fromPartial({proposer: p.proposer, proposalId: toId(p.proposalId)}),
});

/** Settle (or retry, or expire) a proposal; anyone can send it. */
export const buildSettleDaoProposalMsg = (p: {sender: string; proposalId: Id}): EncodeObject => ({
    typeUrl: MsgSettleProposal.typeUrl,
    value: MsgSettleProposal.fromPartial({sender: p.sender, proposalId: toId(p.proposalId)}),
});

/** Delete a finished proposal's state, up to `limit` ballots (0 = the chain's batch size). */
export const buildCleanupDaoProposalMsg = (p: {sender: string; proposalId: Id; limit?: number}): EncodeObject => ({
    typeUrl: MsgCleanupProposal.typeUrl,
    value: MsgCleanupProposal.fromPartial({sender: p.sender, proposalId: toId(p.proposalId), limit: BigInt(p.limit ?? 0)}),
});

// ---------------------------------------------------------------------------
// Messages only the DAO account signs. `daoAddress` is the DAO's own address;
// wrap the result in buildSubmitProposalMsg or buildAdminExecuteMsg, never
// broadcast it from a wallet.

/** Replace the DAO's whole config. */
export const buildUpdateDaoConfigMsg = (p: {daoAddress: string; daoId: Id; config: DaoConfig}): EncodeObject => ({
    typeUrl: MsgUpdateDaoConfig.typeUrl,
    value: MsgUpdateDaoConfig.fromPartial({authority: p.daoAddress, daoId: toId(p.daoId), config: daoConfigFromWire(p.config)}),
});

/** Replace the name and description (an empty description clears it). */
export const buildUpdateDaoMetadataMsg = (p: {daoAddress: string; daoId: Id; name: string; description: string}): EncodeObject => ({
    typeUrl: MsgUpdateMetadata.typeUrl,
    value: MsgUpdateMetadata.fromPartial({authority: p.daoAddress, daoId: toId(p.daoId), name: p.name, description: p.description}),
});

/** Replace a stake DAO's sources. */
export const buildUpdateDaoElectorateMsg = (p: {daoAddress: string; daoId: Id; electorate: DaoStakeElectorate | null}): EncodeObject => ({
    typeUrl: MsgUpdateElectorate.typeUrl,
    value: MsgUpdateElectorate.fromPartial({authority: p.daoAddress, daoId: toId(p.daoId), electorate: electorateFromWire(p.electorate)}),
});

/** Add and remove members of a static-list DAO. */
export const buildUpdateDaoMembersMsg = (p: {daoAddress: string; daoId: Id; add?: string[]; remove?: string[]}): EncodeObject => ({
    typeUrl: MsgUpdateMembers.typeUrl,
    value: MsgUpdateMembers.fromPartial({authority: p.daoAddress, daoId: toId(p.daoId), add: p.add ?? [], remove: p.remove ?? []}),
});
