import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("completes the paper-first retry, solution, and progress flow", async ({ page }) => {
  await page.getByRole("link", { name: "Start the calibration" }).click();
  await expect(page.getByText("Work this out on paper, then enter your final answer.")).toBeVisible();

  const check = page.getByRole("button", { name: "Check answer" });
  await expect(check).toBeDisabled();

  const field = page.locator("math-field.math-answer-field");
  await field.evaluate((element) => {
    const mathField = element as HTMLElement & { value: string };
    mathField.value = "123456789";
    mathField.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "123456789" }));
  });
  await expect(check).toBeEnabled();
  await field.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  await expect(page.getByText("Check your answer.")).toBeVisible();
  await expect(field).toHaveJSProperty("value", "123456789");

  await page.getByRole("button", { name: "Reveal the next hint" }).click();
  await expect(page.locator(".hint-list li")).toHaveCount(1);
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();

  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect(field).toHaveJSProperty("value", "");
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByText("answers checked")).toBeVisible();

  await page.getByRole("button", { name: "Reset local progress" }).click();
  await expect(page.getByRole("heading", { name: "Reset this progress record?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep my progress" }).click();
  await expect(page.getByRole("heading", { name: "Your algebra record" })).toBeVisible();
});

test("renders the answer placeholder as spaced, upright text", async ({ page }) => {
  await page.goto("/practice/");
  const placeholder = await page.locator("math-field.math-answer-field").evaluate((element) => {
    const text = element.shadowRoot?.querySelector(".ML__text");
    return {
      latex: element.getAttribute("placeholder"),
      text: text?.textContent,
      fontStyle: text ? getComputedStyle(text).fontStyle : null
    };
  });

  expect(placeholder).toEqual({
    latex: "\\text{Enter your final answer}",
    text: "Enter your final answer",
    fontStyle: "normal"
  });
});

test("accepts a decimal-equivalent interval in the answer field", async ({ page }) => {
  let seed = 2;
  let generated = generateQuestion("linear", seed, "easy");
  let fraction = generated.answer.latex.match(/\\frac\{(-?\d+)\}\{(\d+)\}/);
  while (!fraction) {
    seed += 2;
    generated = generateQuestion("linear", seed, "easy");
    fraction = generated.answer.latex.match(/\\frac\{(-?\d+)\}\{(\d+)\}/);
  }
  const decimal = Number(fraction[1]) / Number(fraction[2]);
  const openingDelimiter = generated.answer.latex.startsWith("[") ? "[" : "(";

  await page.addInitScript((fixedTime) => {
    Date.now = () => fixedTime;
  }, seed);
  await page.goto("/practice/?topic=linear");

  const field = page.locator("math-field.math-answer-field");
  const answer = `${openingDelimiter}${decimal},\\infty)`;
  await field.evaluate((element, latex) => {
    const mathField = element as HTMLElement & { value: string };
    mathField.value = latex;
    mathField.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: latex }));
  }, answer);
  await page.getByRole("button", { name: "Check answer" }).click();

  await expect(page.getByText("Answer accepted.")).toBeVisible();
});

test("keeps accepted feedback with the current question until next", async ({ page }) => {
  const seed = 12_345;
  const answer = generateQuestion("expressions", seed, "easy").answer.latex;
  await page.addInitScript((fixedTime) => {
    Date.now = () => fixedTime;
  }, seed);
  await page.goto("/practice/");

  const field = page.locator("math-field.math-answer-field");
  await field.evaluate((element, latex) => {
    const mathField = element as HTMLElement & { value: string };
    mathField.value = latex;
    mathField.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: latex }));
  }, answer);
  await page.getByRole("button", { name: "Check answer" }).click();

  await expect(page.getByText("Answer accepted.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expressions" })).toBeVisible();
  await expect(page.getByText("Calibration 1 of 8")).toBeVisible();
  await page.getByRole("button", { name: "Load the next question" }).click();
  await expect(page.getByRole("heading", { name: "Equations & inequalities" })).toBeVisible();
  await expect(page.getByText("Calibration 2 of 8")).toBeVisible();
});

test("topic links override the adaptive queue", async ({ page }) => {
  await page.goto("/progress/");
  await page.getByRole("link", { name: "Answer the first question" }).click();
  await page.locator("select").selectOption("functions");
  await expect(page).toHaveURL(/topic=functions/);
  await expect(page.getByRole("heading", { name: "Functions" })).toBeVisible();
});

test("has no serious accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("fits mobile, zoom-equivalent, tablet, and desktop widths", async ({ page }) => {
  for (const width of [360, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/practice/");
    await expect(page.locator("math-field.math-answer-field")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.body.scrollWidth
    }));
    expect(dimensions.content, `${width}px layout should not overflow`).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test("keeps app controls at least 44px tall on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/practice/");
  const undersized = await page.locator("a:not(.skip-link), button, select, summary").evaluateAll((elements) =>
    elements
      .map((element) => ({ label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName, height: element.getBoundingClientRect().height }))
      .filter((item) => item.height > 0 && item.height < 43.5)
  );
  expect(undersized).toEqual([]);
});

test("respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/practice/");
  const transition = await page.locator(".problem-sheet").evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transition).toMatch(/0\.01ms|0\.00001s|1e-05s|0s/);
});
