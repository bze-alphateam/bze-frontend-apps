import {describe, expect, it} from "vitest";
import {signersOf} from "./signers";

describe("signersOf", () => {
    it("reads the field the type names", () => {
        expect(signersOf("/cosmos.bank.v1beta1.MsgSend", {from_address: "a"})).toEqual({field: "from_address", addresses: ["a"]});
        expect(signersOf("/bze.dao.MsgUpdateMembers", {authority: "a"})).toEqual({field: "authority", addresses: ["a"]});
        expect(signersOf("/bze.cointrunk.MsgAddArticle", {publisher: "a"})).toEqual({field: "publisher", addresses: ["a"]});
    });

    it("takes `creator` for the other BZE modules", () => {
        expect(signersOf("/bze.tradebin.MsgCreateOrder", {creator: "a"})).toEqual({field: "creator", addresses: ["a"]});
    });

    it("reads every input of a multi-send", () => {
        expect(signersOf("/cosmos.bank.v1beta1.MsgMultiSend", {inputs: [{address: "a"}, {address: "b"}, 3]})?.addresses).toEqual(["a", "b"]);
    });

    it("has no signer when the field is empty or missing, and no answer for an unknown type", () => {
        expect(signersOf("/cosmos.bank.v1beta1.MsgSend", {from_address: ""})?.addresses).toEqual([]);
        expect(signersOf("/cosmos.bank.v1beta1.MsgSend", {from_address: 5})?.addresses).toEqual([]);
        expect(signersOf("/other.v1.MsgX", {})).toBeNull();
    });
});
