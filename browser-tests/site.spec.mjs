import { test, expect } from "@playwright/test";

test("navigation fits, tag filters work, and theme persists", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/experiences/");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Articles", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Concepts", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const items = page.locator("[data-experiences-list] > li");
  const total = await items.count();
  expect(total).toBeGreaterThan(0);
  const filter = page
    .locator('[data-tag-filter] button[data-tag]:not([data-tag=""])')
    .first();
  const tag = await filter.getAttribute("data-tag");
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  for (const item of await items.all()) {
    const matches = (await item.getAttribute("data-tags"))
      .split(",")
      .includes(tag);
    if (matches) await expect(item).toBeVisible();
    else await expect(item).toBeHidden();
  }
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(items.filter({ visible: true })).toHaveCount(total);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Concepts" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Concepts", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("article footnotes are keyboard accessible and have return links", async ({
  page,
}) => {
  await page.goto(
    "/experiences/2026-03-29-ai-clients-need-context-signals-and-choice/",
  );
  const note = page.locator("a[data-footnote-ref]").first();
  await expect(note).toBeVisible();
  await note.focus();
  await page.keyboard.press("Enter");
  const target = await note.getAttribute("href");
  expect(page.url()).toContain(target);
  await expect(page.locator(target)).toContainText("The apps or interfaces");
  await expect(
    page.locator(target).locator("a[data-footnote-backref]"),
  ).toBeVisible();
});

test("draft routes are excluded publicly or have concept backlinks in private preview", async ({
  page,
}) => {
  const response = await page.goto(
    "/experiences/2026-09-06-architecture-as-workflow/",
  );
  if (!process.env.PREVIEW_URL) {
    expect(response.status()).toBe(404);
    return;
  }
  expect(response.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await page
    .getByRole("complementary", { name: "Related concepts" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "Supporting articles" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "I See Architecture Through Workflows" }),
  ).toBeVisible();
});
