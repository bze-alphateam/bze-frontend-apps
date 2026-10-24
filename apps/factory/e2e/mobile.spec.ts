import type {Locator, Page} from "@playwright/test";
import {expect, test} from "./support/mock-network";

// Phone pass (BFE-170): every route at 390 px wide (the `mobile` project, iPhone 13) with no
// horizontal page scroll. Each route waits for its own content first, with the same URLs and
// fixtures as its desktop spec.
const enc = encodeURIComponent;
const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const NOADMIN = enc(`${ISSUER}/noadmin`);
const VDL = enc(`${ISSUER}/vidulum`);
const TUSDC_TBZE_LP = enc(`ulp_${ISSUER}/testusd_ubze`);
const MISSING_TOKEN = "factory%2Fbze1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq%2Futok";

const heading = (name: string | RegExp) => (page: Page) => page.getByRole("heading", {name}).first();

const ROUTES: {path: string; ready: (page: Page) => Locator}[] = [
    {path: "/", ready: heading("What are you building today?")},
    {path: "/create/market", ready: heading("How should people trade it?")},
    {path: "/create/rewards", ready: heading("Which kind of reward?")},
    {path: "/create/grow", ready: heading("How do you want to grow?")},
    {path: "/token/new", ready: heading("Create a token")},
    {path: "/market/new", ready: heading("Create an order-book market")},
    {path: `/pool/new?base=${VDL}`, ready: heading("Create a liquidity pool")},
    // /pool/add is only a notice that moves on to the DEX after 1.5 s (BFE-262): no phone layout to check.
    {path: `/reward/new?staking=${TUSDC_TBZE_LP}`, ready: heading(/Create a simple reward/)},
    // testnet's one simple reward (#000000000000) has finished: it can still be extended.
    {path: "/reward/extend?id=000000000000", ready: (page) => page.getByTestId("extend-terms")},
    // ...and, with 37 VDL staked, still take an airdrop through it.
    {path: "/airdrop?id=000000000000", ready: (page) => page.getByRole("region", {name: "Amount", exact: true})},
    {path: "/airdrop?to=list&denom=ubze", ready: (page) => page.getByRole("region", {name: "List", exact: true})},
    {path: "/airdrop", ready: heading("Airdrop coins")},
    {path: "/raffle/new?denom=ubze", ready: heading("Run a burning raffle")},
    {path: "/tokens", ready: heading(/^Tokens$/)},
    // The token page stacks its groups; the setup chips scroll in their own row (BFE-271).
    {path: `/tokens/token?denom=${NOADMIN}`, ready: (page) => page.getByTestId("burn-item")},
    {path: `/tokens/token?denom=${MISSING_TOKEN}`, ready: (page) => page.getByText("We couldn't find this token.")},
    // Both sections stacked, their actions in two columns (BFE-272).
    {path: "/rewards", ready: (page) => page.getByTestId("compounded-reward-card").first()},
    // testnet's one simple reward has finished.
    {path: "/rewards?kind=simple&status=finished", ready: (page) => page.getByTestId("simple-reward-row").first()},
    {path: "/denom-reward/new", ready: heading(/Create a compounded reward/)},
    {path: `/denom-reward/schedule?denom=${NOADMIN}`, ready: heading(/Add a daily prize/)},
    {path: `/denom-reward/schedule?denom=${NOADMIN}&schedule=000000000000`, ready: heading(/Extend a daily prize/)},
    {path: `/airdrop?denom=${NOADMIN}`, ready: (page) => page.getByRole("region", {name: "You will pay"})},
    {path: `/official?denom=${VDL}`, ready: heading("Get VDL's logo in every wallet")},
];

for (const route of ROUTES) {
    test(`${route.path} fits a 390 px phone`, async ({page}) => {
        await page.goto(route.path);
        await expect(route.ready(page)).toBeVisible();

        // The page can still be settling right after its content appears; a lasting overflow fails.
        const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await expect.poll(overflow, {message: "horizontal page scroll", timeout: 5000}).toBeLessThanOrEqual(0);
    });
}

test("the phone menu opens with the nav and the Apps list, and closes again (BFE-277)", async ({page}) => {
    await page.goto("/");
    await expect(heading("What are you building today?")(page)).toBeVisible();

    await page.getByRole("button", {name: "Open menu"}).click();
    const sheet = page.getByRole("dialog", {name: "Menu"});
    await expect(sheet).toBeVisible();
    for (const name of ["Create", "Tokens", "Rewards"]) {
        await expect(sheet.getByRole("link", {name, exact: true})).toBeVisible();
    }
    const apps = sheet.getByTestId("apps-menu-mobile");
    await expect(apps.getByRole("link", {name: /DEX/})).toHaveAttribute("target", "_blank");

    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await expect.poll(overflow, {message: "horizontal page scroll"}).toBeLessThanOrEqual(0);

    await page.getByRole("button", {name: "Close menu"}).first().click();
    await expect(sheet).toBeHidden();
});
