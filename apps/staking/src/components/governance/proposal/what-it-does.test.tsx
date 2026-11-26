import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { GovProposal } from "@bze/bze-ui-kit";
import { WhatItDoes } from "./what-it-does";

const proposal = (...messages: Record<string, unknown>[]) => ({ id: "9", status: "PROPOSAL_STATUS_PASSED", messages }) as unknown as GovProposal;
const resolve = (denom: string) => (denom === "factory/bze1x/HONEY" ? { ticker: "HONEY", decimals: 6 } : undefined);

const renderIt = (p: GovProposal) => render(<ChakraProvider value={defaultSystem}><WhatItDoes proposal={p} resolve={resolve} /></ChakraProvider>);

describe("WhatItDoes — v8.3.0 messages", () => {
    it("says a rate limit add with the token's ticker", () => {
        renderIt(proposal({
            "@type": "/ratelimit.v1.MsgAddRateLimit", denom: "factory/bze1x/HONEY", channel_or_client_id: "channel-0",
            max_percent_send: "2", max_percent_recv: "2", duration_hours: "24",
        }));
        const box = screen.getByTestId("action");
        expect(box).toHaveTextContent("Add an IBC limit for HONEY on channel-0: 2% out / 2% in per 24 h.");
        expect(box).not.toHaveAttribute("data-emergency");
    });

    it("lists each pool of a fee change and falls back to the raw denom", () => {
        renderIt(proposal({
            "@type": "/bze.tradebin.MsgUpdatePools",
            updates: [{ pool_id: "factory/bze1x/HONEY_uusdc", fee: "0.003", fee_dest: { treasury: "0.3", burner: "0.2", providers: "0.5" } }],
        }));
        expect(screen.getByTestId("action")).toHaveTextContent("Change the fees of 1 pool.");
        expect(screen.getByTestId("action-detail")).toHaveTextContent("HONEY/uusdc: fee 0.3%, split 50% liquidity providers / 30% protocol / 20% buyback & burn");
    });

    it("gives an emergency message its own label", () => {
        renderIt(proposal({ "@type": "/bze.guardian.v1.MsgHaltChain", reason: "bug" }));
        const box = screen.getByTestId("action");
        expect(box).toHaveAttribute("data-emergency", "true");
        expect(box).toHaveTextContent("Emergency action");
        expect(box).toHaveTextContent("Reason given: bug");
    });
});
