import type {Page} from "@playwright/test";

/**
 * Opens the app in light mode. Dark is the app default (Hive Glow), whatever the browser's
 * colour scheme, so light-mode checks pick the theme the way a user's toggle does: next-themes
 * reads it from localStorage on load.
 */
export async function startInLightMode(page: Page) {
    await page.addInitScript(() => window.localStorage.setItem("theme", "light"));
}
