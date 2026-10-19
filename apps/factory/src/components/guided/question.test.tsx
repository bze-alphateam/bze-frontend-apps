import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { Question } from "./question";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

describe("Question", () => {
    it("active: a section labelled by its title, with the inputs", () => {
        render(<Question number={1} title="What is being traded?" state="active"><input aria-label="the input" /></Question>, { wrapper });

        const section = screen.getByRole("region", { name: "What is being traded?" });
        expect(section).toHaveAttribute("data-state", "active");
        expect(screen.getByLabelText("the input")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Change/ })).not.toBeInTheDocument();
    });

    it("todo: title only, no inputs", () => {
        render(<Question number={2} title="What is it priced in?" state="todo"><input aria-label="the input" /></Question>, { wrapper });

        expect(screen.getByRole("region", { name: "What is it priced in?" })).toHaveAttribute("data-state", "todo");
        expect(screen.queryByLabelText("the input")).not.toBeInTheDocument();
    });

    it("done: the answer as a sentence and a Change button that reopens it", async () => {
        const onChange = vi.fn();
        render(
            <Question number={1} title="What is being traded?" state="done" summary="TOK" onChange={onChange}>
                <input aria-label="the input" />
            </Question>,
            { wrapper },
        );

        expect(screen.getByRole("region", { name: "What is being traded?" })).toHaveAttribute("data-state", "done");
        expect(screen.getByText("TOK")).toBeInTheDocument();
        expect(screen.queryByLabelText("the input")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Change What is being traded?" }));
        expect(onChange).toHaveBeenCalledOnce();
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
