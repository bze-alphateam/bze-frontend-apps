import type {Page} from "@playwright/test";

/**
 * Installs a fake Keplr in the page, before any script of the app runs: a wallet that holds
 * `address` and approves every connection. It answers what interchain-kit's Keplr wallet asks
 * to connect (`enable`, `getKey`) and refuses to sign, so a spec that reaches a transaction
 * fails instead of broadcasting. Connect it from the page the way a user does (see `connectWallet`).
 */
export async function installFakeKeplr(page: Page, address: string): Promise<void> {
    await page.addInitScript((bech32Address: string) => {
        const key = {
            name: "e2e wallet",
            algo: "secp256k1",
            pubKey: new Uint8Array(33),
            address: new Uint8Array(20),
            bech32Address,
            isNanoLedger: false,
            isKeystone: false,
        };
        const refuse = async () => {
            throw new Error("the e2e wallet does not sign");
        };
        (window as unknown as {keplr: unknown}).keplr = {
            version: "0.12.0",
            mode: "extension",
            enable: async () => undefined,
            disable: async () => undefined,
            getKey: async () => key,
            experimentalSuggestChain: async () => undefined,
            signAmino: refuse,
            signDirect: refuse,
            signArbitrary: refuse,
            sendTx: refuse,
            // keplr.ethereum is how interchain-kit tells Keplr from other wallets
            ethereum: {isKeplr: true, request: async () => [], on: () => undefined, removeListener: () => undefined},
        };
    }, address);
}

/** Opens the header's wallet picker and connects the fake Keplr. */
export async function connectWallet(page: Page): Promise<void> {
    await page.getByTestId("app-header").getByRole("button", {name: "Connect"}).first().click();
    await page.getByText("Keplr", {exact: true}).first().click();
}
