import {text, token, type Action, type Part, type Reader} from "./actions";

const where = (body: Parameters<Reader>[1]): Part[] => [" on ", text(body, "channel_or_client_id") ?? "a channel"];

/** `2% out / 2% in per 24 h`; null when a field is missing. */
function limitText(send: string | null, recv: string | null, hours: string | null): string | null {
    if (!send || !recv) return null;
    return `${send}% out / ${recv}% in${hours ? ` per ${hours} h` : ""}`;
}

/** The `ratelimit` module's governance messages (IBC rate limits per token and channel). */
export const readRateLimit: Reader = (type, body) => {
    const denom = text(body, "denom");
    const limit = limitText(text(body, "max_percent_send"), text(body, "max_percent_recv"), text(body, "duration_hours"));
    const sentence = (title: Part[], details: Part[][] = []): Action => ({type: "sentence", emergency: false, title, details});
    switch (type) {
        case "/ratelimit.v1.MsgAddRateLimit":
            return sentence(["Add an IBC limit for ", ...token(denom), ...where(body), ...(limit ? [`: ${limit}`] : [])]);
        case "/ratelimit.v1.MsgUpdateRateLimit":
            return sentence(["Change the IBC limit of ", ...token(denom), ...where(body), ...(limit ? [` to ${limit}`] : [])]);
        case "/ratelimit.v1.MsgRemoveRateLimit":
            return sentence(["Remove the IBC limit of ", ...token(denom), ...where(body)]);
        case "/ratelimit.v1.MsgResetRateLimit":
            return sentence(["Reset today's counted flow of ", ...token(denom), ...where(body)]);
        default:
            return null;
    }
};
