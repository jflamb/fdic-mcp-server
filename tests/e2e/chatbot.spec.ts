import { expect, test } from "@playwright/test";

test("floating launcher opens the chat and suggested prompts send a message", async ({
  page,
}) => {
  await page.goto("/");

  const launcher = page.locator("[data-chatbot-launcher]");
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute(
    "aria-label",
    /Open the FDIC BankFind chat demo/i,
  );

  await launcher.click();
  await expect(page.locator("[data-chatbot-panel]")).toBeVisible();
  await expect(page.getByRole("button", { name: /10 largest active banks in California/i })).toBeVisible();

  await page.getByRole("button", { name: /10 largest active banks in California/i }).click();

  await expect(page.locator(".chatbot-demo__loading")).toBeVisible();
  await expect(page.getByText("California results")).toBeVisible();
  await expect(page.getByText("Bank A")).toBeVisible();
});

test("question-mark shortcut opens the chat outside editable fields", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Shift+/");
  await expect(page.locator("[data-chatbot-panel]")).toBeVisible();
});

test("question-mark shortcut does not hijack editable fields", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-chatbot-launcher]").click();
  const input = page.locator("[data-chatbot-input]");
  await input.focus();
  await page.keyboard.press("Shift+/");

  await expect(input).toBeFocused();
});

test("manual input supports Enter and renders markdown tables", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-chatbot-launcher]").click();

  const input = page.locator("[data-chatbot-input]");
  await input.fill("Show a demo table");
  await input.press("Enter");

  await expect(page.locator(".chatbot-demo__thread table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "First Demo Bank" })).toBeVisible();
});

test("assistant replies render richer markdown structures", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-chatbot-launcher]").click();

  const input = page.locator("[data-chatbot-input]");
  await input.fill("Show rich markdown");
  await input.press("Enter");

  const bubble = page.locator(".chatbot-demo__message--assistant .chatbot-demo__bubble").last();
  await expect(bubble.locator("h3")).toHaveText("Results summary");
  await expect(bubble.locator("a")).toHaveAttribute("href", "/prompting-guide/");
  await expect(bubble.locator("ol li")).toHaveCount(2);
  await expect(bubble.locator("ul li")).toHaveCount(2);
  await expect(bubble.locator("em")).toHaveText("Efficient");
  await expect(bubble.locator("li code")).toHaveText("CERT 12345");
  await expect(bubble.locator("pre code")).toContainText("Assets: 125000");
  await expect(bubble).toContainText("Literal HTML: <b>safe</b>");
  await expect(bubble.locator("b")).toHaveCount(0);
});

test("unavailable status hides prompts and the composer", async ({ page }) => {
  await page.goto("/unavailable/");

  await page.locator("[data-chatbot-launcher]").click();

  await expect(page.getByText("The interactive demo is currently unavailable.")).toBeVisible();
  await expect(page.locator("[data-chatbot-form]")).toHaveAttribute("hidden", "");
  await expect(page.locator("[data-chatbot-prompts]")).toHaveAttribute("hidden", "");
});

test("429 responses surface rate-limit feedback", async ({ page }) => {
  await page.goto("/rate-limit/");

  await page.locator("[data-chatbot-launcher]").click();

  const input = page.locator("[data-chatbot-input]");
  await input.fill("Trigger rate-limit");
  await input.press("Enter");

  await expect(page.locator(".chatbot-demo__loading")).toBeVisible();
  await expect(page.getByText("Rate limit reached. Wait a minute, then try again.")).toBeVisible();
});
