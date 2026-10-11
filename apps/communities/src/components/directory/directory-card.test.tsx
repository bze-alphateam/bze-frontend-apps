import {describe, it, expect, vi, beforeEach} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Asset, DenomBranding} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

let colorMode: "light" | "dark" = "light";
vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode, setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import {DirectoryCard, type DirectoryCardProps} from "./directory-card";

forbidNetwork();

const KIT: DenomBranding = {
    font: "poppins",
    light: {background: "#FFFFFF", text: "#111111", primary: "#BE1981", secondary: "#334455"},
    dark: {background: "#000000", text: "#EEEEEE", primary: "#E67FC0", secondary: "#AABBCC"},
};

const ASSET: Asset = {
    type: "factory", denom: "factory/bze1owner/upage", decimals: 6, name: "Page Token", ticker: "PAGE",
    logo: "", stable: false, verified: true, supply: 97_660_000_000_000n,
};

function renderCard(props: Partial<DirectoryCardProps> = {}) {
    return render(
        <DirectoryCard
            asset={ASSET}
            kit={KIT}
            price={new BigNumber("0.0412")}
            change={5.8}
            holdersPool={false}
            rewardPrograms={false}
            tradable={true}
            {...props}
        />,
        {wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>},
    );
}

beforeEach(() => {
    colorMode = "light";
});

describe("DirectoryCard", () => {
    it("draws the strip and the logo ring in the kit's light primary", () => {
        renderCard();
        expect(screen.getByTestId("directory-card-strip")).toHaveStyle({background: "#BE1981"});
        expect(screen.getByTestId("directory-card-logo")).toHaveStyle({borderColor: "#BE1981"});
    });

    it("uses the kit's dark primary in dark mode", () => {
        colorMode = "dark";
        renderCard();
        expect(screen.getByTestId("directory-card-strip")).toHaveStyle({background: "#E67FC0"});
    });

    it("falls back to the neutral strip without a kit (no kit or a failed branding query)", () => {
        renderCard({kit: undefined});
        expect(screen.getByTestId("directory-card-strip").getAttribute("style")).toBeNull();
        expect(screen.getByTestId("directory-card-logo").getAttribute("style")).toBeNull();
    });

    it("shows name, verified mark, ticker, price, change and supply, and links to the token page", () => {
        renderCard();
        const card = screen.getByRole("link");

        expect(card).toHaveAttribute("href", "/token?denom=factory%2Fbze1owner%2Fupage");
        expect(card).toHaveAttribute("target", "_blank");
        expect(card).toHaveTextContent("Page Token");
        expect(card).toHaveTextContent("PAGE");
        expect(screen.getByRole("img", {name: "Verified"})).toBeInTheDocument();
        expect(card).toHaveTextContent("$0.0412");
        expect(card).toHaveTextContent("+5.8%");
        expect(card).toHaveTextContent("97.66M");
    });

    it("shows dashes without a price or a market", () => {
        renderCard({price: new BigNumber(0), change: undefined});
        expect(screen.getAllByText("—")).toHaveLength(2);
    });

    it("shows the reward and trading badges", () => {
        renderCard({holdersPool: true, rewardPrograms: true, tradable: false});
        expect(screen.getByText("Holders pool")).toBeInTheDocument();
        expect(screen.getByText("Reward programs")).toBeInTheDocument();
        expect(screen.getByText("Not traded yet")).toBeInTheDocument();
    });

    it("shows no badge for a traded token without rewards", () => {
        renderCard();
        expect(screen.queryByText("Holders pool")).not.toBeInTheDocument();
        expect(screen.queryByText("Not traded yet")).not.toBeInTheDocument();
    });
});
