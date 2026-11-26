/**
 * Registers all BZE ecosystem message encoders and amino converters on a signing client.
 *
 * This is required because interchain-kit creates signing clients without any message
 * encoders pre-registered. Without this, signAndBroadcast and fee simulation will fail
 * with "No encoder/converter found for type" errors.
 *
 * Covers all modules used across dex.getbze.com, burner.getbze.com, app.getbze.com,
 * and stake.getbze.com. Add new message types here when new modules are introduced.
 */

// BZE modules
import {
    MsgCreateMarket, MsgCreateOrder, MsgCancelOrder, MsgFillOrders,
    MsgCreateLiquidityPool, MsgAddLiquidity, MsgRemoveLiquidity, MsgMultiSwap,
} from "@bze/bzejs/bze/tradebin/tx";
import {
    MsgCreateStakingReward, MsgUpdateStakingReward, MsgJoinStaking, MsgExitStaking,
    MsgClaimStakingRewards, MsgCreateTradingReward, MsgActivateTradingReward, MsgDeleteStakingReward,
    MsgCreateDenomReward, MsgCreateDenomRewardSchedule, MsgUpdateDenomRewardSchedule,
    MsgDistributeDenomRewards, MsgJoinDenomReward, MsgClaimDenomRewards, MsgExitDenomReward,
} from "@bze/bzejs/bze/rewards/tx";
import {MsgFundBurner, MsgStartRaffle, MsgJoinRaffle} from "@bze/bzejs/bze/burner/tx";
import {
    MsgCreateDenom, MsgMint, MsgBurn, MsgChangeAdmin, MsgSetDenomMetadata, MsgSetDenomBranding,
} from "@bze/bzejs/bze/tokenfactory/tx";
import {MsgAddArticle, MsgPayPublisherRespect, MsgAcceptDomain, MsgSavePublisher} from "@bze/bzejs/bze/cointrunk/tx";
// x/dao (chain v8.3.0); a namespace import because MsgSubmitProposal, MsgVote and
// MsgCancelProposal share their names with the gov messages below.
import * as daoTx from "@bze/bzejs/bze/dao/tx";

// Cosmos modules
import {MsgSend, MsgMultiSend} from "@bze/bzejs/cosmos/bank/v1beta1/tx";
import {
    MsgDelegate, MsgUndelegate, MsgBeginRedelegate, MsgCancelUnbondingDelegation,
} from "@bze/bzejs/cosmos/staking/v1beta1/tx";
import {
    MsgSetWithdrawAddress, MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission,
    MsgFundCommunityPool,
} from "@bze/bzejs/cosmos/distribution/v1beta1/tx";
import {
    MsgSubmitProposal, MsgVote, MsgVoteWeighted, MsgDeposit, MsgCancelProposal,
} from "@bze/bzejs/cosmos/gov/v1/tx";
import {MsgGrant, MsgExec, MsgRevoke} from "@bze/bzejs/cosmos/authz/v1beta1/tx";
import {MsgGrantAllowance, MsgRevokeAllowance} from "@bze/bzejs/cosmos/feegrant/v1beta1/tx";

// IBC
import {MsgTransfer} from "@bze/bzejs/ibc/applications/transfer/v1/tx";

type MsgCodec = {
    typeUrl: string;
    aminoType?: string;
    fromPartial: (object: any) => any;
    encode: (message: any, writer?: any) => any;
    fromAmino?: (object: any) => any;
    toAmino?: (message: any) => any;
    decode?: (input: Uint8Array) => any;
};

const toEncoder = (g: MsgCodec) => ({
    typeUrl: g.typeUrl,
    fromPartial: g.fromPartial,
    encode: (data: any) => {
        const encoded = g.encode(g.fromPartial(data));
        return encoded.finish ? encoded.finish() : encoded;
    },
});

const toConverter = (g: MsgCodec) => ({
    typeUrl: g.typeUrl,
    aminoType: g.aminoType,
    fromAmino: g.fromAmino,
    toAmino: g.toAmino,
});

const ALL_MSG_TYPES: MsgCodec[] = [
    // BZE tradebin
    MsgCreateMarket, MsgCreateOrder, MsgCancelOrder, MsgFillOrders,
    MsgCreateLiquidityPool, MsgAddLiquidity, MsgRemoveLiquidity, MsgMultiSwap,
    // BZE rewards
    MsgCreateStakingReward, MsgUpdateStakingReward, MsgJoinStaking, MsgExitStaking,
    MsgClaimStakingRewards, MsgCreateTradingReward, MsgActivateTradingReward,
    // BZE rewards — finished staking reward cleanup (chain v8.2.0)
    MsgDeleteStakingReward,
    // BZE rewards — denom rewards (chain v8.2.0)
    MsgCreateDenomReward, MsgCreateDenomRewardSchedule, MsgUpdateDenomRewardSchedule,
    MsgDistributeDenomRewards, MsgJoinDenomReward, MsgClaimDenomRewards, MsgExitDenomReward,
    // BZE burner
    MsgFundBurner, MsgStartRaffle, MsgJoinRaffle,
    // BZE tokenfactory
    MsgCreateDenom, MsgMint, MsgBurn, MsgChangeAdmin, MsgSetDenomMetadata,
    // BZE tokenfactory — token brand kit (chain v8.2.0)
    MsgSetDenomBranding,
    // BZE cointrunk
    MsgAddArticle, MsgPayPublisherRespect, MsgAcceptDomain, MsgSavePublisher,
    // BZE dao (chain v8.3.0). Always signed direct, see daoTxOptions.
    daoTx.MsgCreateDao, daoTx.MsgAdminExecute, daoTx.MsgNominateAdmin, daoTx.MsgAcceptAdminNomination,
    daoTx.MsgWithdrawAdminNomination, daoTx.MsgSubmitProposal, daoTx.MsgVote, daoTx.MsgCancelProposal,
    daoTx.MsgSettleProposal, daoTx.MsgCleanupProposal, daoTx.MsgUpdateDaoConfig, daoTx.MsgUpdateMetadata,
    daoTx.MsgUpdateElectorate, daoTx.MsgUpdateMembers,
    // Cosmos bank
    MsgSend, MsgMultiSend,
    // Cosmos staking
    MsgDelegate, MsgUndelegate, MsgBeginRedelegate, MsgCancelUnbondingDelegation,
    // Cosmos distribution
    MsgSetWithdrawAddress, MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission,
    MsgFundCommunityPool,
    // Cosmos gov
    MsgSubmitProposal, MsgVote, MsgVoteWeighted, MsgDeposit, MsgCancelProposal,
    // Cosmos authz
    MsgGrant, MsgExec, MsgRevoke,
    // Cosmos feegrant
    MsgGrantAllowance, MsgRevokeAllowance,
    // IBC transfer
    MsgTransfer,
];

const CODECS_BY_TYPE_URL = new Map(ALL_MSG_TYPES.map(g => [g.typeUrl, g]));


/**
 * Encode a message the way the signing client does: `fromPartial`, then the protobuf bytes.
 * Throws for a type URL that is not registered.
 */
export const encodeMsgValue = (typeUrl: string, value: unknown): Uint8Array => {
    const codec = CODECS_BY_TYPE_URL.get(typeUrl);
    if (!codec) {
        throw new Error(`no encoder registered for ${typeUrl}`);
    }
    return toEncoder(codec).encode(value);
};

/** Whether the signing client has an encoder for this message type (the types the apps can sign or pack). */
export const hasMsgCodec = (typeUrl: string): boolean => CODECS_BY_TYPE_URL.has(typeUrl);

/**
 * A message value from its JSON body (snake_case field names, int64 as strings, enums as numbers,
 * the shape of the amino JSON the codecs read). Throws for a type the ui-kit has no codec for and
 * for a body the codec cannot read. Unknown fields are dropped, as the codec only reads the ones it knows.
 */
export const msgValueFromJson = (typeUrl: string, body: unknown): unknown => {
    const codec = CODECS_BY_TYPE_URL.get(typeUrl);
    if (!codec || !codec.fromAmino) {
        throw new Error(`no decoder registered for ${typeUrl}`);
    }
    return codec.fromAmino(body);
};

/**
 * What the chain would read from a message value: the value is encoded to protobuf, decoded again and
 * written back as JSON (snake_case, defaults left out). Shows exactly what is signed.
 */
export const msgValueToJson = (typeUrl: string, value: unknown): Record<string, unknown> => {
    const codec = CODECS_BY_TYPE_URL.get(typeUrl);
    if (!codec || !codec.decode || !codec.toAmino) {
        throw new Error(`no decoder registered for ${typeUrl}`);
    }
    return codec.toAmino(codec.decode(encodeMsgValue(typeUrl, value)));
};

export const registerBzeEncoders = (client: any): void => {
    if (!client) return;
    client.addEncoders?.(ALL_MSG_TYPES.map(toEncoder));
    client.addConverters?.(ALL_MSG_TYPES.map(toConverter));
};
