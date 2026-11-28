import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {CONFIG, DAO, PARAMS} from "@/test/composer-fixtures";
import {Basics} from "./basics";

const renderBasics = (over: {title?: string; summary?: string; allowExpedite?: boolean; onExpedited?: (v: boolean) => void} = {}) => render(
    <ChakraProvider value={defaultSystem}>
        <Basics
            dao={{...DAO, config: {...CONFIG, allow_expedite: over.allowExpedite ?? true}}}
            params={PARAMS}
            title={over.title ?? "Fund the push"}
            summary={over.summary ?? "Why: https://example.com/plan"}
            expedited={false}
            onTitle={() => {}}
            onSummary={() => {}}
            onExpedited={over.onExpedited ?? (() => {})}
        />
    </ChakraProvider>,
);

describe("the composer's basics", () => {
    it("counts the title in bytes against the chain's limit", () => {
        renderBasics({title: "Fund the push"});
        expect(screen.getByTestId("title-count")).toHaveTextContent(/^13 of 140 bytes$/);
        expect(screen.getByTestId("proposal-title")).not.toHaveAttribute("aria-invalid");
    });

    it("over the limit, says to shorten it and that emoji count more", () => {
        renderBasics({title: "é".repeat(71)});
        expect(screen.getByTestId("title-count")).toHaveTextContent("142 of 140 bytes: shorten it. Emoji and accents count as 2–4 bytes.");
        expect(screen.getByTestId("proposal-title")).toHaveAttribute("aria-invalid", "true");
    });

    it("Write / Preview: Write is pressed first, Preview shows the summary as plain text", () => {
        renderBasics();
        expect(screen.getByTestId("summary-write")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("summary-preview-toggle")).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByTestId("proposal-summary-input")).toBeTruthy();
        fireEvent.click(screen.getByTestId("summary-preview-toggle"));
        expect(screen.getByTestId("summary-preview-toggle")).toHaveAttribute("aria-pressed", "true");
        expect(screen.queryByTestId("proposal-summary-input")).toBeNull();
        expect(screen.getByTestId("summary-preview").querySelector("a")).toHaveAttribute("href", "https://example.com/plan");
        fireEvent.click(screen.getByTestId("summary-write"));
        expect(screen.getByTestId("proposal-summary-input")).toBeTruthy();
    });

    it("says the summary is plain text, with its byte count", () => {
        renderBasics({summary: "abc"});
        expect(screen.getByTestId("summary-count")).toHaveTextContent("Plain text. 3 of 5,000 bytes.");
    });

    it("the expedited switch is a checkbox switch with the DAO's own numbers", () => {
        const onExpedited = vi.fn();
        renderBasics({onExpedited});
        const toggle = screen.getByTestId("expedited-switch");
        expect(toggle).toHaveAttribute("role", "switch");
        expect(screen.getByTestId("expedite-explanation")).toHaveTextContent("Shorter vote (1 day) that can settle early");
        fireEvent.click(toggle);
        expect(onExpedited).toHaveBeenCalledWith(true);
        expect(screen.queryByTestId("expedite-not-allowed")).toBeNull();
    });

    it("a DAO that does not allow expedited proposals gets a note instead of the switch", () => {
        renderBasics({allowExpedite: false});
        expect(screen.queryByTestId("expedited-switch")).toBeNull();
        expect(screen.getByTestId("expedite-not-allowed")).toHaveTextContent("This DAO doesn't allow expedited proposals, so the switch isn't shown.");
    });
});
