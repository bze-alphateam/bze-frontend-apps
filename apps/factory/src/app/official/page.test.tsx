import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { loadOfficialProgress, saveOfficialProgress } from "@/lib/registry-entry";

// The registry guide on mocked hooks: the query string, the token's metadata, the user's tokens
// and the registry listing (useRegistryListing has its own tests). Progress uses jsdom localStorage.
const DENOM = "factory/bze1owner/uhoney";
const ENC = encodeURIComponent(DENOM);

const m = vi.hoisted(() => ({
    denom: "factory/bze1owner/uhoney" as string | null,
    navigate: vi.fn(),
    listing: { status: "not-listed" as string, logo: undefined as string | undefined, retry: vi.fn() },
    metadata: undefined as Record<string, unknown> | undefined,
    mine: true,
    toast: vi.fn(),
}));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate }),
    useNavigationWithParams: () => ({ navigate: m.navigate, denomParam: m.denom }),
}));
vi.mock("@/hooks/useRegistryListing", () => ({ useRegistryListing: () => m.listing }));
vi.mock("@/hooks/useTokenMetadata", () => ({ useTokenMetadata: () => ({ metadata: m.metadata, isLoading: false, refresh: vi.fn() }) }));
vi.mock("@/hooks/useMyTokens", () => ({
    useMyTokens: () => ({ tokens: m.mine ? [{ asset: { denom: "factory/bze1owner/uhoney" } }] : [], isLoading: false }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAsset: () => ({ asset: { denom: "factory/bze1owner/uhoney", ticker: "HONEY", name: "Honey Coin", decimals: 6 }, isLoading: false }),
        useToast: () => ({ toast: { success: m.toast } }),
    };
});

import OfficialPage from "./page";

const METADATA = {
    description: "Sweet token",
    denom_units: [{ denom: DENOM, exponent: 0, aliases: ["uhoney"] }, { denom: "honey", exponent: 6, aliases: [] }],
    base: DENOM,
    display: "honey",
    name: "Honey Coin",
    symbol: "HONEY",
};

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<OfficialPage />, { wrapper });
const step = (title: string | RegExp) => screen.getByRole("region", { name: title });
const progressText = () => screen.getByTestId("official-progress").textContent;

beforeEach(() => {
    localStorage.clear();
    m.denom = DENOM;
    m.navigate.mockReset();
    m.listing = { status: "not-listed", logo: undefined, retry: vi.fn() };
    m.metadata = METADATA;
    m.mine = true;
});

describe("Make it official (/official)", { timeout: 20_000 }, () => {
    it("shows the header, the breadcrumb to the user's own token and the not-listed banner", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Get HONEY's logo into every wallet" })).toBeInTheDocument();
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        await userEvent.click(within(crumbs).getByRole("link", { name: "Profile" }));
        expect(m.navigate).toHaveBeenCalledWith(`/manage/token?denom=${ENC}&tab=profile`);
        expect(within(crumbs).getByRole("link", { name: "Honey Coin" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Registry status" })).toHaveTextContent("Not in the registry yet.");
        expect(progressText()).toBe("Your progress: 0 of 5 steps");
        expect(step("Prepare your logo")).toHaveAttribute("data-state", "active");
    });

    it("no breadcrumb links for someone else's token", () => {
        m.mine = false;
        renderPage();
        expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).queryByRole("link")).not.toBeInTheDocument();
    });

    it.each([
        ["listed", "Listed. HONEY is in the registry."],
        ["error", "Couldn't reach the registry right now."],
        ["off", "The registry lists mainnet tokens only."],
    ])("banner when %s", (status, text) => {
        m.listing.status = status;
        renderPage();
        expect(screen.getByRole("region", { name: "Registry status" })).toHaveTextContent(text);
    });

    it("walks the steps, generates the entry from the answers and stores the progress", async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        renderPage();

        // 1: PNG follows into the suggested name.
        await userEvent.click(within(step("Prepare your logo")).getByRole("radio", { name: "PNG" }));
        expect(within(step("Prepare your logo")).getByRole("textbox")).toHaveValue("honey.png");
        await userEvent.click(within(step("Prepare your logo")).getByRole("button", { name: "Mark as done" }));
        expect(step("Prepare your logo")).toHaveTextContent("honey.png");

        // 2: links are https only.
        const links = step("Add your links (optional)");
        await userEvent.type(within(links).getByPlaceholderText("https://"), "http://honey.example");
        expect(within(links).getByRole("button", { name: "Save links" })).toBeDisabled();
        await userEvent.clear(within(links).getByPlaceholderText("https://"));
        await userEvent.type(within(links).getByPlaceholderText("https://"), "https://honey.example");
        await userEvent.click(within(links).getByRole("button", { name: "Save links" }));

        // 3: the entry.
        const entry = JSON.parse(screen.getByTestId("official-entry").textContent ?? "");
        expect(entry).toMatchObject({
            name: "Honey Coin",
            symbol: "HONEY",
            logo_URIs: { png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/honey.png" },
            socials: { website: "https://honey.example" },
        });
        await userEvent.click(within(step("Copy your registry entry")).getByRole("button", { name: "Copy" }));
        expect(writeText).toHaveBeenCalledWith(screen.getByTestId("official-entry").textContent);
        await userEvent.click(within(step("Copy your registry entry")).getByRole("button", { name: "Next step" }));

        // 4: the PR link.
        const send = step("Send it to the registry");
        expect(within(send).getByText("honey.png")).toBeInTheDocument();
        expect(within(send).getByText("Add HONEY to beezee")).toBeInTheDocument();
        const input = within(send).getByPlaceholderText(/chain-registry\/pull/);
        await userEvent.type(input, "https://github.com/cosmos/chain-registry/pull/12/files");
        expect(within(send).getByRole("button", { name: "Save the link" })).toBeDisabled();
        await userEvent.clear(input);
        await userEvent.type(input, "https://github.com/cosmos/chain-registry/pull/12");
        await userEvent.click(within(send).getByRole("button", { name: "Save the link" }));

        // 5: waiting for the review.
        expect(step("Wait for the review")).toHaveAttribute("data-state", "active");
        expect(within(step("Wait for the review")).getByRole("link", { name: /Your request/ }))
            .toHaveAttribute("href", "https://github.com/cosmos/chain-registry/pull/12");
        expect(screen.getByTestId("official-after-merge")).toHaveTextContent("BeeZee apps show it after their next update.");
        expect(progressText()).toBe("Your progress: 4 of 5 steps");

        expect(loadOfficialProgress(DENOM)).toEqual({
            format: "png",
            fileName: "honey.png",
            socials: { website: "https://honey.example" },
            prUrl: "https://github.com/cosmos/chain-registry/pull/12",
            done: ["logo", "links", "entry", "submit"],
        });
    });

    it("restores the progress of this token only", () => {
        saveOfficialProgress(DENOM, { format: "svg", fileName: "hny.svg", done: ["logo", "links"] });
        saveOfficialProgress("factory/bze1owner/other", { done: ["logo", "links", "entry"] });
        renderPage();
        expect(progressText()).toBe("Your progress: 2 of 5 steps");
        expect(step("Prepare your logo")).toHaveTextContent("hny.svg");
        expect(step("Copy your registry entry")).toHaveAttribute("data-state", "active");
        expect(screen.getByTestId("official-entry")).toHaveTextContent("images/hny.svg");
    });

    it("the review step is done once the registry lists the token", () => {
        m.listing.status = "listed";
        saveOfficialProgress(DENOM, { prUrl: "https://github.com/cosmos/chain-registry/pull/3", done: ["logo", "links", "entry", "submit"] });
        renderPage();
        expect(step(/Wait for the review/)).toHaveAttribute("data-state", "done");
        expect(progressText()).toBe("Your progress: 5 of 5 steps");
    });

    it("warns about a missing description but still lets you copy", async () => {
        m.metadata = { ...METADATA, description: "" };
        saveOfficialProgress(DENOM, { done: ["logo", "links"] });
        renderPage();
        const warning = screen.getByTestId("official-no-description");
        expect(warning).toHaveTextContent("Add a description first, it's shown in wallets.");
        await userEvent.click(within(warning).getByRole("link", { name: "Open Profile" }));
        expect(m.navigate).toHaveBeenCalledWith(`/manage/token?denom=${ENC}&tab=profile`);
        expect(within(step("Copy your registry entry")).getByRole("button", { name: "Copy" })).toBeEnabled();
    });

    it("asks for a factory token when the link has none", () => {
        m.denom = null;
        renderPage();
        expect(screen.getByText("Open this guide from your token's page")).toBeInTheDocument();
    });
});
