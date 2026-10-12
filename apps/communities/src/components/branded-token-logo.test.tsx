import {describe, expect, it} from "vitest";
import type {ReactNode} from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {TOKEN_LOGO_PLACEHOLDER} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import {BrandedTokenLogo, type BrandedTokenLogoProps} from "./branded-token-logo";

forbidNetwork();

function renderLogo(props: Partial<BrandedTokenLogoProps> = {}) {
    return render(
        <BrandedTokenLogo src="" ticker="page" size={36} fill="#BE1981" ink="#FFFFFF" {...props}/>,
        {wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>},
    );
}

describe("BrandedTokenLogo", () => {
    it.each([["no logo", ""], ["ui-kit's placeholder", TOKEN_LOGO_PLACEHOLDER]])(
        "draws the coin placeholder with the ticker's initials for %s",
        (_, src) => {
            const {container} = renderLogo({src});

            expect(screen.getByTestId("token-initials")).toHaveTextContent("PA");
            expect(container.querySelector("img")).toBeNull();
        },
    );

    it("paints the coin in the fill colour and the rings and initials in the ink colour", () => {
        const {container} = renderLogo();
        const [coin, ...rings] = container.querySelectorAll("circle");

        expect(coin).toHaveStyle({fill: "#BE1981"});
        expect(rings).toHaveLength(2);
        rings.forEach((ring) => expect(ring).toHaveStyle({stroke: "#FFFFFF"}));
        expect(container.querySelector("text")).toHaveStyle({fill: "#FFFFFF"});
    });

    it("shows the token's own logo when it has one", () => {
        const {container} = renderLogo({src: "https://example.com/page.svg"});

        expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/page.svg");
        expect(screen.queryByTestId("token-initials")).not.toBeInTheDocument();
    });

    it("falls back to the placeholder when the logo fails to load", () => {
        const {container} = renderLogo({src: "https://example.com/broken.svg"});

        fireEvent.error(container.querySelector("img")!);

        expect(screen.getByTestId("token-initials")).toHaveTextContent("PA");
        expect(container.querySelector("img")).toBeNull();
    });

    it("tries a new logo after a previous one failed", () => {
        const {container, rerender} = renderLogo({src: "https://example.com/broken.svg"});
        fireEvent.error(container.querySelector("img")!);

        rerender(<BrandedTokenLogo src="https://example.com/fixed.svg" ticker="page" size={36} fill="#BE1981" ink="#FFFFFF"/>);

        expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/fixed.svg");
    });
});
