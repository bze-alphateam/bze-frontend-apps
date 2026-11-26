const errorsMap: { [key: string]: string } = {
    "failed to execute message; message index: 0: amount is smaller than staking reward min stake": "Amount is smaller than minimum required stake",
    "the resulted amount is too low": "The minimum amount could not be met (the price moved). Increase the slippage and try again.",
    "amount is too low to be traded": "Amount is too low to be traded",
    "can not buy more than 50 tickets": "You can only contribute up to 50 times per transaction.",
    "can be used to pay for fees only if enough liquidity is available": "Your selected fee token does not have enough liquidity. Please switch to the native token in Settings.",
    // Denom Rewards (x/rewards, chain v8.2.0). Keys are the chain's registered error messages.
    // holder side; listed before "denom reward not found" because the chain wraps that error
    "you are not a participant in this denom reward": "You have no stake in this denom reward any more — it may already have been exited. Refresh the page.",
    "amount is smaller than denom reward min stake": "Your stake would stay below this denom reward's minimum stake. Stake enough for your whole position to reach it.",
    "amount should be greater than 0": "Enter an amount greater than zero.",
    "no rewards available to claim": "There is nothing to claim yet — amounts smaller than one base unit keep accruing until they add up.",
    "denom reward not found": "This token has no denom reward yet — create it first.",
    "a denom reward already exists for this denom": "This token already has a denom reward — there can only be one per token. Refresh the page to see it.",
    "prize denom cap reached for this denom reward": "This denom reward already uses the maximum number of prize tokens. Fund it with a prize token it already has.",
    "invalid duration": "Invalid duration: a schedule runs between 1 and 36,500 days, also after extending it.",
    "denom reward has no stakers": "Nobody is staking this token yet, so there is no one to pay — nothing left your wallet. Try again once someone stakes.",
    "denom reward schedule not found": "This schedule no longer exists — it may have paid its last day. Refresh the page.",
    // Finished staking reward cleanup (MsgDeleteStakingReward, chain v8.2.0)
    "staking reward is not finished": "This program still has days left to pay — it can only be deleted once it has finished. Refresh the page.",
    "staking reward still has staked funds": "Someone still has a stake in this program — it can only be deleted once every staker has exited. Refresh the page.",
    // Token brand kit (MsgSetDenomBranding, chain v8.2.0)
    "invalid branding": "The brand kit was refused: it needs a lowercase font slug and all eight colours as 6-digit hex values like #1A2B3C. Check the fields and try again.",
    // Cancel unbonding (cosmos x/staking MsgCancelUnbondingDelegation)
    "validator for this address is currently jailed": "This validator is jailed, so its unbonding can not be cancelled until it is unjailed.",
    "unbonding delegation is already processed": "This unbonding has already completed, so it can not be cancelled any more. Refresh the page.",
    "unbonding delegation entry is not found at block height": "This unbonding entry no longer exists — it may have completed or been cancelled already. Refresh the page.",
    // v8.3.0 refusals. The chain's raw texts are matched by substring (prefixes vary).
    // IBC rate limit (x/ratelimit, outgoing transfer over the daily quota)
    "exceeds quota": "This transfer is over today's limit for this route. Try a smaller amount or try again later.",
    // Guardian: denom blocked for ICS-20 (x/ratelimit)
    "is blacklisted": "Transfers of this token to and from other chains are stopped for now.",
    // Guardian: channel closed (x/txfeecollector)
    "ibc transfers on this channel are stopped": "Transfers on this route are stopped for now.",
    // Guardian: message type paused (x/circuit, raised by the baseapp message router)
    "circuit breaker disables execution of this message": "This action is paused on BeeZee for now. Please try again later.",
    // Non-mintable factory token (x/tokenfactory)
    "minting is disabled for this denom": "Minting is turned off for this token, so no new supply can be created.",
    // Order book (x/tradebin): a cancel by an id that was filled, cancelled or merged away
    "order not found": "This order no longer exists. It was filled, cancelled, or merged into a newer order at the same price.",
    // Bank error (sdk code 5), e.g. a swap with too little balance
    "insufficient funds": "You don't have enough balance for this transaction (including fees).",
    // DAOs (x/dao, chain v8.3.0, codespace "dao"). Keys are the chain's registered error messages,
    // which it wraps with the details ("dao 5: dao not found").
    "invalid dao config": "The DAO rules were refused: check the quorum, threshold and voting periods (the expedite values can't be lower than the regular ones, and the periods must be within the chain's limits).",
    "invalid dao members": "The member list was refused: use valid, distinct addresses (never the DAO's own), at least one and no more than the chain allows.",
    "a self-owned dao needs a live electorate": "A DAO with no admin must be able to vote from day one: pick a reward that has something staked, or choose an admin who sets the voters up later.",
    "an account already exists at the dao address": "This DAO cannot be created right now. Nothing was charged. Please report it to the BZE team.",
    "invalid dao electorate": "The voters were refused: every staking reward and Denom Reward must exist, stake the same token and have an unstaking lock of at least the chain's minimum.",
    "dao not found": "This DAO doesn't exist. Check the link or refresh the page.",
    "signer is not the dao's admin": "Only this DAO's admin can do that. Connect the admin's wallet.",
    "message must be signed by the dao account only": "One of the actions would move funds or act for an account other than the DAO. A DAO can only act as itself: change that action so it comes from the DAO's address.",
    "an admin nomination is already pending": "An admin handover is already pending. Withdraw it before nominating someone else.",
    "the dao electorate cannot vote": "This DAO has nobody who can vote yet: it needs members, or stake in at least one of its sources.",
    "invalid admin nominee": "The nominee must be a valid address other than the current admin and the DAO itself.",
    "signer is not the dao's pending admin": "Only the nominated address can accept this handover. Connect the nominee's wallet.",
    "signer cannot submit proposals to this dao": "Only this DAO's voters can submit proposals. Become a member, or stake in one of its sources first.",
    "no voting power": "There is no voting power to count: your wallet has no eligible weight on this proposal (stake added after it was submitted doesn't count), or the DAO has no voters.",
    "the dao has too many open proposals": "This DAO already has the most proposals open at once. Wait until one is settled or cancelled.",
    "the dao does not allow expedited proposals": "This DAO doesn't allow expedited proposals. Submit it as a regular one.",
    "the proposal is not open for voting": "Voting on this proposal is closed. Refresh the page.",
    "the ballot already has this option": "You already voted this way. Pick another option to change your vote.",
    "signer is not the proposal's proposer": "Only the address that submitted this proposal can cancel it.",
    "the proposal's voting period has not ended": "Voting is still open. The proposal can be settled once its voting period ends.",
    "the proposal is finished": "This proposal is already finished. Refresh the page.",
    "the expedited proposal does not meet the expedite bars yet": "This expedited proposal doesn't have enough votes to settle early yet. Wait for more votes or for the end of its voting period.",
    "the proposal is not finished": "This proposal is still open or can still be retried, so it can't be cleaned up yet.",
    "the expedited proposal cannot settle early yet": "This expedited proposal can't settle early yet: voters get a minimum time to react first. Try again later.",
    "the message is not allowed in this dao execution": "That action isn't allowed here: a DAO's admin can't grant permissions or fee allowances as the DAO, nor run authz executions. Do it through a proposal instead.",
    "no admin nomination is pending": "There is no pending admin nomination for this DAO (it was withdrawn or already accepted). Refresh the page.",
    "dao executions are nested too deep": "The actions are nested too deep: the chain runs at most 5 levels of DAO executions inside each other. Flatten them.",
    "the admin nomination is stale": "This handover is no longer valid: control of the nominating DAO changed since it was made. It has to be withdrawn and made again.",
    "broadcast failed with code 7": "Transaction rejected: your selected fee token may not have enough liquidity. Try switching to the native token in Settings.",
};

export const prettyError = (err: string|undefined): string|undefined => {
    if (!err) return undefined;

    if (errorsMap[err]) {
        return errorsMap[err];
    }

    for (const [key, value] of Object.entries(errorsMap)) {
        if (err.includes(key)) {
            return value;
        }
    }

    return err;
}
