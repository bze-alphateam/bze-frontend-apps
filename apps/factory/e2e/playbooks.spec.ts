import {expect, test} from "./support/mock-network";

// Playbooks for newcomers (BFE-169) without a wallet, against the testnet fixtures in e2e/fixtures/.

test("the home offers the three playbooks", async ({page}) => {
    await page.goto("/");
    const section = page.getByRole("region", {name: "New here? Follow a playbook"});
    await expect(section.getByTestId("playbook-launch")).toContainText("Create → Pool → Stakable → Logo → Lock");
    await expect(section.getByTestId("playbook-noticed")).toContainText("Get noticed by another community");
    await expect(section.getByTestId("playbook-lps")).toContainText("Reward liquidity providers");

    await section.getByTestId("playbook-launch").click();
    await expect(page).toHaveURL(/\/playbooks\?id=launch$/);
});

test("the launch playbook without a wallet starts at Create my token", async ({page}) => {
    await page.goto("/playbooks?id=launch");
    await expect(page.getByRole("heading", {name: "Launch a community token"})).toBeVisible();
    const first = page.getByTestId("playbook-step-createToken");
    await expect(first).toHaveAttribute("data-state", "current");
    await expect(first.getByRole("button", {name: "Create my token"})).toBeEnabled();
    await expect(page.getByTestId("playbook-step-pool")).toHaveAttribute("data-state", "later");

    await first.getByRole("button", {name: "Create my token"}).click();
    await expect(page).toHaveURL(/\/token\/new\?return=%2Fplaybooks%3Fid%3Dlaunch&returnLabel=the\+playbook$/);
});

test("/playbooks fits a 390 px phone", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/playbooks?id=noticed");
    await expect(page.getByTestId("playbook-step-reach")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
