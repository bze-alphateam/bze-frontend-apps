// Token Activity tags: a row's tag is its message type alone (the chain protos' type URLs, as
// Scan stores them in `msg_type` and `/txs` messages). Anything not listed is a Transfer.

export type ActivityTag =
    | "Swap"
    | "Liquidity"
    | "Order"
    | "Stake"
    | "Unstake"
    | "Claim"
    | "Rewards"
    | "Burn"
    | "Raffle"
    | "Cross-chain"
    | "Mint"
    | "Transfer";

export const MSG = {
    // tradebin
    multiSwap: "/bze.tradebin.MsgMultiSwap",
    addLiquidity: "/bze.tradebin.MsgAddLiquidity",
    removeLiquidity: "/bze.tradebin.MsgRemoveLiquidity",
    createLiquidityPool: "/bze.tradebin.MsgCreateLiquidityPool",
    createOrder: "/bze.tradebin.MsgCreateOrder",
    fillOrders: "/bze.tradebin.MsgFillOrders",
    cancelOrder: "/bze.tradebin.MsgCancelOrder",
    // rewards
    joinStaking: "/bze.rewards.MsgJoinStaking",
    joinDenomReward: "/bze.rewards.MsgJoinDenomReward",
    exitStaking: "/bze.rewards.MsgExitStaking",
    exitDenomReward: "/bze.rewards.MsgExitDenomReward",
    claimStakingRewards: "/bze.rewards.MsgClaimStakingRewards",
    claimDenomRewards: "/bze.rewards.MsgClaimDenomRewards",
    createStakingReward: "/bze.rewards.MsgCreateStakingReward",
    updateStakingReward: "/bze.rewards.MsgUpdateStakingReward",
    distributeStakingRewards: "/bze.rewards.MsgDistributeStakingRewards",
    createDenomReward: "/bze.rewards.MsgCreateDenomReward",
    createDenomRewardSchedule: "/bze.rewards.MsgCreateDenomRewardSchedule",
    updateDenomRewardSchedule: "/bze.rewards.MsgUpdateDenomRewardSchedule",
    distributeDenomRewards: "/bze.rewards.MsgDistributeDenomRewards",
    createTradingReward: "/bze.rewards.MsgCreateTradingReward",
    activateTradingReward: "/bze.rewards.MsgActivateTradingReward",
    // burner
    fundBurner: "/bze.burner.MsgFundBurner",
    startRaffle: "/bze.burner.MsgStartRaffle",
    joinRaffle: "/bze.burner.MsgJoinRaffle",
    // tokenfactory
    mint: "/bze.tokenfactory.MsgMint",
    burn: "/bze.tokenfactory.MsgBurn",
    // cosmos + IBC
    send: "/cosmos.bank.v1beta1.MsgSend",
    multiSend: "/cosmos.bank.v1beta1.MsgMultiSend",
    exec: "/cosmos.authz.v1beta1.MsgExec",
    ibcTransfer: "/ibc.applications.transfer.v1.MsgTransfer",
    ibcRecvPacket: "/ibc.core.channel.v1.MsgRecvPacket",
    ibcAcknowledgement: "/ibc.core.channel.v1.MsgAcknowledgement",
    ibcTimeout: "/ibc.core.channel.v1.MsgTimeout",
    ibcTimeoutOnClose: "/ibc.core.channel.v1.MsgTimeoutOnClose",
} as const;

const TAGS: Record<string, ActivityTag> = {
    [MSG.multiSwap]: "Swap",
    [MSG.addLiquidity]: "Liquidity",
    [MSG.removeLiquidity]: "Liquidity",
    [MSG.createLiquidityPool]: "Liquidity",
    [MSG.createOrder]: "Order",
    [MSG.fillOrders]: "Order",
    [MSG.cancelOrder]: "Order",
    [MSG.joinStaking]: "Stake",
    [MSG.joinDenomReward]: "Stake",
    [MSG.exitStaking]: "Unstake",
    [MSG.exitDenomReward]: "Unstake",
    [MSG.claimStakingRewards]: "Claim",
    [MSG.claimDenomRewards]: "Claim",
    [MSG.createStakingReward]: "Rewards",
    [MSG.updateStakingReward]: "Rewards",
    [MSG.distributeStakingRewards]: "Rewards",
    [MSG.createDenomReward]: "Rewards",
    [MSG.createDenomRewardSchedule]: "Rewards",
    [MSG.updateDenomRewardSchedule]: "Rewards",
    [MSG.distributeDenomRewards]: "Rewards",
    [MSG.createTradingReward]: "Rewards",
    [MSG.activateTradingReward]: "Rewards",
    [MSG.fundBurner]: "Burn",
    [MSG.burn]: "Burn",
    [MSG.startRaffle]: "Raffle",
    [MSG.joinRaffle]: "Raffle",
    [MSG.mint]: "Mint",
    [MSG.ibcTransfer]: "Cross-chain",
    [MSG.ibcRecvPacket]: "Cross-chain",
    [MSG.ibcAcknowledgement]: "Cross-chain",
    [MSG.ibcTimeout]: "Cross-chain",
    [MSG.ibcTimeoutOnClose]: "Cross-chain",
};

/** The tag of a message type; MsgSend, an unknown type or none at all are a Transfer. */
export const tagOf = (typeUrl: string | null | undefined): ActivityTag => (typeUrl && TAGS[typeUrl]) || "Transfer";

/** Every tag, in the order of the tag legend. */
export const ACTIVITY_TAGS: readonly ActivityTag[] = [
    "Swap", "Liquidity", "Order", "Stake", "Unstake", "Claim", "Rewards", "Burn", "Raffle", "Cross-chain", "Mint", "Transfer",
];
