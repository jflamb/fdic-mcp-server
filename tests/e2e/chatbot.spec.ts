import { expect, test } from "@playwright/test";

test("suggested prompt cards render and clicking one sends a message", async ({
  page,
}) => {
  await page.goto("/try-it/");

  await expect(page.getByText("Try the MCP server without installing anything.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Find active banks in Texas/i })).toBeVisible();

  await page.getByRole("button", { name: /Find active banks in Texas/i }).click();

  await expect(page.locator(".chatbot-demo__loading")).toBeVisible();
  await expect(page.getByText("Texas results")).toBeVisible();
  await expect(page.getByText("Bank A")).toBeVisible();
});

test("manual input supports Enter and renders markdown tables", async ({ page }) => {
  await page.goto("/try-it/");

  const input = page.locator("[data-chatbot-input]");
  await input.fill("Show a demo table");
  await input.press("Enter");

  await expect(page.locator(".chatbot-demo__thread table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "First Demo Bank" })).toBeVisible();
});

test("unavailable status hides prompts and the composer", async ({ page }) => {
  await page.goto("/try-it-unavailable/");

  await expect(page.getByText("The interactive demo is currently unavailable.")).toBeVisible();
  await expect(page.locator("[data-chatbot-form]")).toHaveAttribute("hidden", "");
  await expect(page.locator("[data-chatbot-prompts]")).toHaveAttribute("hidden", "");
});

test("429 responses surface rate-limit feedback", async ({ page }) => {
  await page.goto("/try-it-rate-limit/");

  await page.locator("[data-chatbot-input]").fill("Trigger rate-limit");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.locator(".chatbot-demo__loading")).toBeVisible();
  await expect(page.getByText("Rate limit reached. Wait a minute, then try again.")).toBeVisible();
});
