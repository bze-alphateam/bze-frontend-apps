import {describe, expect, it} from "vitest";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import {TsField} from "./index";

forbidNetwork();

const KEEP_FONT_SIZE = "data-hg-keep-font-size";

function field(props: {fontSize?: string} = {}) {
    render(
        <ChakraProvider value={defaultSystem}>
            <TsField label="Endpoint" {...props}/>
        </ChakraProvider>,
    );
    return screen.getByLabelText("Endpoint");
}

describe("TsField on touch devices", () => {
    it("keeps its 22px default out of the theme's 16px rule", () => {
        expect(field().hasAttribute(KEEP_FONT_SIZE)).toBe(true);
    });

    it("leaves a size passed by the caller to the 16px rule, so iOS does not zoom on it", () => {
        expect(field({fontSize: "15px"}).hasAttribute(KEEP_FONT_SIZE)).toBe(false);
    });
});
