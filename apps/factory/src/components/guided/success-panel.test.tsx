import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { params, navigateMock, toastSuccess } = vi.hoisted(() => ({
    params: { current: new URLSearchParams() },
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => params.current }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...await importActual<typeof import("@bze/bze-ui-kit")>(),
    useToast: () => ({ toast: { success: toastSuccess } }),
}));

import { SuccessPanel } from "./success-panel";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

beforeEach(() => {
    params.current = new URLSearchParams();
    navigateMock.mockReset();
    toastSuccess.mockReset();
});

describe("SuccessPanel", () => {
    it("goes back to the Factory home without a return path", async () => {
        render(<SuccessPanel title="Done!" />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Back to the Factory" }));
        expect(navigateMock).toHaveBeenCalledWith("/");
    });

    it("goes back to the return path when there is one", async () => {
        params.current = new URLSearchParams({ return: "/manage/token?denom=x&tab=trading", returnLabel: "TOK" });
        render(<SuccessPanel title="Done!" />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Back to TOK" }));
        expect(navigateMock).toHaveBeenCalledWith("/manage/token?denom=x&tab=trading");
        expect(screen.queryByRole("button", { name: "Back to the Factory" })).not.toBeInTheDocument();
    });

    it("tells a playbook its step is done: completed=1 on the way back, only for a playbook step", async () => {
        params.current = new URLSearchParams({ return: "/playbooks?id=noticed&step=reach", returnLabel: "the playbook" });
        const { unmount } = render(<SuccessPanel title="Done!" />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Back to the playbook" }));
        expect(navigateMock).toHaveBeenCalledWith("/playbooks?id=noticed&step=reach&completed=1");
        unmount();

        // A page's own primary back to the return path gets it too.
        render(<SuccessPanel title="Done!" primary={{ label: "Back to the playbook", href: "/playbooks?id=noticed&step=reach" }} />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Back to the playbook" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/playbooks?id=noticed&step=reach&completed=1");
    });

    it("an external primary opens in a new tab instead of navigating", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        render(<SuccessPanel title="Done!" primary={{ label: "See it in the Burner ↗", href: "https://burner/coin?coin=x", external: true }} />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "See it in the Burner ↗" }));
        expect(open).toHaveBeenCalledWith("https://burner/coin?coin=x", "_blank", "noopener,noreferrer");
        expect(navigateMock).not.toHaveBeenCalled();
        open.mockRestore();
    });

    it("opens links in a new tab, navigates next steps, and runs Do another", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        const again = vi.fn();
        render(
            <SuccessPanel
                title="Done!"
                links={[{ label: "View transaction", href: "https://explorer/tx/1" }]}
                next={[{ label: "Create a liquidity pool", href: "/pool/new?base=a&quote=b" }]}
                again={{ label: "Create another market", onClick: again }}
            />,
            { wrapper },
        );

        await userEvent.click(screen.getByRole("button", { name: /View transaction/ }));
        expect(open).toHaveBeenCalledWith("https://explorer/tx/1", "_blank", "noopener,noreferrer");

        await userEvent.click(screen.getByRole("button", { name: "Create a liquidity pool" }));
        expect(navigateMock).toHaveBeenCalledWith("/pool/new?base=a&quote=b");

        await userEvent.click(screen.getByRole("button", { name: "Create another market" }));
        expect(again).toHaveBeenCalledOnce();
        open.mockRestore();
    });

    it("shows a BZE app's link as that app's outlined button, opening in a new tab", () => {
        render(
            <SuccessPanel
                title="Done!"
                links={[
                    { label: "DEX", href: "https://dex/pools/details?id=1", app: "dex" },
                    { label: "Explorer", href: "https://explorer/txs/1", app: "explorer" },
                ]}
            />,
            { wrapper },
        );
        const dex = screen.getByRole("link", { name: "DEX" });
        expect(dex).toHaveAttribute("href", "https://dex/pools/details?id=1");
        expect(dex).toHaveAttribute("data-app", "dex");
        expect(dex).toHaveAttribute("target", "_blank");
        expect(dex).toHaveAttribute("rel", "noopener noreferrer");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");
        expect(screen.queryByRole("button", { name: /View/ })).not.toBeInTheDocument();
    });

    it("copies the code value and confirms with a toast", async () => {
        const user = userEvent.setup();
        render(<SuccessPanel title="Done!" code={{ label: "Denom", value: "factory/bze1abc/utok" }} />, { wrapper });

        await user.click(screen.getByRole("button", { name: "Copy Denom" }));
        expect(await navigator.clipboard.readText()).toBe("factory/bze1abc/utok");
        expect(toastSuccess).toHaveBeenCalledWith("Copied", "Denom copied to clipboard.");
    });

    it("shows a skeleton until the code value is known, and a disabled next step stays inert", async () => {
        const { rerender } = render(
            <SuccessPanel
                title="Done!"
                code={{ label: "LP token" }}
                next={[{ label: "Reward them", href: "/reward/new", disabled: true }]}
            />,
            { wrapper },
        );
        expect(screen.getByTestId("code-loading")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Copy LP token" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reward them" })).toBeDisabled();

        rerender(
            <SuccessPanel
                title="Done!"
                code={{ label: "LP token", value: "ulp/abc" }}
                next={[{ label: "Reward them", href: "/reward/new?staking=ulp%2Fabc" }]}
            />,
        );
        expect(screen.queryByTestId("code-loading")).not.toBeInTheDocument();
        expect(screen.getByText("ulp/abc")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Reward them" }));
        expect(navigateMock).toHaveBeenCalledWith("/reward/new?staking=ulp%2Fabc");
    });
});
