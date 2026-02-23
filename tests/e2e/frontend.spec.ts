import { test, expect } from "@playwright/test";

test.describe("public frontend", () => {
  test("home page loads with title and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/hohm\.info/i);
    await expect(
      page.getByRole("heading", { name: /hohm\.info/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /browse listings/i })
    ).toBeVisible();
  });

  test("listings index loads", async ({ page }) => {
    await page.goto("/listings");
    await expect(page).toHaveTitle(/listings/i);
    await expect(
      page.getByRole("heading", { name: /listings/i })
    ).toBeVisible();
  });

  test("listing detail loads when slug exists", async ({ page }) => {
    await page.goto("/listings/2115-anderson-dr-se-east-grand-rapids");
    await expect(page).toHaveTitle(/2115|anderson|hohm/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("tag page loads when slug exists", async ({ page }) => {
    await page.goto("/tags/ranch");
    await expect(page).toHaveTitle(/ranch|hohm/i);
    await expect(page.getByText("Ranch")).toBeVisible();
  });

  test("tag filter updates URL and shows filter state", async ({ page }) => {
    await page.goto("/listings");
    const tagLink = page.getByRole("link", { name: "Ranch" }).first();
    if (await tagLink.isVisible()) {
      await tagLink.click();
      await expect(page).toHaveURL(/tag=ranch/);
    }
    await page.goto("/listings?tag=ranch");
    await expect(page).toHaveURL(/tag=ranch/);
  });

  test("404 for missing listing slug", async ({ page }) => {
    const res = await page.goto("/listings/nonexistent-slug-404-test");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });

  test("404 for missing tag slug", async ({ page }) => {
    const res = await page.goto("/tags/nonexistent-tag-404-test");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
