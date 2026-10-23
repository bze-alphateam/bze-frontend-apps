import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The Done screen's collaborators are mocked: no chain read for the reward id, no router.
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: vi.fn() }) }));
vi.mock("@/components/guided", () => ({ useReturnTo: () => undefined }));
vi.mock("@/lib/reward-new", () => ({ fetchRewardId: async () => "5" }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...await importActual<typeof import("@bze/bze-ui-kit")>(),
    useAsset: () => ({ asset: undefined, isLoading: false }),
    useToast: () => ({ toast: { success: vi.fn() } }),
    getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
    getDexApp: () => ({ href: "https://dex.test" }),
}));

import { SimpleRewardDone } from "./simple-reward-done";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

beforeEach(() => vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => vi.unstubAllGlobals());

describe("SimpleRewardDone", () => {
    it("Copy staking link puts only the DEX staking URL on the clipboard", async () => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        render(
            <SimpleRewardDone
                hash="ABC"
                input={{ stakingDenom: "factory/bze1a/uhoney", stakingTicker: "HONEY", prizeDenom: "ubze", prizeTicker: "BZE", perDay: "100", prize: "100 BZE a day for 30 days" }}
            />,
            { wrapper },
        );

        const card = screen.getByRole("article", { name: "Recommended next" });
        await user.click(within(card).getByRole("button", { name: /Copy staking link/ }));
        expect(writeText).toHaveBeenCalledWith("https://dex.test/staking?search=HONEY");
    });
});
