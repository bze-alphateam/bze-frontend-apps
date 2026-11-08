// @vitest-environment node
// Without a DOM, Chakra writes each element's CSS into the HTML, as it does for the page the server sends.
import {afterEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import {renderToString} from "react-dom/server";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {DenomBranding} from "@bze/bze-ui-kit";

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: undefined, setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));
// An overlay only exists in the browser, under document.body: keep it in the rendered HTML here.
vi.mock("react-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-dom")>()),
    createPortal: (children: ReactElement) => children,
}));

import {TokenSiteTheme, TsDrawer} from "./index";

const KIT: DenomBranding = {
    font: "inter",
    light: {background: "#FFFFFF", text: "#000000", primary: "#123456", secondary: "#654321"},
    dark: {background: "#0A0A0A", text: "#FAFAFA", primary: "#ABCDEF", secondary: "#FEDCBA"},
};

const renderHtml = (ui: ReactElement) => renderToString(
    <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={KIT}>{ui}</TokenSiteTheme></ChakraProvider>,
);

/** What an element's CSS does in each colour mode, plus the variable names its inline style carries. */
function modeRules(html: string, testId: string) {
    const tag = new RegExp(`<div[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? "";
    const className = /\bcss-[a-z0-9]+/.exec(tag)?.[0];
    const names = [...tag.matchAll(/--ts-dark-([\w-]+):/g)].map((match) => match[1]);

    return {
        names,
        light: new RegExp(`[>}]\\.${className}\\{([^}]*)\\}`).exec(html)?.[1] ?? "",
        dark: new RegExp(`\\.dark \\.${className}[^{]*\\{([^}]*)\\}`).exec(html)?.[1] ?? "",
    };
}

function expectBothModes({names, light, dark}: ReturnType<typeof modeRules>) {
    expect(names).toEqual(expect.arrayContaining(["bg", "fg", "pri", "font"]));
    for (const name of names) {
        expect(light).toContain(`--ts-${name}:var(--ts-light-${name})`);
        expect(dark).toContain(`--ts-${name}:var(--ts-dark-${name})`);
    }
    expect(light).not.toContain("var(--ts-dark-");
    expect(dark).not.toContain("var(--ts-light-");
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("token site colour-mode rule", () => {
    it("picks the light palette by default and the dark one under .dark, for every variable", () => {
        expectBothModes(modeRules(renderHtml(<p>page</p>), "token-site"));
    });

    it("applies the same rule to an overlay, which renders outside the themed element", () => {
        // The overlay renders nothing unless it finds a document.
        vi.stubGlobal("document", {});
        const html = renderHtml(<TsDrawer open onClose={vi.fn()} title="Your wallet"><p>balance</p></TsDrawer>);

        expectBothModes(modeRules(html, "token-site-layer"));
    });
});
