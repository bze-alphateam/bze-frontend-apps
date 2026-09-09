import {describe, expect, it} from "vitest";
import {render, screen} from "@testing-library/react";

import {UnderConstruction} from "./under-construction";

describe("UnderConstruction placeholder", () => {
    it("renders the coming-soon page with a link back to getbze.com", () => {
        render(<UnderConstruction/>);

        expect(screen.getByRole("heading", {name: "Communities"})).toBeInTheDocument();
        expect(screen.getByText(/Under construction/)).toBeInTheDocument();
        expect(screen.getByRole("link", {name: "getbze.com"})).toHaveAttribute("href", "https://getbze.com");
    });
});
