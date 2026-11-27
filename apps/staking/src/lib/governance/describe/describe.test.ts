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
    describe("v8.3.0 governance messages", () => {
        const msg = (type: string, body: Record<string, unknown> = {}) =>
            describeProposal(withMessages({ "@type": type, authority: "bze1gov", ...body } as GovProposalMessage));
        const rl = { denom: "factory/bze1x/HONEY", channel_or_client_id: "channel-0", max_percent_send: "2", max_percent_recv: "2", duration_hours: "24" };
        const honey = { denom: "factory/bze1x/HONEY" };
        const sentence = (title: unknown[], details: unknown[][] = [], emergency = false) => [{ type: "sentence", emergency, title, details }];

        it("reads the rate limit messages", () => {
            expect(msg("/ratelimit.v1.MsgAddRateLimit", rl))
                .toEqual(sentence(["Add an IBC limit for ", honey, " on ", "channel-0", ": 2% out / 2% in per 24 h"]));
            expect(msg("/ratelimit.v1.MsgUpdateRateLimit", rl))
                .toEqual(sentence(["Change the IBC limit of ", honey, " on ", "channel-0", " to 2% out / 2% in per 24 h"]));
            expect(msg("/ratelimit.v1.MsgRemoveRateLimit", rl))
                .toEqual(sentence(["Remove the IBC limit of ", honey, " on ", "channel-0"]));
            expect(msg("/ratelimit.v1.MsgResetRateLimit", rl))
                .toEqual(sentence(["Reset today's counted flow of ", honey, " on ", "channel-0"]));
        });

        it("reads the guardian's undo messages", () => {
            expect(msg("/bze.guardian.v1.MsgUnblockDenom", { denom: "uatone" })).toEqual(sentence(["Allow ", { denom: "uatone" }, " to cross chains again"]));
            expect(msg("/bze.guardian.v1.MsgReopenChannel", { channel_id: "channel-3" })).toEqual(sentence(["Reopen transfers on channel-3"]));
            expect(msg("/bze.guardian.v1.MsgResumeAutomation")).toEqual(sentence(["Resume fee conversion and burning"]));
        });

        it("reads the emergency messages, marked as emergencies", () => {
            expect(msg("/bze.guardian.v1.MsgBlockDenom", { denom: "uatone" })).toEqual(sentence(["Emergency: stop ", { denom: "uatone" }, " from crossing chains"], [], true));
            expect(msg("/bze.guardian.v1.MsgCloseChannel", { channel_id: "channel-3" })).toEqual(sentence(["Emergency: close transfers on channel-3"], [], true));
            expect(msg("/bze.guardian.v1.MsgPauseAutomation")).toEqual(sentence(["Emergency: pause fee conversion and burning"], [], true));
            expect(msg("/bze.guardian.v1.MsgTightenRateLimit", { denom: "uatone", channel_id: "channel-3", max_percent_send: "1", max_percent_recv: "3" }))
                .toEqual(sentence(["Emergency: lower the IBC limit of ", { denom: "uatone" }, " on channel-3", " to 1% out / 3% in"], [], true));
            expect(msg("/bze.guardian.v1.MsgDisableMessages", { msg_type_urls: ["/bze.tradebin.MsgCreateOrder", "/bze.tradebin.MsgMultiSwap"] }))
                .toEqual(sentence(["Emergency: switch off these actions: Create order, Multi swap"], [], true));
            expect(msg("/bze.guardian.v1.MsgHaltTradingDenoms", { denoms: ["ubze", "uatone", "uusdc"] }))
                .toEqual(sentence(["Emergency: halt trading of ", { denom: "ubze" }, ", ", { denom: "uatone" }, " and ", { denom: "uusdc" }], [], true));
            expect(msg("/bze.guardian.v1.MsgHaltChain", { reason: "state corruption" }))
                .toEqual(sentence(["Emergency: stop the chain at the next block"], [["Reason given: state corruption"]], true));
        });

        it("reads a circuit breaker reset, an empty list meaning every action", () => {
            expect(msg("/cosmos.circuit.v1.MsgResetCircuitBreaker", { msg_type_urls: ["/bze.tradebin.MsgCreateOrder", "/bze.tradebin.MsgMultiSwap"] }))
                .toEqual(sentence(["Switch these actions back on: Create order, Multi swap"]));
            expect(msg("/cosmos.circuit.v1.MsgResetCircuitBreaker", { msg_type_urls: [] }))
                .toEqual(sentence(["Switch every paused action back on"]));
        });

        it("reads a token handed to a new admin", () => {
            expect(msg("/bze.tokenfactory.MsgSetDenomAdmin", { denom: "factory/bze1x/HONEY", new_admin: "bze1dao" }))
                .toEqual(sentence(["Give control of ", honey, " to ", { address: "bze1dao" }]));
        });

        it("reads pool fee changes, one line per pool, as percents with up to 2 decimals", () => {
            const fee_dest = { treasury: "0.3", burner: "0.2", providers: "0.5" };
            expect(msg("/bze.tradebin.MsgUpdatePools", {
                updates: [
                    { pool_id: "ubze_uusdc", fee: "0.003000000000000000", fee_dest },
                    { pool_id: "weird", fee: "0.0125", fee_dest: { treasury: "0.25", burner: "0.25", providers: "0.5" } },
                ],
            })).toEqual(sentence(["Change the fees of 2 pools"], [
                [{ denom: "ubze" }, "/", { denom: "uusdc" }, ": fee 0.3%, split LP Rewards 50% / Protocol 30% / Buyback & Burn 20%"],
                ["weird", ": fee 1.25%, split LP Rewards 50% / Protocol 25% / Buyback & Burn 25%"],
            ]));
        });

        it("reads trading halts and resumes", () => {
            expect(msg("/bze.tradebin.MsgHaltDenoms", { denoms: ["uatone"] })).toEqual(sentence(["Halt trading of ", { denom: "uatone" }]));
            expect(msg("/bze.tradebin.MsgUnhaltDenoms", { denoms: ["uatone", "ubze"] })).toEqual(sentence(["Resume trading of ", { denom: "uatone" }, " and ", { denom: "ubze" }]));
        });

        it("survives malformed bodies with fallback words", () => {
            expect(msg("/ratelimit.v1.MsgAddRateLimit", {})).toEqual(sentence(["Add an IBC limit for ", "a token", " on ", "a channel"]));
            expect(msg("/bze.guardian.v1.MsgUnblockDenom")).toEqual(sentence(["Allow ", "a token", " to cross chains again"]));
            expect(msg("/bze.guardian.v1.MsgBlockDenom")).toEqual(sentence(["Emergency: stop ", "a token", " from crossing chains"], [], true));
            expect(msg("/bze.tokenfactory.MsgSetDenomAdmin")).toEqual(sentence(["Give control of ", "a token", " to ", "an unknown account"]));
            expect(msg("/bze.tradebin.MsgUpdatePools", { updates: "nope" })).toEqual(sentence(["Change the fees of 0 pools"]));
            expect(msg("/bze.tradebin.MsgUpdatePools", { updates: [{ pool_id: "ubze_uusdc", fee: "abc" }] })).toEqual(sentence(["Change the fees of 1 pool"], [
                [{ denom: "ubze" }, "/", { denom: "uusdc" }, ": fee unknown, split LP Rewards unknown / Protocol unknown / Buyback & Burn unknown"],
            ]));
        });

        it("still unwraps a legacy message and still falls back to other for an unknown type", () => {
            expect(describeProposal(withMessages({
                "@type": "/cosmos.gov.v1.MsgExecLegacyContent",
                content: { "@type": "/ratelimit.v1.MsgRemoveRateLimit", ...rl } as GovProposalMessage["content"],
                authority: "bze1gov",
            }))).toEqual(sentence(["Remove the IBC limit of ", honey, " on ", "channel-0"]));
            expect(msg("/bze.guardian.v1.MsgSomethingElse", { x: "1" })).toEqual([{
                type: "other", title: "Something else", typeUrl: "/bze.guardian.v1.MsgSomethingElse", entries: [{ key: "x", value: "1" }],
            }]);
        });
    });
});
