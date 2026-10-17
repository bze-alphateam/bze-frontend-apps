import { describe, it, expect } from "vitest";
import type { GovProposal, GovProposalMessage } from "@bze/bze-ui-kit";
import { describeProposal } from "./index";
import proposal1 from "../fixtures/proposal-1.json";
import proposal45 from "../fixtures/proposal-45.json";
import proposal48 from "../fixtures/proposal-48.json";

// One test per ported reader. Upgrade, spend and the legacy parameter change
// read real mainnet proposals (#48, #45, #1, saved from
// rest.getbze.com/cosmos/gov/v1/proposals/<id>); the kinds mainnet has no
// recent example of use message JSON in the same shape.

const withMessages = (...messages: GovProposalMessage[]) => ({ messages });
const legacy = (content: Record<string, unknown>): GovProposalMessage => ({
    "@type": "/cosmos.gov.v1.MsgExecLegacyContent",
    content: content as GovProposalMessage["content"],
    authority: "bze10d07y265gmmuvt4z0w9aw880jnsr700j8xlwyy",
});

describe("describeProposal", () => {
    it("reads a software upgrade (#48)", () => {
        expect(describeProposal(proposal48 as GovProposal)).toEqual([
            { type: "upgrade", name: "v8.2.0", height: 25263600 },
        ]);
    });

    it("reads a cancelled upgrade", () => {
        expect(describeProposal(withMessages({ "@type": "/cosmos.upgrade.v1beta1.MsgCancelUpgrade", authority: "bze1gov" })))
            .toEqual([{ type: "cancel_upgrade" }]);
    });

    it("reads a community pool spend (#45)", () => {
        expect(describeProposal(proposal45 as GovProposal)).toEqual([
            {
                type: "spend",
                recipient: "bze1jx4x3kn8mlz2s03zdpf2a38x9gl66llvjqdd55",
                amount: [{ denom: "ubze", amount: "3000000000000" }],
            },
        ]);
    });

    it("reads a legacy parameter change inside MsgExecLegacyContent (#1)", () => {
        expect(describeProposal(proposal1 as GovProposal)).toEqual([
            {
                type: "params",
                module: "mint",
                whole: false,
                entries: [
                    { key: "InflationMax", value: "\"0.150000000000000000\"" },
                    { key: "InflationMin", value: "\"0.050000000000000000\"" },
                    { key: "GoalBonded", value: "\"0.200000000000000000\"" },
                    { key: "InflationRateChange", value: "\"0.100000000000000000\"" },
                ],
            },
        ]);
    });

    it("reads a module's MsgUpdateParams as all of its parameters", () => {
        expect(describeProposal(withMessages({
            "@type": "/bze.tradebin.v1.MsgUpdateParams",
            authority: "bze1gov",
            params: { createMarketFee: "1000ubze", makerFee: "100ubze" },
        }))).toEqual([{
            type: "params",
            module: "tradebin",
            whole: true,
            entries: [{ key: "createMarketFee", value: "1000ubze" }, { key: "makerFee", value: "100ubze" }],
        }]);
    });

    it("reads CoinTrunk publishers and domains", () => {
        expect(describeProposal(withMessages(
            legacy({ "@type": "/bze.cointrunk.v1.PublisherProposal", title: "t", description: "d", name: "Bee News", address: "bze1publisher", active: true }),
            legacy({ "@type": "/bze.cointrunk.v1.AcceptedDomainProposal", title: "t", description: "d", domain: "example.com", active: false }),
        ))).toEqual([
            { type: "publisher", add: true, name: "Bee News", address: "bze1publisher" },
            { type: "domain", add: false, domain: "example.com" },
        ]);
    });

    it("reads a client recovery", () => {
        expect(describeProposal(withMessages({
            "@type": "/ibc.core.client.v1.MsgRecoverClient",
            subject_client_id: "07-tendermint-0",
            substitute_client_id: "07-tendermint-9",
            signer: "bze1gov",
        }))).toEqual([{ type: "ibc_client", subject: "07-tendermint-0", substitute: "07-tendermint-9" }]);
    });

    it("says a text proposal does nothing, and a proposal without messages too", () => {
        expect(describeProposal(withMessages(legacy({ "@type": "/cosmos.gov.v1beta1.TextProposal", title: "t", description: "d" }))))
            .toEqual([{ type: "text" }]);
        expect(describeProposal(withMessages())).toEqual([{ type: "text" }]);
    });

    it("lists the fields of a message no reader knows, without the legacy title and description", () => {
        expect(describeProposal(withMessages(
            legacy({ "@type": "/bze.burner.v1.SomethingNewProposal", title: "t", description: "d", amount: "5", empty: "" }),
        ))).toEqual([{
            type: "other",
            title: "Something new proposal",
            typeUrl: "/bze.burner.v1.SomethingNewProposal",
            entries: [{ key: "amount", value: "5" }],
        }]);
    });
});
