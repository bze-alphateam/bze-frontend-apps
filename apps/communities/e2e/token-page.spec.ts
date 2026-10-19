import {readFileSync} from "node:fs";
import {join} from "node:path";

import {startInLightMode} from "./support/color-mode";
import {expect, type Fixture, test} from "./support/mock-network";

// The token site shell (BFE-125), against the testnet fixtures. NOAD (NoAdminToken) has a brand
// kit (JetBrains Mono, light primary #be1981, dark primary #e67fc0), a holders pool with 20 NOAD
// staked, 1,001,000 NOAD of supply and one pool with TUSDC that prices it at $0.10. The trimmed
// aggregator tickers carry no testnet pool, so its 24h volume is $0, and the burn history is empty.

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
// Vidulum (VDL) sits in no pool, so it can't be swapped into.
const VIDULUM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";
const tokenPage = (denom: string) => `/token?denom=${encodeURIComponent(denom)}`;
const recorded = (file: string): Fixture =>
    JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", file), "utf8")) as Fixture;

test("the branded token renders its name, hero and key numbers", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await expect(page.getByRole("heading", {level: 1, name: "NoAdminToken"})).toBeVisible();
    await expect(page.getByText("no admin test token yes yes")).toBeVisible();
    await expect(page.getByTestId("token-site-price")).toHaveText("$0.1");

    await expect(page.getByTestId("key-number-cap")).toHaveText("Market cap$100.1K");
    await expect(page.getByTestId("key-number-supply")).toHaveText("Supply1.001M");
    await expect(page.getByTestId("key-number-staked")).toHaveText("Staked20");
    await expect(page.getByTestId("key-number-burned")).toHaveText("Burned0");
    await expect(page.getByTestId("key-number-volume")).toHaveText("24h volume$0");

    await expect(page.getByText(NOAD, {exact: true})).toBeVisible();
    await expect(page.getByTestId("supply-control")).toHaveText(/^Admin bze1z3/);
});

test("the kit's primary colour and font are applied", async ({page}) => {
    await startInLightMode(page);
    await page.goto(tokenPage(NOAD));

    const get = page.getByRole("button", {name: "Get NOAD"}).first();
    await expect(get).toHaveCSS("background-color", "rgb(190, 25, 129)");
    await expect(page.getByTestId("token-site")).toHaveCSS("font-family", /JetBrains Mono/);
});

test.describe("in dark mode", () => {
    test.use({colorScheme: "dark"});

    test("the kit's dark primary is applied", async ({page}) => {
        await page.goto(tokenPage(NOAD));

        await expect(page.getByRole("button", {name: "Get NOAD"}).first()).toHaveCSS("background-color", "rgb(230, 127, 192)");
    });
});

test("the header's wallet button opens the token's wallet drawer with a connect prompt", async ({page}) => {
    await startInLightMode(page);
    await page.goto(tokenPage(NOAD));

    // No wallet extension in e2e, so the drawer asks to connect one.
    await page.locator("header").getByRole("button", {name: "Connect wallet"}).click();

    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
    // Portaled outside the page, still in the kit's colours.
    await expect(drawer.getByRole("button", {name: "Connect wallet"})).toHaveCSS("background-color", "rgb(190, 25, 129)");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
});

test("Get on a tradable token opens the drawer's Get tab on a connect prompt", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await page.getByRole("button", {name: "Get NOAD"}).first().click();

    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
    await expect(drawer.getByText("Not tradable yet")).toHaveCount(0);
});

test("Get on a token in no pool says it is not tradable yet", async ({page}) => {
    await page.goto(tokenPage(VIDULUM));
    await expect(page.getByRole("heading", {level: 1, name: "Vidulum"})).toBeVisible();

    await page.getByRole("button", {name: "Get VDL"}).first().click();

    const drawer = page.getByRole("dialog", {name: "Your Vidulum wallet"});
    await expect(drawer.getByTestId("get-not-tradable")).toHaveText(/Not tradable yet/);
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
});

test("the wallet drawer's settings switch the page to the kit's dark palette, no wallet needed", async ({page}) => {
    await startInLightMode(page);
    await page.goto(tokenPage(NOAD));
    const site = page.getByTestId("token-site");
    await expect(page.getByRole("heading", {level: 1, name: "NoAdminToken"})).toBeVisible();
    const lightBackground = await site.evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.locator("header").getByRole("button", {name: "Connect wallet"}).click();
    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await drawer.getByRole("button", {name: "Settings"}).click();
    await expect(drawer.getByTestId("wallet-settings")).toBeVisible();

    const darkMode = drawer.getByRole("switch", {name: "Dark mode"});
    await darkMode.click();
    await expect(darkMode).toHaveAttribute("aria-checked", "true");
    await expect(site).not.toHaveCSS("background-color", lightBackground);
    // The kit's dark primary, as in the dark-mode test above.
    await expect(page.getByRole("button", {name: "Get NOAD"}).first()).toHaveCSS("background-color", "rgb(230, 127, 192)");

    await drawer.getByRole("button", {name: "Back to wallet"}).click();
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
});

test("no element links to other BeeZee apps and no BeeZee chrome shows", async ({page}) => {
    await page.goto(tokenPage(NOAD));
    await expect(page.getByRole("heading", {level: 1, name: "NoAdminToken"})).toBeVisible();
    // Let the sections that load later (staking, burns, footer) settle.
    await page.waitForLoadState("networkidle");

    // The holders pool's "Add rewards to the pool" is the one deliberate link out (R5).
    const addRewards = `https://testnet-factory.getbze.com/denom-reward/schedule?denom=${encodeURIComponent(NOAD)}`;
    // The pool loads after network idle can settle, so wait for its link before collecting.
    await expect(page.getByRole("link", {name: "Add rewards to the pool"})).toHaveAttribute("href", addRewards);
    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.filter((href) => /\.getbze\.com/.test(href))).toEqual([addRewards]);

    await expect(page.getByAltText("BZE application logo")).toHaveCount(0);
    await expect(page.getByRole("button", {name: /directory/i})).toHaveCount(0);
    // NOAD has no BZE pool, so it can't pay fees itself: the footer names the network (R12).
    await expect(page.getByRole("link", {name: "Runs on BeeZee"})).toHaveAttribute("href", "https://getbze.com");
});

test("the holders pool lists what it pays, the unpriced reward last and no APR", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    // NOAD's pool pays 10 NOAD and 10 VDL a day; VDL sits in no pool, so it has no price.
    const pool = page.getByTestId("holders-pool");
    const rows = pool.getByTestId("holders-pool-prizes").getByRole("row");
    await expect(rows).toHaveText(["RewardPaid dailyFunded for", "NOAD10363 days", "VDL10198 days"]);
    await expect(pool.getByTestId("holders-pool-apr")).toHaveCount(0);
    await expect(pool).toContainText("Total staked20 NOAD");
    await expect(pool).toContainText("Unlock time7 days");
    await expect(pool.getByRole("button", {name: "Connect to stake"})).toBeVisible();
});

test("the holders pool shows its APR when every reward has a price", async ({page, network}) => {
    // Only the NOAD schedule: 10 NOAD a day over 20 NOAD staked is 18,250% whatever NOAD's price.
    const schedules = recorded("rewards.denom_reward_schedules.noadmin.json");
    const body = schedules.body as { list: { prize_denom: string }[] };
    network.use("lcd", {...schedules, body: {...body, list: body.list.filter((schedule) => schedule.prize_denom === NOAD)}});

    await page.goto(tokenPage(NOAD));

    await expect(page.getByTestId("holders-pool-apr")).toHaveText("18,250.0%Est. APR");
});

test("a token without a holders pool says so and links to the Factory to start one", async ({page}) => {
    await page.goto(tokenPage(VIDULUM));

    await expect(page.getByTestId("holders-pool-empty")).toContainText("No holders pool yet");
    await expect(page.getByRole("link", {name: "Start a holders pool"}))
        .toHaveAttribute("href", `https://testnet-factory.getbze.com/manage/token?denom=${encodeURIComponent(VIDULUM)}`);
});

// Two NOAD burns (1,000 and 500) among a BZE one, as the burner's history lists them, with the
// block each happened at.
const BURN_HISTORY: Fixture[] = [
    {
        method: "GET",
        path: "/bze/burner/all_burned_coins",
        query: recorded("burner.all_burned_coins.json").query,
        status: 200,
        body: {
            burnedCoins: [
                {burned: `500000000${NOAD},7000000ubze`, height: "3600000"},
                {burned: `1000000000${NOAD}`, height: "3500000"},
            ],
            pagination: {next_key: null, total: "2"},
        },
    },
    ...[["3600000", "2026-10-03T14:00:00Z"], ["3500000", "2026-08-22T09:30:00Z"]].map(([height, time]): Fixture => ({
        method: "GET",
        path: `/cosmos/base/tendermint/v1beta1/blocks/${height}`,
        status: 200,
        body: {block_id: {hash: "AA"}, block: {header: {height, time}}},
    })),
];

test("the burn section sums NOAD's burns, its share of the supply and lists them", async ({page, network}) => {
    for (const fixture of BURN_HISTORY) network.use("lcd", fixture);

    await page.goto(tokenPage(NOAD));

    const burn = page.locator("#burn");
    await expect(burn.getByRole("heading", {level: 2})).toHaveText("Every burn makes NOAD scarcer");
    // 1,500 ÷ (1,001,000 + 1,500) = 0.1496…%, at $0.10 a NOAD.
    await expect(burn.getByTestId("burn-total-amount")).toHaveText("1,500");
    await expect(burn.getByTestId("burn-total-details")).toHaveText("NOAD · $150.00 · 0.14% of the original supply");
    const rows = burn.getByTestId("burn-history").getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText("500 NOAD$50.003,600,000");
    await expect(rows.nth(2)).toContainText("1,000 NOAD$100.003,500,000");
    await expect(page.getByTestId("key-number-burned")).toHaveText("Burned1.5K");
});

test("without burns the section shows 0 and an empty history, and no burn scheduled for NOAD", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    const burn = page.locator("#burn");
    await expect(burn.getByTestId("burn-total-amount")).toHaveText("0");
    await expect(burn.getByTestId("burn-total-details")).toHaveText("NOAD · 0% of the original supply");
    await expect(burn.getByTestId("burn-history-empty")).toBeVisible();
    // The burner holds TUSDC and BZE, no NOAD.
    await expect(burn.getByTestId("next-burn-none")).toHaveText("No burn scheduled");
});

test("the next burn shows the NOAD the burner holds", async ({page, network}) => {
    const burner = recorded("bank.spendable_balances.burner.json");
    const body = burner.body as { balances: { denom: string; amount: string }[] };
    network.use("lcd", {...burner, body: {...body, balances: [...body.balances, {denom: NOAD, amount: "25000000"}]}});

    await page.goto(tokenPage(NOAD));

    await expect(page.getByTestId("next-burn-amount")).toHaveText("25 NOAD queued");
    await expect(page.getByTestId("next-burn-countdown")).toBeVisible();
});

test("Burn NOAD opens the burn dialog, which asks for a wallet first", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await page.locator("#burn").getByRole("button", {name: "Burn NOAD"}).click();

    const dialog = page.getByRole("dialog", {name: "Burn NOAD"});
    await expect(dialog.getByTestId("burn-connect-prompt")).toHaveText(/Connect a wallet to burn NOAD/);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
});

// Testnet runs no raffle, so the raffle specs make one up: 10 NOAD tickets, 1 in 20 to win half
// of a 480 NOAD pot, ending at hour 5,583 (the fixture's hour epoch is 5,533), with two winners.
const raffles = (): Fixture => {
    const fixture = recorded("burner.raffles.json");
    const raffle = {
        pot: "480000000", duration: "720", chances: "50000", ratio: "0.5", end_at: "5583", winners: "2",
        ticket_price: "10000000", denom: NOAD, total_won: "250000000",
    };

    return {...fixture, body: {list: [raffle], pagination: {next_key: null, total: "1"}}};
};
const RAFFLE_WINNERS: Fixture = {
    method: "GET",
    path: "/bze/burner/raffle_winners",
    query: {denom: NOAD},
    status: 200,
    body: {
        list: [
            {index: "1", denom: NOAD, amount: "200000000", winner: "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l"},
            {index: "2", denom: NOAD, amount: "50000000", winner: "bze1kfsu0rz2d0n9yx0d5hv8gdqjmcd7jtdcvmz7cu"},
        ],
        pagination: {next_key: null, total: "2"},
    },
};

test("a NOAD raffle shows its odds, pot and latest winners under the next burn", async ({page, network}) => {
    network.use("lcd", raffles());
    network.use("lcd", RAFFLE_WINNERS);

    await page.goto(tokenPage(NOAD));

    const card = page.locator("#burn").getByTestId("raffle-card");
    await expect(card.getByRole("heading", {name: "Burn raffle"})).toBeVisible();
    await expect(card.getByTestId("raffle-copy")).toContainText("Each ticket has a 1 in 20 chance to win 50% of the pot.");
    await expect(card.getByTestId("raffle-odds")).toHaveText("1 in 20");
    await expect(card.getByTestId("raffle-pot")).toHaveText("480 NOAD");
    await expect(card.getByTestId("raffle-prize")).toHaveText("240 NOAD");
    await expect(card.getByTestId("raffle-ends")).toHaveText("2d 2h");

    // Winner 2 is the newest.
    const winners = page.getByTestId("raffle-winners").getByRole("listitem");
    await expect(winners).toHaveCount(2);
    await expect(winners.nth(0)).toContainText("50 NOAD");
    await expect(winners.nth(1)).toContainText("200 NOAD");

    // No wallet in e2e: buying asks to connect one.
    await card.getByRole("button", {name: "Buy tickets"}).click();
    await expect(page.getByRole("dialog", {name: "NOAD burn raffle"}).getByTestId("raffle-connect-prompt")).toBeVisible();
});

test("without a raffle for the token the next burn shows none", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await expect(page.getByTestId("next-burn")).toBeVisible();
    await expect(page.getByTestId("raffle-card")).toHaveCount(0);
});

// One running NOAD program paying NOAD and one finished one paying VDL, next to the recorded VDL
// program (finished too).
const stakingRewards = (): Fixture => {
    const fixture = recorded("rewards.all_staking_rewards.json");
    const body = fixture.body as { list: object[] };
    const program = {staking_denom: NOAD, lock: 3, min_stake: "5000000", distributed_stake: "0"};

    return {
        ...fixture,
        body: {
            ...body,
            list: [
                ...body.list,
                {...program, reward_id: "000000000001", prize_denom: NOAD, prize_amount: "10000000", duration: 30, payouts: 7, staked_amount: "1000000000"},
                {...program, reward_id: "000000000002", prize_denom: VIDULUM, prize_amount: "4000000", duration: 10, payouts: 10, staked_amount: "200000000"},
            ],
        },
    };
};

test("fixed-term programs show only the running ones to a visitor", async ({page, network}) => {
    network.use("lcd", stakingRewards());

    await page.goto(tokenPage(NOAD));

    const programs = page.getByTestId("fixed-term-programs");
    await expect(programs.getByRole("heading", {name: "Fixed-term programs"})).toBeVisible();
    await expect(programs.getByTestId(/^program-\d+$/)).toHaveCount(1);
    const running = programs.getByTestId("program-000000000001");
    await expect(running).toContainText("Pays inNOAD");
    // 10 NOAD a day over 1,000 NOAD staked.
    await expect(running.getByTestId("program-apr")).toHaveText("365%APR");
    await expect(running.getByTestId("program-terms"))
        .toHaveText("Paid daily10 NOADEnds in23 daysUnlock time3 daysTotal staked1,000 NOADMinimum5 NOAD");
    await expect(running.getByRole("button")).toHaveCount(0);
});

test("a token whose only program has finished shows no fixed-term programs", async ({page}) => {
    await page.goto(tokenPage(VIDULUM));

    await expect(page.getByTestId("holders-pool-empty")).toBeVisible();
    await expect(page.getByTestId("fixed-term-programs")).toHaveCount(0);
});

const TESTUSD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd";

test("Ways to earn VDL lists the program and the other pool paying it, not the finished program", async ({page, network}) => {
    // The programs above (NOAD → NOAD running, NOAD → VDL finished) plus a running NOAD → VDL one.
    const programs = stakingRewards();
    const body = programs.body as { list: object[] };
    network.use("lcd", {
        ...programs,
        body: {
            ...body,
            list: [...body.list, {
                reward_id: "000000000003", staking_denom: NOAD, prize_denom: VIDULUM, prize_amount: "4000000",
                duration: 20, payouts: 5, lock: 2, min_stake: "1000000", staked_amount: "50000000", distributed_stake: "0",
            }],
        },
    });
    // NOAD's pool pays VDL among three prizes: the recorded VDL and NOAD schedules plus a TUSDC one.
    const schedules = recorded("rewards.denom_reward_schedules.noadmin.json");
    const scheduleBody = schedules.body as { list: object[] };
    network.use("lcd", {
        ...schedules,
        body: {
            ...scheduleBody,
            list: [...scheduleBody.list, {
                schedule_id: "000000000002", staking_denom: NOAD, prize_denom: TESTUSD, daily_amount: "1000000", duration: 30, payouts: 1,
            }],
        },
    });

    await page.goto(tokenPage(VIDULUM));

    const earn = page.locator("section#earn");
    await expect(earn.getByRole("heading", {level: 2, name: "Ways to earn VDL"})).toBeVisible();
    await expect(page.locator('header a[href="#earn"]')).toHaveCount(1);
    // No APR without a VDL price, so the bigger daily payout comes first.
    await expect(earn.getByTestId(/^earn-(pool|program)-/)).toHaveCount(2);

    const pool = earn.getByTestId(`earn-pool-${NOAD}`);
    await expect(pool.getByTestId("earn-kind")).toHaveText("Holders pool");
    await expect(pool.getByTestId("earn-daily")).toHaveText("10VDL paid out daily");
    await expect(pool).toContainText("Unlock time7 days");
    await expect(pool).toContainText("Funded for198 days");
    await expect(pool.getByTestId("earn-also-pays")).toHaveText("Also pays NOAD and TUSDC.");
    await expect(pool.getByTestId("earn-apr")).toHaveCount(0);

    const program = earn.getByTestId("earn-program-000000000003");
    await expect(program.getByTestId("earn-kind")).toHaveText("Fixed-term program");
    await expect(program.getByTestId("earn-daily")).toHaveText("4VDL paid out daily");
    await expect(program).toContainText("Ends in15 days");
    await expect(program.getByRole("button", {name: "Stake NOAD"})).toBeVisible();
    await expect(earn.getByTestId("earn-program-000000000002")).toHaveCount(0);
});

test("a token nothing else pays has no Earn section", async ({page}) => {
    // The only holders pool is NOAD's own, which belongs to the Stake section.
    await page.goto(tokenPage(NOAD));

    await expect(page.getByTestId("holders-pool")).toBeVisible();
    await expect(page.locator("section#earn")).toHaveCount(0);
    await expect(page.locator('header a[href="#earn"]')).toHaveCount(0);
});

// NOAD's one pool is NOAD/TUSDC with NOAD as the base, so the aggregator's closes are TUSDC per NOAD.
const NOAD_POOL = `${NOAD}_${TESTUSD}`;
const candles = (minutes: number, limit: number, closes: number[]): Fixture => ({
    path: "/api/dex/intervals",
    query: {market_id: NOAD_POOL, minutes: String(minutes), limit: String(limit), format: "tv"},
    status: 200,
    body: closes.map((close, index) => ({time: 1791806400 + index * minutes * 60, low: close, open: close, high: close, close, value: 1})),
});

test("a token in a pool gets a Trade section, its chart empty while the aggregator has no candles", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await expect(page.locator('header a[href="#trade"]')).toHaveText("Trade");
    const trade = page.locator("section#trade");
    await expect(trade.getByRole("heading", {level: 2, name: "Buy and sell NOAD"})).toBeVisible();
    // The recorded aggregator (mainnet) doesn't know this testnet pool.
    await expect(trade.getByTestId("pool-chart-empty")).toHaveText("No trades in this range yet");
    await expect(trade.getByTestId("trade-connect-prompt")).toBeVisible();
});

test("the chart draws the pool's candles and refetches on a range change", async ({page, network}) => {
    network.use("agg", candles(240, 180, [0.1, 0.12, 0.11]));
    network.use("agg", candles(60, 168, [0.2, 0.25]));

    await page.goto(tokenPage(NOAD));

    const chart = page.getByTestId("pool-chart");
    await expect(chart.getByRole("img", {name: "NOAD price in TUSDC, last 30D"})).toBeVisible();
    await expect(chart.getByTestId("pool-chart-line")).toHaveAttribute("points", /^\S+ \S+ \S+$/);
    await expect(chart.getByTestId("pool-chart-price")).toHaveText("0.11 TUSDC");

    const sevenDays = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return url.pathname === "/api/dex/intervals" && url.searchParams.get("minutes") === "60" && url.searchParams.get("limit") === "168";
    });
    await chart.getByRole("button", {name: "7D"}).click();
    await sevenDays;

    await expect(chart.getByRole("img", {name: "NOAD price in TUSDC, last 7D"})).toBeVisible();
    await expect(chart.getByTestId("pool-chart-price")).toHaveText("0.25 TUSDC");
});

test("the Trade section lists the token's pools, and adding liquidity asks for a wallet first", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    const pools = page.getByTestId("liquidity-pools");
    await expect(pools.getByRole("heading", {level: 3, name: "Liquidity pools"})).toBeVisible();
    const rows = pools.getByTestId(/^liquidity-pool-/);
    await expect(rows).toHaveCount(1);

    // 10 NOAD at $0.10 and 1 TUSDC at $1; the recorded aggregator has no volume for it, so no APR.
    const row = pools.getByTestId(`liquidity-pool-${NOAD_POOL}`);
    await expect(row.getByRole("cell").first()).toHaveText("NOAD / TUSDC");
    await expect(row.getByTestId("pool-liquidity")).toHaveText("$2.00");
    await expect(row.getByTestId("pool-volume")).toHaveText("$0.00");
    await expect(row.getByTestId("pool-apr")).toHaveText("—");
    await expect(row.getByTestId("pool-share")).toHaveText("—");
    await expect(row.getByRole("button", {name: /^Remove/})).toHaveCount(0);

    await row.getByRole("button", {name: "Add liquidity to NOAD / TUSDC"}).click();

    const prompt = pools.getByTestId("liquidity-connect-prompt");
    await expect(prompt).toHaveText(/Connect a wallet to add liquidity to the NOAD \/ TUSDC pool\./);
    await expect(prompt.getByRole("button", {name: "Connect wallet"})).toBeVisible();
    await expect(row.getByRole("button", {name: "Close adding to NOAD / TUSDC"})).toHaveAttribute("aria-expanded", "true");
});

test("a token in several pools lists them all, the most liquidity first", async ({page, network}) => {
    // The chart opens on the largest pool; the aggregator has no candles for it.
    network.use("agg", {
        path: "/api/dex/intervals",
        query: {market_id: `${TESTUSD}_ubze`, minutes: "240", limit: "180", format: "tv"},
        status: 200,
        body: [],
    });
    await page.goto(tokenPage(TESTUSD));

    // TUSDC/TBZE (testnet BZE) holds 383,015 TUSDC; NOAD/TUSDC only 1. TUSDC comes first in both pairs.
    const rows = page.getByTestId("liquidity-pools").getByTestId(/^liquidity-pool-/);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute("data-testid", `liquidity-pool-${TESTUSD}_ubze`);
    await expect(rows.nth(0).getByRole("cell").first()).toHaveText("TUSDC / TBZE");
    await expect(rows.nth(1).getByRole("cell").first()).toHaveText("TUSDC / NOAD");
});

test("a token in no pool has no Trade section", async ({page}) => {
    await page.goto(tokenPage(VIDULUM));

    await expect(page.getByRole("heading", {level: 1, name: "Vidulum"})).toBeVisible();
    await expect(page.locator("section#trade")).toHaveCount(0);
    await expect(page.locator('header a[href="#trade"]')).toHaveCount(0);
});

// Fee mode (BFE-137). The testnet's tradebin param asks for 100,000 BZE in a token's BZE pool
// before it can pay fees, and TUSDC's pool holds ~75,895: lowering the param makes TUSDC eligible.
const lowFeeThreshold = (): Fixture => {
    const params = recorded("tradebin.params.json");
    const body = params.body as { params: Record<string, unknown> };
    return {...params, body: {...body, params: {...body.params, minNativeLiquidityForModuleSwap: "1000000000"}}};
};

test("a token that can't pay fees says each transaction needs BZE, without Get BZE while Skip is off", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await page.getByRole("button", {name: "Get NOAD"}).first().click();

    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await expect(drawer.getByTestId("bze-fee-notice")).toHaveText(
        "NOAD runs on the BeeZee network. Each transaction needs a small amount of TBZE for the network fee.",
    );
    await expect(drawer.getByRole("button", {name: "Get TBZE"})).toHaveCount(0);
    await expect(page.getByRole("link", {name: "Runs on BeeZee"})).toBeVisible();

    await drawer.getByRole("button", {name: "Settings"}).click();
    await expect(drawer.getByRole("switch", {name: /Pay network fees/})).toHaveCount(0);
});

test("a token that can pay fees never mentions BeeZee and lets the viewer pay in BZE instead", async ({page, network}) => {
    network.use("lcd", lowFeeThreshold());
    network.use("agg", {
        path: "/api/dex/intervals",
        query: {market_id: `${TESTUSD}_ubze`, minutes: "240", limit: "180", format: "tv"},
        status: 200,
        body: [],
    });
    await page.goto(tokenPage(TESTUSD));
    await expect(page.getByTestId("liquidity-pools")).toBeVisible();

    await page.locator("header").getByRole("button", {name: "Connect wallet"}).click();
    const drawer = page.getByRole("dialog", {name: /wallet$/});
    await drawer.getByRole("button", {name: "Settings"}).click();

    const feeSwitch = drawer.getByRole("switch", {name: "Pay network fees in TUSDC"});
    await expect(feeSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/BeeZee/)).toHaveCount(0);

    await feeSwitch.click();
    await expect(feeSwitch).toHaveAttribute("aria-checked", "false");

    // The choice is remembered for this token.
    await page.reload();
    await page.locator("header").getByRole("button", {name: "Connect wallet"}).click();
    await drawer.getByRole("button", {name: "Settings"}).click();
    await expect(drawer.getByRole("switch", {name: "Pay network fees in TUSDC"})).toHaveAttribute("aria-checked", "false");
});
