import BigNumber from "bignumber.js";

/** One token movement of a transaction, as BZE Scan's `/txs/{hash}` lists it. */
export interface TxLeg {
    seq: number;
    /** The message that moved it; null for the network fee. */
    msg_index: number | null;
    sender: string | null;
    recipient: string | null;
    recipient_label?: { name?: string | null; kind?: string | null } | null;
    denom: string;
    amount: string;
}

/** A message of the transaction, as `/txs/{hash}` lists it. */
export interface TxMessage {
    msg_index: number;
    type_url: string;
    body?: Record<string, unknown> | null;
}

/** The part of `/txs/{hash}` the summary reads. */
export interface TxSummarySource {
    signer: string | null;
    fee: { denom: string; amount: string }[];
    messages: TxMessage[];
    transfers: TxLeg[];
}

/** An amount of one denom, base units. */
export interface DenomAmount {
    denom: string;
    amount: BigNumber;
}

export interface TxSummary {
    /** The message the summary is about (the first one that moves T, else the first one). */
    message?: TxMessage;
    /** What the signer sent in that message, by denom. */
    paid: DenomAmount[];
    /** What the signer got in that message, by denom. */
    received: DenomAmount[];
    /** A swap's route: the pools it went through, in order. */
    route: string[];
    /** A swap's pool fees, taken by the DEX on each hop, by denom. */
    swapFees: DenomAmount[];
    /** A swap's trading fee: what the signer paid the DEX besides the swapped amount. */
    tradingFee: DenomAmount[];
    networkFee: DenomAmount[];
}

const MULTI_SWAP = "/bze.tradebin.MsgMultiSwap";

const sumByDenom = (legs: { denom: string; amount: string }[]): DenomAmount[] => {
    const totals = new Map<string, BigNumber>();
    for (const leg of legs) {
        const amount = new BigNumber(leg.amount);
        if (!amount.isFinite() || amount.lte(0)) continue;
        totals.set(leg.denom, (totals.get(leg.denom) ?? new BigNumber(0)).plus(amount));
    }

    return Array.from(totals, ([denom, amount]) => ({denom, amount}));
};

const isFeeSink = (leg: TxLeg) => {
    const name = leg.recipient_label?.name?.toLowerCase() ?? "";
    return leg.recipient_label?.kind === "module" && (name.includes("fee collector") || name === "burner");
};

/** The swap's input coin, from the message body. */
const swapInput = (message: TxMessage): { denom: string; amount: string } | undefined => {
    const input = message.body?.input as { denom?: unknown; amount?: unknown } | undefined;
    return typeof input?.denom === "string" && typeof input.amount === "string" ? {denom: input.denom, amount: input.amount} : undefined;
};

/**
 * The transaction page's summary card and details: what the signer paid and received in the
 * message the page is about, and for a swap its route, pool fees and trading fee. `denom` is the
 * token site's token, to pick the message that moves it.
 */
export function summarizeTx(tx: TxSummarySource, denom: string): TxSummary {
    const movesToken = (message: TxMessage) => tx.transfers.some((leg) => leg.msg_index === message.msg_index && leg.denom === denom);
    const message = tx.messages.find(movesToken) ?? tx.messages[0];
    const legs = message ? tx.transfers.filter((leg) => leg.msg_index === message.msg_index) : [];
    const networkFee = sumByDenom(tx.fee);

    const outgoing = tx.signer ? legs.filter((leg) => leg.sender === tx.signer) : [];
    const incoming = tx.signer ? legs.filter((leg) => leg.recipient === tx.signer) : [];

    if (message?.type_url === MULTI_SWAP) {
        const input = swapInput(message);
        const routes = message.body?.routes;
        const paid = input ? sumByDenom([input]) : sumByDenom(outgoing);
        // The signer's other payments to the DEX in a swap are its trading fee.
        let inputLeft = new BigNumber(input?.amount ?? 0);
        const tradingLegs = outgoing.filter((leg) => {
            if (input && leg.denom === input.denom && inputLeft.gt(0)) {
                inputLeft = inputLeft.minus(leg.amount);
                return false;
            }
            return true;
        });
        // The DEX's legs to the fee collectors and the burner are the pools' fees, unless they
        // pass the trading fee on unchanged.
        const tradingFee = sumByDenom(tradingLegs);
        const passedOn = new Map(tradingFee.map((fee) => [fee.denom, fee.amount]));
        const swapFeeLegs = legs.filter((leg) => leg.sender !== tx.signer && isFeeSink(leg)).filter((leg) => {
            if (!passedOn.get(leg.denom)?.eq(leg.amount)) return true;
            passedOn.delete(leg.denom);
            return false;
        });

        return {
            message,
            paid,
            received: sumByDenom(incoming),
            route: Array.isArray(routes) ? routes.filter((route): route is string => typeof route === "string") : [],
            swapFees: sumByDenom(swapFeeLegs),
            tradingFee,
            networkFee,
        };
    }

    return {
        message,
        paid: sumByDenom(outgoing),
        received: sumByDenom(incoming),
        route: [],
        swapFees: [],
        tradingFee: [],
        networkFee,
    };
}

/**
 * A swap's route as denoms: the input, then the far side of each pool in turn ("NOAD → TMS →
 * BZE → CTR"). Pool ids are `<base>_<quote>`; a denom holding "_" can't be split safely, so the
 * pools' own sides are matched against the denom the path is at.
 */
export function routeDenoms(input: string, pools: string[]): string[] {
    const path = [input];
    let at = input;
    for (const pool of pools) {
        let next: string | undefined;
        if (pool.startsWith(`${at}_`)) next = pool.slice(at.length + 1);
        else if (pool.endsWith(`_${at}`)) next = pool.slice(0, pool.length - at.length - 1);
        if (!next) return path;
        path.push(next);
        at = next;
    }

    return path;
}
