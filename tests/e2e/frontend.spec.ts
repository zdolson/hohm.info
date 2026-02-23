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
      await expect(page).toHaveURL(/tags=ranch/);
    }
    await page.goto("/listings?tags=ranch");
    await expect(page).toHaveURL(/tags=ranch/);
  });

  test("filter form is visible and Apply filters submits", async ({ page }) => {
    await page.goto("/listings");
    await expect(
      page.getByRole("button", { name: /apply filters/i })
    ).toBeVisible();
    await expect(page.getByLabel(/beds \(min\)/i)).toBeVisible();
    await page.getByLabel(/state/i).fill("MI");
    await page.getByRole("button", { name: /apply filters/i }).click();
    await expect(page).toHaveURL(/state=MI/);
  });

  test("URL with filter params loads and form reflects params", async ({
    page,
  }) => {
    await page.goto("/listings?bedrooms=2&state=MI");
    await expect(page).toHaveURL(/bedrooms=2/);
    await expect(page).toHaveURL(/state=MI/);
    await expect(page.getByLabel(/beds \(min\)/i)).toHaveValue("2");
    await expect(page.getByLabel(/state/i)).toHaveValue("MI");
  });

  test("combined filters in URL work", async ({ page }) => {
    await page.goto("/listings?tags=ranch&bedrooms=2");
    await expect(page).toHaveURL(/tags=ranch/);
    await expect(page).toHaveURL(/bedrooms=2/);
    await expect(
      page.getByRole("heading", { name: /listings/i })
    ).toBeVisible();
  });

  test("Clear link resets to /listings", async ({ page }) => {
    await page.goto("/listings?state=MI");
    await expect(page.getByRole("link", { name: /clear/i })).toBeVisible();
    await page.getByRole("link", { name: /clear/i }).click();
    await expect(page).toHaveURL(/\/listings$/);
    await expect(page).not.toHaveURL(/state=/);
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
