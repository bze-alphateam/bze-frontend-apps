import {describe, expect, it} from "vitest";
import {proposalIdFromTx} from "./submit-result";

const event = (type: string, attributes: {key: string; value: string}[]) => ({type, attributes});
const b64 = (s: string) => btoa(s);

describe("proposalIdFromTx", () => {
    it("reads the id of the typed event (quoted JSON value)", () => {
        const events = [
            event("transfer", [{key: "amount", value: "5ubze"}]),
            event("bze.dao.EventProposalSubmitted", [{key: "dao_id", value: '"4"'}, {key: "id", value: '"12"'}, {key: "proposer", value: '"bze1"'}]),
        ];
        expect(proposalIdFromTx({events})).toBe("12");
    });

    it("reads an unquoted value and base64 attributes", () => {
        expect(proposalIdFromTx({events: [event("bze.dao.EventProposalSubmitted", [{key: "id", value: "7"}])]})).toBe("7");
        expect(proposalIdFromTx({events: [event("bze.dao.EventProposalSubmitted", [{key: b64("id"), value: b64('"9"')}])]})).toBe("9");
    });

    it("is null when there is no such event or the id is not a number", () => {
        expect(proposalIdFromTx(null)).toBeNull();
        expect(proposalIdFromTx({})).toBeNull();
        expect(proposalIdFromTx({events: "x"})).toBeNull();
        expect(proposalIdFromTx({events: [event("bze.dao.EventVoted", [{key: "id", value: '"3"'}])]})).toBeNull();
        expect(proposalIdFromTx({events: [event("bze.dao.EventProposalSubmitted", [{key: "id", value: '"abc"'}])]})).toBeNull();
        expect(proposalIdFromTx({events: [null, 5, {type: 3}, {type: "x.EventProposalSubmitted", attributes: [null, {key: 1}]}]})).toBeNull();
    });
});
