import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { loadOfficialProgress, saveOfficialProgress } from "@/lib/registry-entry";

// The registry guide on mocked hooks: the query string, the token's metadata, the registry listing
// (useRegistryListing has its own tests) and, for the Done screen's skip rules, the token's setup.
// Progress uses jsdom localStorage.
const DENOM = "factory/bze1owner/uhoney";
const ENC = encodeURIComponent(DENOM);

const m = vi.hoisted(() => ({
    denom: "factory/bze1owner/uhoney" as string | null,
    navigate: vi.fn(),
    listing: { status: "not-listed" as string, logo: undefined as string | undefined, retry: vi.fn() },
    metadata: undefined as Record<string, unknown> | undefined,
    setup: { brandKit: "todo", stakable: false },
    toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate }),
    useNavigationWithParams: () => ({ navigate: m.navigate, denomParam: m.denom }),
}));
vi.mock("@/hooks/useRegistryListing", () => ({ useRegistryListing: () => m.listing }));
vi.mock("@/hooks/useTokenMetadata", () => ({ useTokenMetadata: () => ({ metadata: m.metadata, isLoading: false, refresh: vi.fn() }) }));
vi.mock("@/hooks/useTokenSetup", () => ({
    useTokenSetup: () => ({
        isLoading: false,
        items: [{ key: "registry", state: "done" }, { key: "brandKit", state: m.setup.brandKit }],
        pools: [],
        hasMarket: false,
        denomReward: m.setup.stakable ? {} : undefined,
        hasStakers: false,
    }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAsset: () => ({ asset: { denom: "factory/bze1owner/uhoney", ticker: "HONEY", name: "Honey Coin", decimals: 6 }, isLoading: false }),
        useToast: () => ({ toast: { success: m.toast } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
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
const step = (title: string) => screen.getByRole("region", { name: title });
const progressText = () => screen.getByTestId("official-progress").textContent;

beforeEach(() => {
    localStorage.clear();
    m.denom = DENOM;
    m.navigate.mockReset();
    m.listing = { status: "not-listed", logo: undefined, retry: vi.fn() };
    m.metadata = METADATA;
    m.setup = { brandKit: "todo", stakable: false };
});

describe("Get your logo in every wallet (/official)", { timeout: 20_000 }, () => {
    it("the breadcrumb back to the token, the h1 and five vertical steps", async () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Get HONEY's logo in every wallet");
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        expect(crumbs).toHaveTextContent("Get your logo in every wallet");
        await userEvent.click(within(crumbs).getByRole("button", { name: "Back to HONEY" }));
        expect(m.navigate).toHaveBeenCalledWith(`/tokens/token?denom=${ENC}`);
        expect(progressText()).toBe("Your progress: 0 of 5 steps");
        expect(step("Logo")).toHaveAttribute("data-state", "active");
        for (const title of ["Links", "Entry", "Submit", "Review"]) expect(step(title)).toHaveAttribute("data-state", "todo");
        expect(screen.queryByRole("region", { name: "Logo rules" })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "How the registry works" })).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Stuck? Ask in the BeeZee community" })).toBeInTheDocument();
    });

    it("on testnet: the registry lists mainnet tokens only, and the files can still be prepared", () => {
        m.listing.status = "off";
        renderPage();
        expect(screen.getByTestId("official-testnet")).toHaveTextContent("The registry only lists mainnet tokens");
        expect(screen.getByTestId("official-testnet")).toHaveTextContent("You can prepare the files here, and submit them once HONEY is on mainnet.");
        expect(step("Logo")).toHaveAttribute("data-state", "active");
    });

    it("a failed registry lookup offers Retry", async () => {
        m.listing.status = "error";
        renderPage();
        expect(screen.getByTestId("official-registry-error")).toHaveTextContent("Couldn't reach the registry right now.");
        await userEvent.click(within(screen.getByTestId("official-registry-error")).getByRole("button", { name: /Retry/ }));
        expect(m.listing.retry).toHaveBeenCalled();
    });

    it("the suggested file name follows the metadata when it loads after the file was chosen", async () => {
        m.metadata = undefined;
        URL.createObjectURL = vi.fn(() => "blob:logo");
        URL.revokeObjectURL = vi.fn();
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/></svg>';
        const { rerender } = renderPage();
        fireEvent.change(screen.getByTestId("logo-file"), { target: { files: [new File([svg], "nectar.svg")] } });
        await waitFor(() => expect(screen.getByTestId("logo-check-name")).toHaveTextContent("Name it honey.svg"));
        expect(screen.getByTestId("logo-check-name")).toHaveAttribute("data-result", "warn");

        m.metadata = { ...METADATA, display: "nectar" };
        rerender(<OfficialPage />);
        expect(screen.getByTestId("logo-check-name")).toHaveTextContent("File name nectar.svg");
        expect(screen.getByTestId("logo-check-name")).toHaveAttribute("data-result", "ok");
    });

    it("walks the steps with a summary for each, generates the entry and stores the progress", async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        URL.createObjectURL = vi.fn(() => "blob:logo");
        URL.revokeObjectURL = vi.fn();
        renderPage();

        // 1: a square PNG passes the checker; the entry uses its format and the suggested name.
        const png = new Uint8Array(64);
        png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 0, 0, 0, 2, 0]);
        fireEvent.change(screen.getByTestId("logo-file"), { target: { files: [new File([png], "Honey.png")] } });
        await waitFor(() => expect(screen.getByTestId("logo-check-square")).toHaveTextContent("Square, 512 × 512"));
        await userEvent.click(within(step("Logo")).getByRole("button", { name: "Mark as done" }));
        expect(step("Logo")).toHaveAttribute("data-state", "done");
        expect(step("Logo")).toHaveTextContent("honey.png · 512×512 · 1 KB ✓");

        // 2: links are https only.
        const links = step("Links");
        await userEvent.type(within(links).getByPlaceholderText("https://"), "http://honey.example");
        expect(within(links).getByRole("button", { name: "Save links" })).toBeDisabled();
        await userEvent.clear(within(links).getByPlaceholderText("https://"));
        await userEvent.type(within(links).getByPlaceholderText("https://"), "https://honey.example");
        await userEvent.type(within(links).getByPlaceholderText("https://x.com/…"), "https://x.com/honey");
        await userEvent.click(within(links).getByRole("button", { name: "Save links" }));
        expect(step("Links")).toHaveTextContent("Website, X");

        // 3: the entry, with Copy and Download, also in the done summary.
        const entry = JSON.parse(screen.getByTestId("official-entry").textContent ?? "");
        expect(entry).toMatchObject({
            name: "Honey Coin",
            symbol: "HONEY",
            logo_URIs: { png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/honey.png" },
            socials: { website: "https://honey.example", x: "https://x.com/honey" },
        });
        await userEvent.click(within(step("Entry")).getByRole("button", { name: "Copy" }));
        expect(writeText).toHaveBeenCalledWith(screen.getByTestId("official-entry").textContent);
        await userEvent.click(within(step("Entry")).getByRole("button", { name: "Download" }));
        expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        await userEvent.click(within(step("Entry")).getByRole("button", { name: "Next step" }));
        expect(step("Entry")).toHaveTextContent("assetlist.json entry ready");
        expect(within(step("Entry")).getByRole("button", { name: "Copy" })).toBeEnabled();
        expect(within(step("Entry")).getByRole("button", { name: "Download" })).toBeEnabled();

        // 4: the PR link.
        const send = step("Submit");
        expect(within(send).getByText("honey.png")).toBeInTheDocument();
        expect(within(send).getByText("Add HONEY to beezee")).toBeInTheDocument();
        const input = within(send).getByPlaceholderText(/chain-registry\/pull/);
        await userEvent.type(input, "https://github.com/cosmos/chain-registry/pull/12/files");
        expect(within(send).getByRole("button", { name: "Save the link" })).toBeDisabled();
        await userEvent.clear(input);
        await userEvent.type(input, "https://github.com/cosmos/chain-registry/pull/12");
        await userEvent.click(within(send).getByRole("button", { name: "Save the link" }));
        expect(step("Submit")).toHaveTextContent("PR #12 opened");

        // 5: waiting for the registry team.
        const review = step("Review");
        expect(review).toHaveAttribute("data-state", "active");
        expect(review).toHaveTextContent("Waiting for the registry team (usually a few days)");
        expect(within(review).getByTestId("official-not-listed")).toHaveTextContent("Not in the registry yet.");
        expect(within(review).getByRole("link", { name: /Your request/ })).toHaveAttribute("href", "https://github.com/cosmos/chain-registry/pull/12");
        expect(screen.getByTestId("official-after-merge")).toHaveTextContent("BeeZee apps show it after their next update.");
        expect(progressText()).toBe("Your progress: 4 of 5 steps");

        expect(loadOfficialProgress(DENOM)).toEqual({
            format: "png",
            fileName: "honey.png",
            width: 512,
            height: 512,
            bytes: 64,
            socials: { website: "https://honey.example", x: "https://x.com/honey" },
            prUrl: "https://github.com/cosmos/chain-registry/pull/12",
            done: ["logo", "links", "entry", "submit"],
        });
    });

    it("restores the progress of this token only, and reopens the first unfinished step", () => {
        saveOfficialProgress(DENOM, { format: "svg", fileName: "hny.svg", done: ["logo", "links"] });
        saveOfficialProgress("factory/bze1owner/other", { done: ["logo", "links", "entry"] });
        renderPage();
        expect(progressText()).toBe("Your progress: 2 of 5 steps");
        expect(step("Logo")).toHaveTextContent("hny.svg ✓");
        expect(step("Links")).toHaveTextContent("Skipped");
        expect(step("Entry")).toHaveAttribute("data-state", "active");
        expect(screen.getByTestId("official-entry")).toHaveTextContent("images/hny.svg");
    });

    describe("Done, once listed", () => {
        it("HONEY is listed, with Back to HONEY recommended, then the brand kit and making it stakable", async () => {
            m.listing = { status: "listed", logo: "https://logo.test/honey.png", retry: vi.fn() };
            saveOfficialProgress(DENOM, { prUrl: "https://github.com/cosmos/chain-registry/pull/3", done: ["logo", "links", "entry", "submit"] });
            renderPage();
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HONEY is listed.");
            expect(screen.getByText("Wallets and apps that read the Cosmos Chain Registry now show its logo.")).toBeInTheDocument();
            const recommended = screen.getByTestId("done-recommended");
            expect(recommended).toHaveTextContent("Back to HONEY");
            await userEvent.click(within(recommended).getByRole("button", { name: "Back to HONEY" }));
            expect(m.navigate).toHaveBeenCalledWith(`/tokens/token?denom=${ENC}`);
            expect(screen.getByText("Brand kit")).toBeInTheDocument();
            expect(screen.getByText("Make it stakable")).toBeInTheDocument();
        });

        it("skips the brand kit and staking when they are done", () => {
            m.listing.status = "listed";
            m.setup = { brandKit: "done", stakable: true };
            renderPage();
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Back to HONEY");
            expect(screen.queryByText("Brand kit")).not.toBeInTheDocument();
            expect(screen.queryByText("Make it stakable")).not.toBeInTheDocument();
        });
    });

    it("warns about a missing description but still lets you copy", async () => {
        m.metadata = { ...METADATA, description: "" };
        saveOfficialProgress(DENOM, { done: ["logo", "links"] });
        renderPage();
        const warning = screen.getByTestId("official-no-description");
        expect(warning).toHaveTextContent("Add a description first, it's shown in wallets.");
        await userEvent.click(within(warning).getByRole("link", { name: "Open Details and look" }));
        expect(m.navigate).toHaveBeenCalledWith(`/tokens/token?denom=${ENC}#details`);
        expect(within(step("Entry")).getByRole("button", { name: "Copy" })).toBeEnabled();
    });

    it("asks for a factory token when the link has none", () => {
        m.denom = null;
        renderPage();
        expect(screen.getByText("Open this guide from your token's page")).toBeInTheDocument();
    });
});
