const errorsMap: { [key: string]: string } = {
    "failed to execute message; message index: 0: amount is smaller than staking reward min stake": "Amount is smaller than minimum required stake",
    "the resulted amount is too low": "Swap minimum amount could not be met. Increase the slippage and try again.",
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
