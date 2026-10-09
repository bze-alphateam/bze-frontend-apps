import {describe, expect, it} from "vitest";
import type {EcosystemApp} from "@bze/bze-ui-kit";
import {factoryDenomRewardLink} from "./denom-reward";

const app = (key: string, href: string, disabled = false) => ({key, name: key, href, disabled}) as EcosystemApp;
const DENOM = "factory/bze1creator/tok";

describe("factoryDenomRewardLink", () => {
    it("points to the Factory manage page of the token, with the denom URL-encoded", () => {
        expect(factoryDenomRewardLink(DENOM, [app("dex", "https://dex.getbze.com"), app("factory", "https://testnet-factory.getbze.com/")]))
            .toBe("https://testnet-factory.getbze.com/manage/token?denom=factory%2Fbze1creator%2Ftok");
    });

    it("gives no link when the Factory is excluded or disabled", () => {
        expect(factoryDenomRewardLink(DENOM, [app("dex", "https://dex.getbze.com")])).toBeUndefined();
        expect(factoryDenomRewardLink(DENOM, [app("factory", "https://factory.getbze.com", true)])).toBeUndefined();
    });
});
