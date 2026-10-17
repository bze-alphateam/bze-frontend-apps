import {describe, expect, it} from "vitest";
import type {GovProposalMessage} from "@bze/bze-ui-kit";
import {isListed, kindLabel, proposalKind, proposalSummary, proposalTitle, statusInfo} from "./proposal";

const msg = (type: string, extra: Record<string, unknown> = {}): GovProposalMessage => ({"@type": type, ...extra});
const legacy = (type: string, extra: Record<string, unknown> = {}) =>
    msg("/cosmos.gov.v1.MsgExecLegacyContent", {content: {"@type": type, ...extra}, authority: "bze10d07…"});

const label = (...messages: GovProposalMessage[]) => kindLabel(proposalKind({messages}));

describe("proposal kind", () => {
    it.each([
        ["/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade", "Software upgrade"],
        ["/cosmos.upgrade.v1beta1.MsgCancelUpgrade", "Software upgrade"],
        ["/cosmos.distribution.v1beta1.MsgCommunityPoolSpend", "Community pool spend"],
        ["/bze.tradebin.MsgUpdateParams", "Parameter change"],
        ["/cosmos.staking.v1beta1.MsgUpdateParams", "Parameter change"],
        ["/bze.cointrunk.MsgSavePublisher", "CoinTrunk publisher"],
        ["/bze.cointrunk.MsgAcceptDomain", "CoinTrunk publisher"],
        ["/ibc.core.client.v1.MsgRecoverClient", "Cross-chain repair"],
        ["/bze.burner.v1.BurnCoinsProposal", "Other"],
    ])("labels %s as %s", (type, expected) => {
        expect(label(msg(type))).toBe(expected);
    });

    it.each([
        ["/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal", "Software upgrade"],
        ["/cosmos.upgrade.v1beta1.CancelSoftwareUpgradeProposal", "Software upgrade"],
        ["/cosmos.distribution.v1beta1.CommunityPoolSpendProposal", "Community pool spend"],
        ["/cosmos.params.v1beta1.ParameterChangeProposal", "Parameter change"],
        ["/bze.cointrunk.v1.PublisherProposal", "CoinTrunk publisher"],
        ["/bze.cointrunk.v1.AcceptedDomainProposal", "CoinTrunk publisher"],
        ["/ibc.core.client.v1.ClientUpdateProposal", "Cross-chain repair"],
        ["/ibc.core.client.v1.UpgradeProposal", "Cross-chain repair"],
        ["/cosmos.gov.v1beta1.TextProposal", "Text"],
        ["/bze.burner.v1.BurnCoinsProposal", "Other"],
    ])("unwraps legacy %s as %s", (type, expected) => {
        expect(label(legacy(type))).toBe(expected);
    });

    it("is Text without messages", () => {
        expect(label()).toBe("Text");
    });

    it("takes the first message that has a kind", () => {
        expect(label(msg("/cosmos.bank.v1beta1.MsgSend"), msg("/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade"))).toBe("Software upgrade");
        expect(label(msg("/cosmos.bank.v1beta1.MsgSend"))).toBe("Other");
    });
});

describe("title and summary", () => {
    it("uses the proposal's own title and summary", () => {
        const p = {id: "48", title: "Upgrade network to v8.2.0", summary: "Upgrade", messages: [legacy("/cosmos.gov.v1beta1.TextProposal", {title: "Old", description: "Old text"})]};
        expect(proposalTitle(p)).toBe("Upgrade network to v8.2.0");
        expect(proposalSummary(p)).toBe("Upgrade");
    });

    it("falls back to the legacy content's title and description", () => {
        const p = {id: "1", title: "", summary: "  ", messages: [legacy("/cosmos.params.v1beta1.ParameterChangeProposal", {title: "Inflation change", description: "Let the rewards begin"})]};
        expect(proposalTitle(p)).toBe("Inflation change");
        expect(proposalSummary(p)).toBe("Let the rewards begin");
    });

    it("falls back to the id", () => {
        const p = {id: "7", title: "", summary: "", messages: [msg("/cosmos.bank.v1beta1.MsgSend")]};
        expect(proposalTitle(p)).toBe("Proposal #7");
        expect(proposalSummary(p)).toBe("");
    });
});

describe("status", () => {
    it("names each listed status", () => {
        expect(statusInfo("PROPOSAL_STATUS_VOTING_PERIOD").text).toBe("Voting");
        expect(statusInfo("PROPOSAL_STATUS_PASSED")).toEqual({text: "Passed", tone: "green"});
        expect(statusInfo("PROPOSAL_STATUS_REJECTED").text).toBe("Rejected");
        expect(statusInfo("PROPOSAL_STATUS_FAILED").text).toBe("Failed");
    });

    it("never lists deposit-period proposals", () => {
        expect(isListed("PROPOSAL_STATUS_DEPOSIT_PERIOD")).toBe(false);
        expect(isListed("PROPOSAL_STATUS_VOTING_PERIOD")).toBe(true);
        expect(isListed("PROPOSAL_STATUS_FAILED")).toBe(true);
    });
});
