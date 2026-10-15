import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { LogoStep } from "./logo-step";

// The step reads the chosen file with the real FileReader (jsdom) and the real checkLogo;
// jsdom has no object URLs, so those are stubbed.
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

const SQUARE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>';
const WIDE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><circle cx="5" cy="5" r="4"/></svg>';

const choose = (content: BlobPart, name: string) =>
    fireEvent.change(screen.getByTestId("logo-file"), { target: { files: [new File([content], name)] } });

let onReady: ReturnType<typeof vi.fn>;

beforeEach(() => {
    onReady = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:logo");
    URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe("LogoStep (logo checker)", () => {
    it("a passing logo with the wrong name is done under the suggested name", async () => {
        render(<LogoStep display="HONEY" onReady={onReady} />, { wrapper });
        expect(screen.getAllByText("Checked in your browser, nothing is uploaded.").length).toBeGreaterThan(0);

        choose(SQUARE_SVG, "Honey Logo.svg");
        await waitFor(() => expect(screen.getByTestId("logo-check-square")).toHaveAttribute("data-result", "ok"));
        expect(screen.getByTestId("logo-check-name")).toHaveAttribute("data-result", "warn");
        expect(screen.getByTestId("logo-check-name")).toHaveTextContent("Name it honey.svg when you upload it");

        await userEvent.click(screen.getByRole("button", { name: "Mark as done" }));
        expect(onReady).toHaveBeenCalledWith({ format: "svg", fileName: "honey.svg" });
    });

    it("previews through <img> only, never inline SVG", async () => {
        const { container } = render(<LogoStep display="HONEY" onReady={onReady} />, { wrapper });
        choose(SQUARE_SVG, "honey.svg");
        await waitFor(() => expect(screen.getByTestId("logo-preview")).toBeInTheDocument());
        const imgs = screen.getAllByRole("img");
        expect(imgs.map(i => i.getAttribute("alt"))).toEqual(["On a light wallet", "On a dark wallet"]);
        imgs.forEach(img => expect(img).toHaveAttribute("src", "blob:logo"));
        expect(container.querySelector("script, circle[r=\"4\"]")).toBeNull();
    });

    it("a failed check blocks Mark as done; Choose another file resets", async () => {
        render(<LogoStep display="HONEY" onReady={onReady} />, { wrapper });
        choose(WIDE_SVG, "honey.svg");
        await waitFor(() => expect(screen.getByTestId("logo-check-square")).toHaveAttribute("data-result", "fail"));
        expect(screen.getByRole("button", { name: "Mark as done" })).toBeDisabled();
        expect(onReady).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole("button", { name: "Choose another file" }));
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:logo");
        expect(screen.getByRole("button", { name: "Choose a file" })).toBeInTheDocument();
        expect(screen.queryByTestId("logo-check-square")).not.toBeInTheDocument();
    });

    it("a JPG gets no preview and cannot be used", async () => {
        render(<LogoStep display="HONEY" onReady={onReady} />, { wrapper });
        choose(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "honey.png");
        await waitFor(() => expect(screen.getByTestId("logo-check-format")).toHaveAttribute("data-result", "fail"));
        expect(screen.queryByTestId("logo-preview")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mark as done" })).toBeDisabled();
    });
});
