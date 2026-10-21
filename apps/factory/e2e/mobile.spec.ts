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
    {path: "/create/grow", ready: heading("Who do you want to reach?")},
    {path: "/token/new", ready: heading("Create a token")},
    {path: "/market/new", ready: heading("Allow limit orders")},
    {path: `/pool/new?base=${VDL}`, ready: heading("Create a liquidity pool")},
    // /pool/add is only a notice that moves on to the DEX after 1.5 s (BFE-262): no phone layout to check.
    {path: `/reward/new?staking=${TUSDC_TBZE_LP}`, ready: heading(/Run a campaign with an end date/)},
    {path: "/multisend?denom=ubze", ready: heading("Send to a list of wallets")},
    {path: "/reach", ready: heading("Reach another community")},
    {path: "/raffle/new?denom=ubze", ready: heading("Run a burning raffle")},
    {path: "/tokens", ready: heading(/^Tokens$/)},
    {path: `/tokens/token?denom=${MISSING_TOKEN}`, ready: (page) => page.getByText("Token not found")},
    // Phones get cards, not the (hidden) table.
    {path: "/rewards", ready: (page) => page.getByTestId("denom-reward-card").first()},
    // testnet's one simple reward has finished, and finished programs are folded away by default.
    {path: "/rewards?tab=programs&status=finished", ready: (page) => page.getByTestId("staking-program-row").first()},
    {path: `/denom-reward/token?denom=${NOADMIN}`, ready: (page) => page.getByTestId("holder-schedule-card").first()},
    {path: `/denom-reward/schedule?denom=${NOADMIN}`, ready: heading(/Give a little every day/)},
    {path: `/denom-reward/airdrop?denom=${NOADMIN}`, ready: heading(/Gift NOAD stakers, once/)},
    {path: `/official?denom=${VDL}`, ready: heading("Get VDL's logo into every wallet")},
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
