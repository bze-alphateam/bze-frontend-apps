import type {GovCoin} from "@bze/bze-ui-kit";

// "What it does if it passes": each proposal message read into an action the
// page draws in plain words. Ported from BZE Scan (ui/src/render/proposals),
// which reads the same chain JSON: one reader per proposal kind (upgrade.ts,
// spend.ts, params.ts, cointrunk.ts, ibc.ts), each knowing its type URLs, both
// the messages and the legacy contents a `MsgExecLegacyContent` carries; a
// message none of them reads is an `other` action, its fields as a table.

/** A key and its raw value, for the parameter and fallback tables. */
export interface Entry {
    key: string;
    value: unknown;
}

export type Action =
    | {type: "upgrade"; name: string; height: number | null}
    | {type: "cancel_upgrade"}
    | {type: "spend"; recipient: string | null; amount: GovCoin[]}
    /** `whole`: a `MsgUpdateParams`, which sets every parameter of the module. */
    | {type: "params"; module: string; entries: Entry[]; whole: boolean}
    | {type: "publisher"; add: boolean; name: string | null; address: string | null}
    | {type: "domain"; add: boolean; domain: string | null}
    | {type: "ibc_client"; subject: string | null; substitute: string | null}
    | {type: "text"}
    | {type: "other"; title: string; typeUrl: string; entries: Entry[]};

/** A message body as proto JSON. */
export type Body = Record<string, unknown>;

/** A reader: the action of a body whose `@type` it knows, else null. */
export type Reader = (type: string, body: Body) => Action | null;

/** An object field, or null. */
export function obj(value: unknown): Body | null {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Body) : null;
}

function asCoin(value: unknown): GovCoin | null {
    const o = obj(value);
    return o && typeof o.denom === "string" && (typeof o.amount === "string" || typeof o.amount === "number")
        ? {denom: o.denom, amount: String(o.amount)}
        : null;
}

/** A `repeated Coin` field, the malformed entries skipped. */
export function coins(value: unknown): GovCoin[] {
    return Array.isArray(value) ? value.map(asCoin).filter((c): c is GovCoin => c !== null) : [];
}

/** A string field, or null for a missing or empty one. */
export function text(body: Body, key: string): string | null {
    const v = body[key];
    return typeof v === "string" && v !== "" ? v : typeof v === "number" ? String(v) : null;
}

/** A positive integer field (heights come as strings), or null. */
export function height(value: unknown): number | null {
    const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The body's fields other than its type and the gov module's `authority`. */
export function entriesOf(body: Body): Entry[] {
    return Object.entries(body)
        .filter(([key, v]) => key !== "@type" && key !== "authority" && v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
        .map(([key, value]) => ({key, value}));
}

/** `MsgCreateDenomReward` → `Create denom reward`, from a type URL or a field name. */
export function humanise(typeUrl: string): string {
    const name = typeUrl.split(/[./]/).pop() ?? typeUrl;
    const words = name
        .replace(/^Msg/, "")
        .replace(/_/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .toLowerCase()
        .trim();
    return words ? words[0].toUpperCase() + words.slice(1) : typeUrl;
}
