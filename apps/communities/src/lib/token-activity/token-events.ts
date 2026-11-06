import {formatUnits, shortAddress} from "./format";
import type {ScanTokenEvent} from "./types";

/** The part of a Scan token event (`/token/events`) the History tab reads. */
export type TokenHistoryEvent = Pick<ScanTokenEvent, "height" | "tx_index" | "seq" | "tx_hash" | "kind" | "actor" | "amount" | "details" | "time">;

/** How the History tab writes one event. */
export interface TokenEventText {
    title: string;
    /** The small outlined tag beside the title. */
    tag: string;
    text: string;
    /** Mints draw their dot in the primary, everything else in the secondary. */
    primary: boolean;
}

export interface TokenEventContext {
    ticker: string;
    decimals: number;
    /** The ticker of another denom (a pool's other side), the denom itself when unknown. */
    tickerOf: (denom: string) => string;
}

const str = (details: Record<string, unknown> | null, key: string): string => {
    const value = details?.[key];
    return typeof value === "string" ? value : "";
};

/** "TMS / NOAD": the pair's base and quote, in the chain's order. */
const pair = (details: Record<string, unknown> | null, ctx: TokenEventContext): string =>
    [str(details, "base"), str(details, "quote")].filter(Boolean).map(ctx.tickerOf).join(" / ") || ctx.ticker;

/** The side of a pool or market that is not T. */
const otherSide = (details: Record<string, unknown> | null, denom: string | undefined, ctx: TokenEventContext): string => {
    const base = str(details, "base");
    const quote = str(details, "quote");
    const other = base && base !== denom ? base : quote;

    return other ? ctx.tickerOf(other) : "another token";
};

/**
 * The History tab's words for a token event: a title, its tag and one plain sentence. `denom` is
 * T's denom, to tell which side of a new pool or market is the other token.
 */
export function describeTokenEvent(event: TokenHistoryEvent, ctx: TokenEventContext, denom?: string): TokenEventText {
    const {ticker} = ctx;
    const amount = event.amount ? `${formatUnits(event.amount, ctx.decimals)} ${ticker}` : ticker;
    const short = (address: string) => (address ? shortAddress(address) : "");

    switch (event.kind) {
        case "created":
            return {title: `${ticker} created`, tag: "Created", text: event.actor ? `Created by ${short(event.actor)}.` : "The token was created.", primary: true};
        case "minted": {
            const to = str(event.details, "recipient") || event.actor || "";
            return {title: `${amount} minted`, tag: "Mint", text: to ? `Minted by the admin to ${short(to)}.` : "Minted by the admin.", primary: true};
        }
        case "burned":
            return {title: `${amount} burned`, tag: "Burn", text: "Burned by the admin, out of the supply for good.", primary: false};
        case "admin_changed": {
            const to = str(event.details, "to");
            return to
                ? {title: "Admin changed", tag: "Admin", text: `${short(to)} is the new admin of ${ticker}.`, primary: false}
                : {title: "Admin renounced", tag: "Admin", text: `Nobody can mint ${ticker} or change it any more.`, primary: false};
        }
        case "metadata_changed":
            return {title: "Details updated", tag: "Metadata", text: `New name, ticker or description for ${ticker}.`, primary: false};
        case "branding_changed":
            return {title: "Brand kit updated", tag: "Branding", text: `New colours and font for every ${ticker} page.`, primary: false};
        case "halted":
            return {title: "Trading halted", tag: "Halt", text: `${ticker} can't be traded on the DEX for now.`, primary: false};
        case "unhalted":
            return {title: "Trading resumed", tag: "Halt", text: `${ticker} can be traded on the DEX again.`, primary: false};
        case "pool_created": {
            const other = otherSide(event.details, denom, ctx);
            return {title: `${pair(event.details, ctx)} pool created`, tag: "Pool", text: `A new pool lets anyone swap ${ticker} for ${other}.`, primary: false};
        }
        case "market_created": {
            const other = otherSide(event.details, denom, ctx);
            return {title: `${pair(event.details, ctx)} market created`, tag: "Market", text: `A new order book for ${ticker} against ${other}.`, primary: false};
        }
        default:
            return {title: "Token updated", tag: "Event", text: `Something changed for ${ticker}.`, primary: false};
    }
}

/** "Nov 4, 2026 · block 4,082,925", in UTC. */
export function eventWhen(event: Pick<TokenHistoryEvent, "time" | "height">): string {
    const date = new Date(event.time);
    const day = Number.isNaN(date.getTime())
        ? ""
        : new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"}).format(date);

    return [day, `block ${new Intl.NumberFormat("en-US").format(event.height)}`].filter(Boolean).join(" · ");
}
