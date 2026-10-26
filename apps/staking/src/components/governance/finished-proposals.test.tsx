import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

import type { ListedProposal } from "@/lib/governance/scan";
import { rulesFor } from "@/test-support/css-rules";
import proposal1 from "@/lib/governance/fixtures/proposal-1.json";
import { FinishedProposals } from "./finished-proposals";

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

describe("FinishedProposals", () => {
    it("lays a phone card out on two equal side columns, so the status pill sits in one place on every card", () => {
        render(
            <FinishedProposals
                proposals={[proposal1 as unknown as ListedProposal]}
                hasOlder={false}
                isLoadingOlder={false}
                olderError={false}
                onLoadOlder={vi.fn()}
            />,
            { wrapper },
        );

        const row = screen.getByTestId("finished-result").closest("a") as HTMLElement;
        expect(rulesFor(row)).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto minmax\(0,\s*1fr\)/);
    });
});
