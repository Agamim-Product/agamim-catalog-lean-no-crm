const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

test.describe("login and first-visit profile", () => {
  test("a new visitor sees the login first, not the profile form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("name@org")).toBeVisible();
    await expect(page.locator("#agamim-onboarding")).toHaveCount(0);
  });

  test("after sign-in the profile form appears and validates required fields", async ({ page }) => {
    await signIn(page, { profile: false });
    await page.goto("/");

    const form = page.locator("#agamim-onboarding");
    await expect(form).toBeVisible();
    await expect(form.locator("#ob-hierarchy")).toHaveValue("HFC");
    await expect(form.locator("#ob-hierarchy")).toHaveAttribute("readonly", "");

    await form.getByRole("button", { name: "המשך" }).click();
    await expect(form.locator(".ob-error", { hasText: "שדה חובה" })).toHaveCount(4);
  });

  test("filling the profile greets the user by role on the home page", async ({ page }) => {
    await signIn(page, { profile: false });
    await page.goto("/");

    const form = page.locator("#agamim-onboarding");
    await form.locator("#ob-name").fill("דנה כהן");
    await form.locator("#ob-role").fill("ראש צוות נתונים");
    await form.locator("#ob-rank").selectOption("סרן");
    await form.locator("#ob-end").fill("2027-06-30");
    await form.getByRole("button", { name: "המשך" }).click();

    // saving reloads the page; the profile form must not come back
    await expect(page.locator(".agm-greet-hello")).toHaveText("שלום");
    await expect(page.locator(".agm-greet-role")).toHaveText("ראש צוות נתונים");
    await expect(page.locator("#agamim-onboarding")).toHaveCount(0);
  });

  test("signing out hides the profile form again", async ({ page }) => {
    await signIn(page, { profile: false });
    await page.goto("/");
    await expect(page.locator("#agamim-onboarding")).toBeVisible();
    await page.evaluate(() => sessionStorage.removeItem("auth"));
    await expect(page.locator("#agamim-onboarding")).toHaveCount(0);
  });
});
