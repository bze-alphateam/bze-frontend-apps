import {describe, expect, it} from "vitest";

import {tokenActivityPath, tokenHolderPath, tokenSectionPath, tokenTxPath} from "./routes";

const DENOM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const ENCODED = "factory%2Fbze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l%2Fnoadmin";

describe("token activity routes", () => {
    it("keeps the denom, address and hash in the query, URL-encoded", () => {
        expect(tokenActivityPath(DENOM)).toBe(`/token/activity?denom=${ENCODED}`);
        expect(tokenHolderPath(DENOM, "bze1abc")).toBe(`/token/holder?denom=${ENCODED}&address=bze1abc`);
        expect(tokenTxPath(DENOM, "ABCD")).toBe(`/token/tx?denom=${ENCODED}&hash=ABCD`);
        expect(tokenSectionPath(DENOM, "stake")).toBe(`/token?denom=${ENCODED}#stake`);
    });
});
