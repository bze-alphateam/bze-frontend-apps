import {text, type Reader} from "./actions";

/** `MsgSetDenomAdmin`: control of a token handed to another account. */
export const readTokenFactory: Reader = (type, body) => {
    if (type !== "/bze.tokenfactory.MsgSetDenomAdmin") return null;
    const address = text(body, "new_admin");
    return {
        type: "sentence",
        emergency: false,
        title: ["Give control of ", {denom: text(body, "denom") ?? ""}, " to ", address ? {address} : "an unknown account"],
        details: [],
    };
};
