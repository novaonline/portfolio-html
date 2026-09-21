import { test, expect } from "@playwright/test";
const count = (page, key) =>
  page.locator(`[data-node="${key}"] [data-node-state]`);

test("holding analytics exposes stale observations while independent work continues", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#architecture");
  const diagram = page.locator("[data-greenfield]");
  await diagram.getByRole("button", { name: "Pause after batch" }).click();
  for (let i = 0; i < 3; i++)
    await diagram.getByRole("button", { name: "Create item" }).click();
  await diagram
    .getByRole("button", { name: "Pause scene", exact: true })
    .click();
  const before = await diagram
    .locator(".gf-token")
    .first()
    .getAttribute("transform");
  await page.waitForTimeout(250);
  expect(
    await diagram.locator(".gf-token").first().getAttribute("transform"),
  ).toBe(before);
  await diagram
    .getByRole("button", { name: "Resume scene", exact: true })
    .click();
  await expect(count(page, "web")).toContainText("3 confirmed", {
    timeout: 12000,
  });
  await expect(count(page, "business")).toContainText("3 processed", {
    timeout: 12000,
  });
  await expect(count(page, "analytics")).toContainText("0 observed");
  await expect(count(page, "analytics")).toContainText("3 pending");
  await page.screenshot({
    path: `.work/greenfield-held-${test.info().project.name}.png`,
    fullPage: true,
  });
  await diagram.getByRole("button", { name: "Resume processing" }).click();
  await expect(count(page, "analytics")).toContainText("3 observed", {
    timeout: 7000,
  });
  await expect(count(page, "analytics")).toContainText("0 pending");
  await expect(count(page, "analytics")).toContainText("#3");
  await expect(
    page.locator('[data-batch="analytics"] [data-batch-items]'),
  ).toHaveText("Last: #1 #2 #3");
  await expect(
    page.locator('[data-batch="analytics"] [data-batch-done]'),
  ).toHaveText("1 batch completed");
  const bounds = await diagram.locator("[data-hold]").boundingBox();
  const statusBounds = await diagram.locator("[data-status]").boundingBox();
  expect(bounds.y + bounds.height).toBeLessThan(statusBounds.y);
  await expect(diagram).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("reduced motion retains holds, every click and reset semantics", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const diagram = page.locator("[data-greenfield]");
  await diagram.getByRole("button", { name: "Pause after batch" }).click();
  for (let i = 0; i < 3; i++)
    await diagram.getByRole("button", { name: "Create item" }).click();
  await expect(count(page, "product")).toContainText("3 saved");
  await expect(count(page, "business")).toContainText("3 processed");
  await expect(count(page, "analytics")).toContainText("3 pending");
  await expect(diagram.locator(".gf-token")).toHaveCount(0);
  await expect(diagram.locator("[data-pause]")).toBeHidden();
  await diagram.getByRole("button", { name: "Resume processing" }).click();
  await expect(count(page, "analytics")).toContainText("3 observed");
  await diagram.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(count(page, "product")).toContainText("0 saved");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: `.work/greenfield-dark-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("static overview explains the tradeoff without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:4322");
  await expect(page.locator("[data-node]")).toHaveCount(8);
  await expect(page.locator("[data-edge]")).toHaveCount(9);
  await expect(page.locator("[data-status]")).toContainText(
    "observations stale",
  );
  await expect(page.locator("[data-create]")).toBeHidden();
  await expect(page.locator("#gf-explanation .diagram-identity")).toHaveCount(
    4,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
