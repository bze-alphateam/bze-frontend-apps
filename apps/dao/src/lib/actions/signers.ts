/**
 * Who signs a message, by type URL: the field the chain's `cosmos.msg.v1.signer` option names (the
 * x/dao `ensureDaoSigner` check reads the same). Only the types the ui-kit can encode are listed, as
 * those are the only ones a custom message can be. The chain stays the judge: this is the check that
 * spares the user a proposal it would refuse (error 1111).
 */
const SIGNER_FIELD: Record<string, string> = {
    '/cosmos.bank.v1beta1.MsgSend': 'from_address',
    '/cosmos.staking.v1beta1.MsgDelegate': 'delegator_address',
    '/cosmos.staking.v1beta1.MsgUndelegate': 'delegator_address',
    '/cosmos.staking.v1beta1.MsgBeginRedelegate': 'delegator_address',
    '/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation': 'delegator_address',
    '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress': 'delegator_address',
    '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward': 'delegator_address',
    '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission': 'validator_address',
    '/cosmos.distribution.v1beta1.MsgFundCommunityPool': 'depositor',
    '/cosmos.gov.v1.MsgSubmitProposal': 'proposer',
    '/cosmos.gov.v1.MsgVote': 'voter',
    '/cosmos.gov.v1.MsgVoteWeighted': 'voter',
    '/cosmos.gov.v1.MsgDeposit': 'depositor',
    '/cosmos.gov.v1.MsgCancelProposal': 'proposer',
    '/cosmos.authz.v1beta1.MsgGrant': 'granter',
    '/cosmos.authz.v1beta1.MsgExec': 'grantee',
    '/cosmos.authz.v1beta1.MsgRevoke': 'granter',
    '/cosmos.feegrant.v1beta1.MsgGrantAllowance': 'granter',
    '/cosmos.feegrant.v1beta1.MsgRevokeAllowance': 'granter',
    '/ibc.applications.transfer.v1.MsgTransfer': 'sender',
    '/bze.cointrunk.MsgAddArticle': 'publisher',
    '/bze.cointrunk.MsgAcceptDomain': 'authority',
    '/bze.cointrunk.MsgSavePublisher': 'authority',
    '/bze.dao.MsgAdminExecute': 'admin',
    '/bze.dao.MsgNominateAdmin': 'authority',
    '/bze.dao.MsgAcceptAdminNomination': 'nominee',
    '/bze.dao.MsgWithdrawAdminNomination': 'authority',
    '/bze.dao.MsgSubmitProposal': 'proposer',
    '/bze.dao.MsgVote': 'voter',
    '/bze.dao.MsgCancelProposal': 'proposer',
    '/bze.dao.MsgSettleProposal': 'sender',
    '/bze.dao.MsgCleanupProposal': 'sender',
    '/bze.dao.MsgUpdateDaoConfig': 'authority',
    '/bze.dao.MsgUpdateMetadata': 'authority',
    '/bze.dao.MsgUpdateElectorate': 'authority',
    '/bze.dao.MsgUpdateMembers': 'authority',
};

/** Every other BZE module message names its signer `creator`. */
const BZE_DEFAULT_FIELD = 'creator';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface Signers {
    /** The JSON field the signer is written in, for the error text. */
    field: string;
    addresses: string[];
}

/** The signer(s) of a message body (snake_case JSON); null when the type's signer is not known. */
export function signersOf(typeUrl: string, body: Record<string, unknown>): Signers | null {
    if (typeUrl === '/cosmos.bank.v1beta1.MsgMultiSend') {
        const inputs = Array.isArray(body.inputs) ? body.inputs : [];
        const addresses = inputs.flatMap((input) => (isObject(input) && typeof input.address === 'string' ? [input.address] : []));
        return {field: 'inputs[].address', addresses};
    }

    const field = SIGNER_FIELD[typeUrl] ?? (typeUrl.startsWith('/bze.') ? BZE_DEFAULT_FIELD : null);
    if (!field) return null;
    const value = body[field];
    return {field, addresses: typeof value === 'string' && value !== '' ? [value] : []};
}
