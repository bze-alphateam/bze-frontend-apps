import {afterEach, describe, expect, it} from "vitest";
import {act} from "react";
import {renderToString} from "react-dom/server";
import {hydrateRoot, type Root} from "react-dom/client";

import {ColorModeProvider, useColorMode} from "./color-mode";

function ModeProbe() {
    const {colorMode} = useColorMode();
    return <span data-testid="probe" data-mode={colorMode ?? "unknown"}/>;
}

// jsdom has no matchMedia, so the system-preference listener stays off here.
const app = <ColorModeProvider enableSystem={false}><ModeProbe/></ColorModeProvider>;

let root: Root | undefined;
afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    localStorage.clear();
});

describe("useColorMode", () => {
    it("ends up on the saved mode after hydrating the server's HTML", async () => {
        localStorage.setItem("theme", "light");
        // The server cannot read localStorage, so its HTML never knows the saved mode.
        const container = document.createElement("div");
        container.innerHTML = renderToString(app);
        document.body.appendChild(container);
        expect(container.querySelector("[data-testid='probe']")).toHaveAttribute("data-mode", "unknown");

        await act(async () => {
            root = hydrateRoot(container, app, {onRecoverableError: () => {}});
        });

        // React keeps the server's attributes on a hydration mismatch, so the mode must arrive in a render after it.
        expect(container.querySelector("[data-testid='probe']")).toHaveAttribute("data-mode", "light");
    });
});
