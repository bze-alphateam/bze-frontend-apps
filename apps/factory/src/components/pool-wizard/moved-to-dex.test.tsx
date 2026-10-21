import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { queryParams } = vi.hoisted(() => ({ queryParams: { current: new URLSearchParams() } }));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: vi.fn() }),
    useNavigationWithParams: () => ({ getQueryParam: (p: string) => queryParams.current.get(p), navigate: vi.fn() }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...await importActual<typeof import("@bze/bze-ui-kit")>(),
    getDexApp: () => ({ href: "https://dex.test/" }),
}));

import { DEX_REDIRECT_MS, MovedToDex } from "./moved-to-dex";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("/pool/add moved to the DEX", () => {
    it("links to the same pool on the DEX and goes there after 1.5 s", () => {
        queryParams.current = new URLSearchParams({ pool: "factory/bze1x/uhoney_ubze" });
        const go = vi.fn();
        render(<MovedToDex go={go} />, { wrapper });

        const url = `https://dex.test/pools/details?id=${encodeURIComponent("factory/bze1x/uhoney_ubze")}`;
        expect(screen.getByText("Adding and removing liquidity now lives on the DEX.")).toBeInTheDocument();
        const link = screen.getByRole("link", { name: /Open on DEX/ });
        expect(link).toHaveAttribute("href", url);
        expect(link).toHaveAttribute("data-app", "dex");

        act(() => { vi.advanceTimersByTime(DEX_REDIRECT_MS - 1); });
        expect(go).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(1); });
        expect(go).toHaveBeenCalledExactlyOnceWith(url);
    });

    it("sends to the DEX pool list without ?pool=", () => {
        const go = vi.fn();
        render(<MovedToDex go={go} />, { wrapper });
        expect(screen.getByRole("link", { name: /Open on DEX/ })).toHaveAttribute("href", "https://dex.test/pools");
        act(() => { vi.advanceTimersByTime(DEX_REDIRECT_MS); });
        expect(go).toHaveBeenCalledWith("https://dex.test/pools");
    });

    it("does not redirect once the page is left", () => {
        const go = vi.fn();
        const { unmount } = render(<MovedToDex go={go} />, { wrapper });
        unmount();
        act(() => { vi.advanceTimersByTime(DEX_REDIRECT_MS); });
        expect(go).not.toHaveBeenCalled();
    });
});
