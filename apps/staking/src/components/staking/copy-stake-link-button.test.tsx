import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { successMock, errorMock } = vi.hoisted(() => ({ successMock: vi.fn(), errorMock: vi.fn() }));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return { ...actual, useToast: () => ({ toast: { success: successMock, error: errorMock } }) };
});

import { CopyStakeLinkButton } from "./copy-stake-link-button";

const OPERATOR = "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu";

function renderButton() {
    return render(<CopyStakeLinkButton operatorAddress={OPERATOR} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    successMock.mockReset();
    errorMock.mockReset();
});

describe("CopyStakeLinkButton", () => {
    it("copies the stake link for this origin and confirms with a toast", async () => {
        const user = userEvent.setup();
        renderButton();

        await user.click(screen.getByRole("button", { name: "Copy stake link" }));

        expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/?stake=${OPERATOR}`);
        expect(successMock).toHaveBeenCalledWith("Stake link copied", expect.any(String));
    });

    it("reports a blocked clipboard", async () => {
        const user = userEvent.setup();
        renderButton();
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));

        await user.click(screen.getByRole("button", { name: "Copy stake link" }));

        expect(errorMock).toHaveBeenCalledWith("Could not copy the link", expect.any(String));
        expect(successMock).not.toHaveBeenCalled();
    });
});
