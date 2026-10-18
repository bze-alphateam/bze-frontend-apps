import {defineConfig, devices} from "@playwright/test";

// Factory e2e suite (BFE-143): runs in CI only (.github/workflows/e2e-factory.yml),
// against a production build made from .env.e2e (`pnpm e2e:build`). Every chain/aggregator
// call is answered by e2e/support/mock-network.ts. See e2e/README.md.
const PORT = 3005;
const CI = !!process.env.CI;

export default defineConfig({
    testDir: "e2e",
    fullyParallel: true,
    forbidOnly: CI,
    retries: 0,
    workers: CI ? 2 : undefined,
    reporter: CI ? [["github"], ["list"], ["html", {open: "never"}]] : [["list"], ["html", {open: "never"}]],
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {name: "chromium", use: {...devices["Desktop Chrome"]}, testIgnore: /mobile\.spec\.ts/},
        // Phone pass (BFE-170): every route at 390 × 844. CI installs Chromium only, so the
        // iPhone profile (viewport, touch, mobile UA) runs in Chromium rather than WebKit.
        {
            name: "mobile",
            use: {...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: {width: 390, height: 844}},
            testMatch: /mobile\.spec\.ts/,
        },
    ],
    webServer: {
        command: `next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
