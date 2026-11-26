import {describe, expect, it, vi} from "vitest";
import {renderHook} from "@testing-library/react";
import {useProposalRedirect} from "./useProposalRedirect";
import type {SubmitState} from "./useProposalSubmit";

const run = (state: SubmitState) => {
    const push = vi.fn();
    const onDone = vi.fn();
    renderHook(() => useProposalRedirect(state, push, onDone));
    return {push, onDone};
};

describe("useProposalRedirect", () => {
    it("lands on the new proposal once it is created, after clearing the draft", () => {
        const {push, onDone} = run({phase: "done", hash: "AB", proposalId: "31"});
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(push).toHaveBeenCalledWith("/proposal/31");
    });

    it("a proposal whose id could not be read stays put but still clears the draft", () => {
        const {push, onDone} = run({phase: "done", hash: "AB", proposalId: null});
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(push).not.toHaveBeenCalled();
    });

    it.each<SubmitState>([
        {phase: "idle"},
        {phase: "working"},
        {phase: "failed", message: "no"},
        {phase: "unconfirmed", message: "later", hash: "AB"},
    ])("%j goes nowhere and keeps the draft", (state) => {
        const {push, onDone} = run(state);
        expect(push).not.toHaveBeenCalled();
        expect(onDone).not.toHaveBeenCalled();
    });
});
