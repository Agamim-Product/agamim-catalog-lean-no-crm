const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

test.describe("home page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("greets by role in one uniform style", async ({ page }) => {
    // the comma between the two parts is drawn by CSS, so check the parts separately
    await expect(page.locator(".agm-greet-hello")).toHaveText("שלום");
    await expect(page.locator(".agm-greet-role")).toHaveText("ראש צוות נתונים");

    const style = (sel) =>
      page.locator(sel).evaluate((n) => {
        const s = getComputedStyle(n);
        return { size: s.fontSize, weight: s.fontWeight, color: s.color };
      });
    expect(await style(".agm-greet-hello")).toEqual(await style(".agm-greet-role"));
  });

  test("shows the hero, search and the published datasets", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "מה תרצו לדעת?" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "חיפוש", exact: true })).toBeVisible();
    await expect(page.getByText("רשויות מקומיות").first()).toBeVisible();
  });

  test("has the add-dataset entry in the navigation", async ({ page }) => {
    await expect(page.getByRole("navigation").getByRole("link", { name: /הוספת מאגר/ })).toBeVisible();
  });
});
