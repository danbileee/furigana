import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { GENERIC_SERVER_ERROR } from "~/constants/error.const";
import { NON_JAPANESE_INPUT_ERROR } from "~/constants/furigana.const";

function textarea(page: Page) {
  return page.getByLabel("Japanese text input");
}

function submitButton(page: Page) {
  return page.getByRole("button", { name: /generate furigana/i });
}

function charCounter(page: Page) {
  return page.locator("[data-state]");
}

function errorAlert(page: Page) {
  return page.getByRole("alert");
}

test.describe("Furigana generation flow", () => {
  test("generates furigana for valid Japanese input", async ({ page }) => {
    test.skip(!process.env["OPENAI_API_KEY"], "Skipped: OPENAI_API_KEY not set in environment");
    test.slow();

    await page.goto("/");
    await textarea(page).fill("日本語を勉強しています");
    await submitButton(page).click();

    await page.waitForURL(/\/furigana\/.+/, { timeout: 30_000 });

    const rubyLocator = page.locator("ruby");
    await expect(rubyLocator.first()).toBeVisible();

    const firstRtText = await page.locator("ruby rt").first().textContent();
    expect(firstRtText).toMatch(/[\u3041-\u3096]+/);
  });

  test("Cmd+Enter submits the form", async ({ page }) => {
    test.skip(!process.env["OPENAI_API_KEY"], "Skipped: OPENAI_API_KEY not set in environment");
    test.slow();

    await page.goto("/");
    await textarea(page).fill("東京に行きました");
    await textarea(page).press("Meta+Enter");

    await page.waitForURL(/\/furigana\/.+/, { timeout: 30_000 });
    await expect(page.locator("ruby").first()).toBeVisible();
  });

  test("disables submit button when textarea is empty on initial load", async ({ page }) => {
    await page.goto("/");
    await expect(submitButton(page)).toBeDisabled();
  });

  test("re-disables submit button after textarea is cleared", async ({ page }) => {
    await page.goto("/");
    await textarea(page).fill("日本語");
    await expect(submitButton(page)).toBeEnabled();
    await textarea(page).clear();
    await expect(submitButton(page)).toBeDisabled();
  });

  test("shows danger counter at 10,000 characters", async ({ page }) => {
    await page.goto("/");
    await textarea(page).fill("あ".repeat(10_000));

    await expect(charCounter(page)).toHaveAttribute("data-state", "danger");
    await expect(charCounter(page)).toContainText("10,000 / 10,000");
    await expect(submitButton(page)).toBeEnabled();
  });

  test("shows validation error for non-Japanese input and preserves text", async ({ page }) => {
    await page.goto("/");
    const inputText = "Hello, this is English only.";
    await textarea(page).fill(inputText);
    await submitButton(page).click();

    await expect(errorAlert(page)).toBeVisible({ timeout: 10_000 });
    await expect(errorAlert(page)).toHaveText(NON_JAPANESE_INPUT_ERROR);
    await expect(textarea(page)).toHaveValue(inputText);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test.fixme("shows generic error when OpenAI API is unavailable", async ({ page }) => {
    // NOTE: The OpenAI request is made server-side (SSR). Browser-level route
    // interception cannot capture Node.js outbound HTTP from the app server.
    //
    // Expected UI contract for this path:
    // - Error alert text equals GENERIC_SERVER_ERROR.
    // - Textarea retains original submitted text.
    // - URL remains "/" (no redirect).
    //
    // Use a dedicated Playwright project with an invalid OPENAI_API_KEY and then:
    // 1) go to "/", 2) submit valid kanji text, 3) assert error + preserved text.
    await page.goto("/");
    await expect(page.getByText(GENERIC_SERVER_ERROR)).not.toBeVisible();
  });
});
