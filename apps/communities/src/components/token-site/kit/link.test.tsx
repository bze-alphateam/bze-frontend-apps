import {describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";

// Marks what went through next/link: those links move inside the app instead of reloading it.
vi.mock("next/link", () => ({
    default: ({href, children, ...props}: { href: string; children: ReactNode }) => <a href={href} data-next-link="" {...props}>{children}</a>,
}));

import {TsLink, TsLinkButton} from "./index";

const renderLinks = (ui: ReactNode) => render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
const link = (name: string) => screen.getByRole("link", {name});

describe("TsLink", () => {
    it("moves between the site's own pages without reloading the app", () => {
        renderLinks(<>
            <TsLink href="/token/activity?denom=factory%2Fbze1owner%2Fuvdl">Activity</TsLink>
            <TsLinkButton href="/token?denom=factory%2Fbze1owner%2Fuvdl#stake">Back to staking</TsLinkButton>
        </>);

        expect(link("Activity")).toHaveAttribute("data-next-link");
        expect(link("Activity")).toHaveAttribute("href", "/token/activity?denom=factory%2Fbze1owner%2Fuvdl");
        expect(link("Back to staking")).toHaveAttribute("data-next-link");
    });

    it("keeps in-page anchors, external and new-tab links as plain anchors", () => {
        renderLinks(<>
            <TsLink href="#stake">Stake</TsLink>
            <TsLink href="https://dex.getbze.com">DEX</TsLink>
            <TsLink href="//cdn.example.com/x">Protocol-relative</TsLink>
            <TsLinkButton href="/token/activity" target="_blank" rel="noopener noreferrer">New tab</TsLinkButton>
        </>);

        for (const name of ["Stake", "DEX", "Protocol-relative", "New tab"]) {
            expect(link(name)).not.toHaveAttribute("data-next-link");
        }
        expect(link("New tab")).toHaveAttribute("target", "_blank");
    });
});
