import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { NextAction } from "@/lib/next-actions";

const { navigateMock, toastSuccess } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
}));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...await importActual<typeof import("@bze/bze-ui-kit")>(),
    useToast: () => ({ toast: { success: toastSuccess } }),
}));

import { DoneScreen, type DoneScreenProps } from "./index";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

function mockReducedMotion(reduce: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

/** Every CSS rule Chakra emitted for one of the element's classes. */
function rulesFor(el: HTMLElement): string {
    const text = Array.from(document.querySelectorAll("style")).map(s => s.textContent ?? "").join("\n");
    const inserted = Array.from(document.styleSheets).flatMap(sheet => {
        try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText);
        } catch {
            return [];
        }
    });
    return [...text.split("}"), ...inserted].filter(rule => Array.from(el.classList).some(cls => rule.includes(`.${cls}`))).join("\n");
}

const POOL: NextAction = {
    key: "pool", icon: "pool", title: "Let people buy HONEY", text: "Create a HONEY/BZE liquidity pool.", cta: "Create pool",
    target: { href: "/pool/new?base=factory%2Fbze1c%2Fuhoney" },
};
const STAKABLE: NextAction = {
    key: "makeStakable", icon: "stake", title: "Make HONEY stakable", text: "People stake it.", cta: "Make HONEY stakable",
    target: { href: "/denom-reward/token?denom=x" },
};
const AIRDROP: NextAction = {
    key: "airdrop", icon: "airdrop", title: "Airdrop to stakers, once", text: "A one-off gift.", cta: "Airdrop",
    target: { href: "/denom-reward/airdrop?denom=x" }, disabledReason: "Available once someone is staking",
};
const SEND: NextAction = {
    key: "sendToStake", icon: "stake", title: "Send people to stake", text: "Share the link.", cta: "Copy link",
    target: { copy: "HONEY is stakable: https://dex/staking?search=HONEY", copied: "Staking link" },
    alsoApp: { app: "dex", href: "https://dex/staking?search=HONEY", label: "DEX" },
};

const BASE: DoneScreenProps = {
    avatar: { ticker: "HONEY" },
    title: "HONEY is **live**.",
    text: "1,000,000 HONEY just landed in your wallet.",
    subject: "HONEY",
    recommended: POOL,
    more: [STAKABLE, AIRDROP, SEND],
};

beforeEach(() => {
    navigateMock.mockReset();
    toastSuccess.mockReset();
    mockReducedMotion(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("DoneScreen", () => {
    it("renders the hero, the recommended card, the other cards and the footnote", async () => {
        render(
            <DoneScreen
                {...BASE}
                code={{ label: "Token ID", value: "factory/bze1c/uhoney" }}
                links={[
                    { label: "Open token page", href: "/manage/token?denom=x" },
                    { label: "Explorer", href: "https://explorer/txs/ABC", app: "explorer" },
                ]}
                footnote={{ text: "Not now? Every one of these waits for you on", link: { label: "HONEY's token page", href: "/manage/token?denom=x" }, after: "." }}
            />,
            { wrapper },
        );

        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading).toHaveTextContent("HONEY is live.");
        expect(within(heading).getByText("live").tagName).toBe("SPAN");
        expect(screen.getByText("1,000,000 HONEY just landed in your wallet.")).toBeInTheDocument();
        expect(screen.getByText("factory/bze1c/uhoney")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "What's next for HONEY" })).toBeInTheDocument();

        const recommended = screen.getByRole("article", { name: "Recommended next" });
        expect(within(recommended).getByText("Let people buy HONEY")).toBeInTheDocument();
        await userEvent.click(within(recommended).getByRole("button", { name: /Create pool/ }));
        expect(navigateMock).toHaveBeenCalledWith("/pool/new?base=factory%2Fbze1c%2Fuhoney");

        expect(screen.getAllByRole("article")).toHaveLength(4);
        await userEvent.click(within(screen.getByRole("article", { name: "Make HONEY stakable" })).getByRole("button", { name: "Make HONEY stakable" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/denom-reward/token?denom=x");

        await userEvent.click(screen.getByRole("button", { name: "Open token page" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/manage/token?denom=x");

        expect(screen.getByText(/Not now\? Every one of these waits for you on/)).toHaveTextContent("Not now? Every one of these waits for you on HONEY's token page.");
        await userEvent.click(screen.getByRole("link", { name: "HONEY's token page" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/manage/token?denom=x");
    });

    it("focuses its heading on mount, so screen readers announce the result", () => {
        render(<DoneScreen {...BASE} />, { wrapper });
        expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });

    it("shows two overlapping logos for a pair", () => {
        render(<DoneScreen {...BASE} avatar={[{ ticker: "HONEY" }, { ticker: "BZE" }]} title="The HONEY/BZE pool is **open**." />, { wrapper });
        expect(screen.getByTestId("done-avatar").children).toHaveLength(3); // two logos + the check badge
    });

    it("copies the code value and confirms with a toast; a skeleton stands in until it is known", async () => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        const { rerender } = render(<DoneScreen {...BASE} code={{ label: "Pool ID" }} />, { wrapper });
        expect(screen.getByTestId("code-loading")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Copy Pool ID" })).not.toBeInTheDocument();

        rerender(<DoneScreen {...BASE} code={{ label: "Pool ID", value: "12" }} />);
        await user.click(screen.getByRole("button", { name: "Copy Pool ID" }));
        expect(writeText).toHaveBeenCalledWith("12");
        expect(toastSuccess).toHaveBeenCalledWith("Copied", "Pool ID copied to clipboard.");
    });

    it("a copy action copies its text and shows the Copied toast; its DEX link sits beside it", async () => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        render(<DoneScreen {...BASE} />, { wrapper });

        const card = screen.getByRole("article", { name: "Send people to stake" });
        await user.click(within(card).getByRole("button", { name: "Copy link" }));
        expect(writeText).toHaveBeenCalledWith("HONEY is stakable: https://dex/staking?search=HONEY");
        expect(toastSuccess).toHaveBeenCalledWith("Copied", "Staking link copied to clipboard.");
        expect(navigateMock).not.toHaveBeenCalled();

        const dex = within(card).getByRole("link", { name: "DEX" });
        expect(dex).toHaveAttribute("href", "https://dex/staking?search=HONEY");
        expect(dex).toHaveAttribute("data-app", "dex");
    });

    it("app targets render as that app's AppLink, opening in a new tab", () => {
        const dexRecommended: NextAction = {
            key: "addLiquidity", icon: "liquidity", title: "Add liquidity you can withdraw", text: "Deeper pool.", cta: "Add liquidity on DEX",
            target: { app: "dex", href: "https://dex/pools/details?id=12" },
        };
        render(
            <DoneScreen {...BASE} recommended={dexRecommended} links={[{ label: "Explorer", href: "https://explorer/txs/ABC", app: "explorer" }]} />,
            { wrapper },
        );
        const add = screen.getByRole("link", { name: "Add liquidity on DEX" });
        expect(add).toHaveAttribute("href", "https://dex/pools/details?id=12");
        expect(add).toHaveAttribute("data-app", "dex");
        expect(add).toHaveAttribute("target", "_blank");
        const explorer = screen.getByRole("link", { name: "Explorer" });
        expect(explorer).toHaveAttribute("href", "https://explorer/txs/ABC");
        expect(explorer).toHaveAttribute("data-app", "explorer");
    });

    it("runs an onClick target (e.g. the report download)", async () => {
        const download = vi.fn();
        render(
            <DoneScreen {...BASE} recommended={{ key: "report", icon: "download", title: "Download the report", text: "CSV.", cta: "Download report", target: { onClick: download } }} />,
            { wrapper },
        );
        await userEvent.click(screen.getByRole("button", { name: /Download report/ }));
        expect(download).toHaveBeenCalledOnce();
    });

    it("a disabled action shows why and can't be clicked", async () => {
        render(<DoneScreen {...BASE} />, { wrapper });
        const card = screen.getByRole("article", { name: "Airdrop to stakers, once" });
        expect(within(card).getByText("Available once someone is staking")).toBeInTheDocument();
        expect(within(card).getByRole("button", { name: "Airdrop" })).toBeDisabled();
    });

    it("a pending action is disabled with a shimmer until its chain read finishes", () => {
        const pending: NextAction = {
            key: "rewardLps", icon: "reward", title: "Reward liquidity providers", text: "Pay LP stakers.", cta: "Create simple reward",
            target: { href: "/reward/new?staking=" }, disabledReason: "Waiting for the pool share token…", pending: true,
        };
        const { rerender } = render(<DoneScreen {...BASE} more={[pending]} />, { wrapper });
        let card = screen.getByRole("article", { name: "Reward liquidity providers" });
        expect(within(card).getByTestId("pending-rewardLps")).toBeInTheDocument();
        expect(within(card).getByRole("button", { name: "Create simple reward" })).toBeDisabled();

        rerender(<DoneScreen {...BASE} more={[{ ...pending, target: { href: "/reward/new?staking=ulp" }, disabledReason: undefined, pending: undefined }]} />);
        card = screen.getByRole("article", { name: "Reward liquidity providers" });
        expect(within(card).queryByTestId("pending-rewardLps")).not.toBeInTheDocument();
        expect(within(card).getByRole("button", { name: "Create simple reward" })).toBeEnabled();
    });

    it("a copy link copies its URL instead of opening it", async () => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        render(<DoneScreen {...BASE} links={[{ label: "Copy pool link", href: "https://dex/pools/details?id=12", copy: { copied: "Pool link" } }]} />, { wrapper });
        await user.click(screen.getByRole("button", { name: "Copy pool link" }));
        expect(writeText).toHaveBeenCalledWith("https://dex/pools/details?id=12");
        expect(toastSuccess).toHaveBeenCalledWith("Copied", "Pool link copied to clipboard.");
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("shows Back to <label> with a return path, and nothing without one", async () => {
        const { unmount } = render(<DoneScreen {...BASE} back={{ label: "HONEY", href: "/manage/token?denom=x&tab=trading" }} />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Back to HONEY" }));
        expect(navigateMock).toHaveBeenCalledWith("/manage/token?denom=x&tab=trading");
        unmount();

        render(<DoneScreen {...BASE} />, { wrapper });
        expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
    });

    it("leaves out the next-steps section when there is nothing left to do", () => {
        render(<DoneScreen {...BASE} recommended={undefined} more={[]} />, { wrapper });
        expect(screen.queryByRole("heading", { name: "What's next for HONEY" })).not.toBeInTheDocument();
    });

    it("confetti only when celebrating: decorative, and still under reduced motion", () => {
        const { unmount } = render(<DoneScreen {...BASE} />, { wrapper });
        expect(screen.queryByTestId("done-confetti")).not.toBeInTheDocument();
        unmount();

        const celebrating = render(<DoneScreen {...BASE} celebrate />, { wrapper });
        const confetti = screen.getByTestId("done-confetti");
        expect(confetti).toHaveAttribute("aria-hidden", "true");
        expect(confetti.querySelector('[data-animated="true"]')).not.toBeNull();
        celebrating.unmount();

        mockReducedMotion(true);
        render(<DoneScreen {...BASE} celebrate />, { wrapper });
        const still = screen.getByTestId("done-confetti");
        expect(still.querySelectorAll("span").length).toBeGreaterThan(0);
        expect(still.querySelector('[data-animated="true"]')).toBeNull();
        expect(still.querySelector(".done-confetti-fall")).toBeNull();
    });

    it("lays the other cards out in one column on phones and three from md up", () => {
        render(<DoneScreen {...BASE} />, { wrapper });
        const rules = rulesFor(screen.getByTestId("done-more"));
        expect(rules).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
        expect(rules).toMatch(/@media[^{]*min-width[^{]*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    });
});
