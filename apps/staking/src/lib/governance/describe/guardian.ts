import {denomList, token, humanise, strings, text, type Action, type Part, type Reader} from "./actions";

const channelOf = (body: Parameters<Reader>[1]) => text(body, "channel_id") ?? "a channel";

/**
 * The guardian module's messages (the ones governance undoes with, and the
 * emergency ones governance can sign too) and the circuit breaker's reset.
 */
export const readGuardian: Reader = (type, body) => {
    const denom = text(body, "denom");
    const plain = (title: Part[], details: Part[][] = []): Action => ({type: "sentence", emergency: false, title, details});
    const emergency = (title: Part[], details: Part[][] = []): Action => ({type: "sentence", emergency: true, title, details});
    switch (type) {
        case "/bze.guardian.v1.MsgUnblockDenom":
            return plain(["Allow ", ...token(denom), " to cross chains again"]);
        case "/bze.guardian.v1.MsgReopenChannel":
            return plain([`Reopen transfers on ${channelOf(body)}`]);
        case "/bze.guardian.v1.MsgResumeAutomation":
            return plain(["Resume fee conversion and burning"]);
        case "/bze.guardian.v1.MsgBlockDenom":
            return emergency(["Emergency: stop ", ...token(denom), " from crossing chains"]);
        case "/bze.guardian.v1.MsgCloseChannel":
            return emergency([`Emergency: close transfers on ${channelOf(body)}`]);
        case "/bze.guardian.v1.MsgPauseAutomation":
            return emergency(["Emergency: pause fee conversion and burning"]);
        case "/bze.guardian.v1.MsgTightenRateLimit": {
            const send = text(body, "max_percent_send");
            const recv = text(body, "max_percent_recv");
            return emergency([
                "Emergency: lower the IBC limit of ", ...token(denom), ` on ${channelOf(body)}`,
                ...(send && recv ? [` to ${send}% out / ${recv}% in`] : []),
            ]);
        }
        case "/bze.guardian.v1.MsgDisableMessages": {
            const urls = strings(body.msg_type_urls);
            return emergency(["Emergency: switch off these actions: " + (urls.length > 0 ? urls.map(humanise).join(", ") : "none listed")]);
        }
        case "/bze.guardian.v1.MsgHaltTradingDenoms":
            return emergency(["Emergency: halt trading of ", ...denomList(strings(body.denoms))]);
        case "/bze.guardian.v1.MsgHaltChain": {
            const reason = text(body, "reason");
            return emergency(["Emergency: stop the chain at the next block"], reason ? [[`Reason given: ${reason}`]] : []);
        }
        case "/cosmos.circuit.v1.MsgResetCircuitBreaker": {
            const urls = strings(body.msg_type_urls);
            return plain([urls.length === 0 ? "Switch every paused action back on" : `Switch these actions back on: ${urls.map(humanise).join(", ")}`]);
        }
        default:
            return null;
    }
};
