import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { Markdown } from "./markdown";

// A proposal's summary is anyone's text: no raw HTML, no script URLs, no images.

function renderMarkdown(text: string) {
    return render(
        <ChakraProvider value={defaultSystem}>
            <Markdown text={text} />
        </ChakraProvider>
    );
}

describe("Markdown", () => {
    it("renders no element for a <script> or an <img onerror>", () => {
        const { container } = renderMarkdown(
            "Hello <script>alert(1)</script>\n\n<img src=x onerror=\"alert(2)\">\n\nWorld"
        );

        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("[onerror]")).toBeNull();
        expect(screen.getByTestId("markdown")).toHaveTextContent("Hello");
        expect(screen.getByTestId("markdown")).toHaveTextContent("World");
    });

    it("drops a javascript: link", () => {
        const { container } = renderMarkdown("[click me](javascript:alert(1))");

        expect(screen.getByText("click me")).toBeInTheDocument();
        expect(container.querySelector("a")).toBeNull();
    });

    it("turns an image into a link", () => {
        const { container } = renderMarkdown("![the chart](https://example.com/chart.png)");

        expect(container.querySelector("img")).toBeNull();
        expect(screen.getByRole("link", { name: "the chart" })).toHaveAttribute("href", "https://example.com/chart.png");
    });

    it("opens http links in a new tab without passing referrer or rank", () => {
        renderMarkdown("Notes: [release](https://github.com/bze-alphateam/bze/releases/tag/v8.2.0)");

        const link = screen.getByRole("link", { name: "release" });
        expect(link).toHaveAttribute("href", "https://github.com/bze-alphateam/bze/releases/tag/v8.2.0");
        expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("renders GitHub tables and lists", () => {
        const { container } = renderMarkdown("- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |");

        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(container.querySelector("table")).not.toBeNull();
    });
});
