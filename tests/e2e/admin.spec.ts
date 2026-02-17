import { test, expect } from "@playwright/test";

test("admin page loads", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveTitle(/admin|hohm|Payload/i);
});
