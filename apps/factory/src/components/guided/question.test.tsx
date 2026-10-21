import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { Question, STEP_ENTER_CLASS } from "./question";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

// jsdom has neither matchMedia nor scrollIntoView: both are mocked per test.
const scrollIntoView = vi.fn();
function mockReducedMotion(reduce: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
    mockReducedMotion(false);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Question", () => {
    it("active: the one open card with 'Step N of M · Title', the question as h2 and the inputs", () => {
        render(
            <Question number={2} total={4} title="Supply" question="How many to create?" state="active">
                <input aria-label="the input" />
            </Question>,
            { wrapper },
        );

        const section = screen.getByRole("region", { name: "Supply" });
        expect(section).toHaveAttribute("data-state", "active");
        expect(section).toHaveAttribute("aria-current", "step");
        expect(section).toHaveTextContent("Step 2 of 4 · Supply");
        expect(screen.getByRole("heading", { level: 2, name: "How many to create?" })).toHaveAttribute("tabindex", "-1");
        expect(screen.getByLabelText("the input")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    });

    it("active: Back (never on step 1) and the primary button in the footer", async () => {
        const onBack = vi.fn();
        const onClick = vi.fn();
        const { rerender } = render(
            <Question number={1} total={3} title="Details" state="active" onBack={onBack} action={{ label: "Continue", onClick }} />,
            { wrapper },
        );
        expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(onClick).toHaveBeenCalledOnce();

        rerender(<Question number={2} total={3} title="Supply" state="active" onBack={onBack} action={{ label: "Review token", onClick, disabled: true }} />);
        await userEvent.click(screen.getByRole("button", { name: "Back" }));
        expect(onBack).toHaveBeenCalledOnce();
        expect(screen.getByRole("button", { name: "Review token" })).toBeDisabled();
    });

    it("todo: a dashed row with the title only, no inputs, nothing to click", () => {
        render(<Question number={2} title="What is it priced in?" state="todo"><input aria-label="the input" /></Question>, { wrapper });

        expect(screen.getByRole("region", { name: "What is it priced in?" })).toHaveAttribute("data-state", "todo");
        expect(screen.queryByLabelText("the input")).not.toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("done: the title above the answer and an Edit button that reopens it", async () => {
        const onEdit = vi.fn();
        render(
            <Question number={1} title="What is being traded?" state="done" summary="TOK" onEdit={onEdit}>
                <input aria-label="the input" />
            </Question>,
            { wrapper },
        );

        expect(screen.getByRole("region", { name: "What is being traded?" })).toHaveAttribute("data-state", "done");
        expect(screen.getByText("TOK")).toBeInTheDocument();
        expect(screen.queryByLabelText("the input")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Edit What is being traded?" }));
        expect(onEdit).toHaveBeenCalledOnce();
    });

    it("keeps the same section node through active, done and todo", () => {
        const { rerender } = render(<Question number={1} title="Name and ticker" state="active"><input aria-label="the input" /></Question>, { wrapper });
        const section = screen.getByRole("region", { name: "Name and ticker" });

        rerender(<Question number={1} title="Name and ticker" state="done" summary="Honey (HONEY)" />);
        expect(screen.getByRole("region", { name: "Name and ticker" })).toBe(section);
        expect(section).toHaveAttribute("data-state", "done");
        expect(section).toHaveTextContent("Honey (HONEY)");

        rerender(<Question number={1} title="Name and ticker" state="todo" />);
        expect(screen.getByRole("region", { name: "Name and ticker" })).toBe(section);
        expect(section).toHaveAttribute("data-state", "todo");
    });
});

describe("Question opening", () => {
    const section = () => screen.getByRole("region", { name: "Supply" });

    it("the first open step of a fresh page doesn't slide, scroll or take the focus", () => {
        render(<Question number={1} title="Supply" state="active" />, { wrapper });

        expect(section().className).not.toContain(STEP_ENTER_CLASS.forward);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(document.body);
    });

    it("going forward: slides in from below, scrolls into view and focuses the heading", () => {
        const { rerender } = render(<Question number={2} title="Supply" state="todo" />, { wrapper });
        rerender(<Question number={2} title="Supply" state="active" direction="forward" />);

        expect(section()).toHaveClass(STEP_ENTER_CLASS.forward);
        expect(section()).not.toHaveClass(STEP_ENTER_CLASS.back);
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Supply" }));
    });

    it("going back or editing: slides in from above", () => {
        const { rerender } = render(<Question number={1} title="Supply" state="done" summary="1,000" />, { wrapper });
        rerender(<Question number={1} title="Supply" state="active" direction="back" />);

        expect(section()).toHaveClass(STEP_ENTER_CLASS.back);
        expect(section()).not.toHaveClass(STEP_ENTER_CLASS.forward);
        expect(scrollIntoView).toHaveBeenCalledOnce();
    });

    it("reduced motion: no slide at all and an instant scroll", () => {
        mockReducedMotion(true);
        const { rerender } = render(<Question number={2} title="Supply" state="todo" />, { wrapper });
        rerender(<Question number={2} title="Supply" state="active" direction="forward" />);

        expect(section().className).not.toMatch(/wizard-step-enter/);
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Supply" }));
    });

    it("closing a step neither scrolls nor moves the focus", () => {
        const { rerender } = render(<Question number={1} title="Supply" state="active" />, { wrapper });
        rerender(<Question number={1} title="Supply" state="done" summary="1,000" />);
        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});
