import {describe, expect, it, vi} from "vitest";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {Pagination, PrevNext} from "./pagination";

const renderUi = (ui: React.ReactElement) => render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

// the desktop and the phone pager are both in the page, a breakpoint shows one: tests read each by its box
const desktop = () => within(screen.getByTestId("pager-desktop"));
const phone = () => within(screen.getByTestId("pager-phone"));
const names = (scope: ReturnType<typeof desktop>) => scope.getAllByRole("button", {hidden: true}).map((b) => b.getAttribute("aria-label"));

describe("Pagination", () => {
    it("is hidden when everything fits on one page, and keeps the count", () => {
        renderUi(<Pagination page={1} pages={1} onPage={vi.fn()} count="4 DAOs" />);

        expect(screen.queryByTestId("pager-desktop")).toBeNull();
        expect(screen.queryByTestId("pager-phone")).toBeNull();
        expect(screen.getByTestId("list-count")).toHaveTextContent("4 DAOs");
    });

    it("lists the four pages with the current one marked, Prev off on the first page", async () => {
        const onPage = vi.fn();
        renderUi(<Pagination page={1} pages={4} onPage={onPage} count="1–20 of 70 DAOs" />);

        expect(names(desktop())).toEqual(["Previous page", "Page 1", "Page 2", "Page 3", "Page 4", "Next page"]);
        expect(desktop().getByRole("button", {name: "Page 1", hidden: true})).toHaveAttribute("aria-current", "page");
        expect(desktop().getByRole("button", {name: "Previous page", hidden: true})).toBeDisabled();
        expect(desktop().getByRole("button", {name: "Next page", hidden: true})).toBeEnabled();

        await userEvent.click(desktop().getByRole("button", {name: "Page 3", hidden: true}));
        expect(onPage).toHaveBeenLastCalledWith(3);
        await userEvent.click(desktop().getByRole("button", {name: "Next page", hidden: true}));
        expect(onPage).toHaveBeenLastCalledWith(2);
    });

    it("turns Next off on the last page and Prev goes back one", async () => {
        const onPage = vi.fn();
        renderUi(<Pagination page={4} pages={4} onPage={onPage} count="61–70 of 70 DAOs" />);

        expect(desktop().getByRole("button", {name: "Next page", hidden: true})).toBeDisabled();
        await userEvent.click(desktop().getByRole("button", {name: "Previous page", hidden: true}));
        expect(onPage).toHaveBeenCalledWith(3);
    });

    it("does not call back for the page that is already shown", async () => {
        const onPage = vi.fn();
        renderUi(<Pagination page={2} pages={4} onPage={onPage} count="" />);
        await userEvent.click(desktop().getByRole("button", {name: "Page 2", hidden: true}));
        expect(onPage).not.toHaveBeenCalled();
    });

    it("leaves gaps with twelve pages", () => {
        renderUi(<Pagination page={5} pages={12} onPage={vi.fn()} count="" />);

        expect(names(desktop()).filter(Boolean)).toEqual(["Previous page", "Page 1", "Page 4", "Page 5", "Page 6", "Page 12", "Next page"]);
        expect(desktop().getAllByText("…", {ignore: "button"})).toHaveLength(2);
    });

    it("is Prev, 'Page n of N', Next on a phone", async () => {
        const onPage = vi.fn();
        renderUi(<Pagination page={5} pages={12} onPage={onPage} count="81–100 of 230 DAOs" />);

        expect(phone().getByText("Page 5 of 12")).toBeInTheDocument();
        await userEvent.click(phone().getByRole("button", {name: "Next page", hidden: true}));
        expect(onPage).toHaveBeenCalledWith(6);
    });

    it("keeps the pager but leaves its buttons dead while a page loads", () => {
        renderUi(<Pagination page={2} pages={4} onPage={vi.fn()} count="" busy />);
        for (const button of desktop().getAllByRole("button", {hidden: true})) expect(button).toBeDisabled();
    });
});

describe("PrevNext", () => {
    it("moves by Prev and Next and shows the page", async () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        renderUi(<PrevNext hasPrev hasNext onPrev={onPrev} onNext={onNext} count="Page 2" />);

        expect(screen.getByTestId("list-count")).toHaveTextContent("Page 2");
        await userEvent.click(desktop().getByRole("button", {name: "Previous page", hidden: true}));
        await userEvent.click(desktop().getByRole("button", {name: "Next page", hidden: true}));
        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("turns off the way that has no page, and hides itself when there is none either way", () => {
        const {unmount} = renderUi(<PrevNext hasPrev={false} hasNext onPrev={vi.fn()} onNext={vi.fn()} count="Page 1" />);
        expect(desktop().getByRole("button", {name: "Previous page", hidden: true})).toBeDisabled();
        expect(desktop().getByRole("button", {name: "Next page", hidden: true})).toBeEnabled();
        unmount();

        renderUi(<PrevNext hasPrev={false} hasNext={false} onPrev={vi.fn()} onNext={vi.fn()} count="Page 1" />);
        expect(screen.queryByTestId("pager-desktop")).toBeNull();
        expect(screen.getByTestId("list-count")).toHaveTextContent("Page 1");
    });
});
