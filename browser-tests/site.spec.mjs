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
      .getByRole("link", { name: "Experiences", exact: true }),
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

test("unselected routes stay absent and private concept backlinks work", async ({
  page,
}) => {
  if (!process.env.PREVIEW_URL) {
    const response = await page.goto("/experiences/unselected-draft-fixture/");
    expect(response.status()).toBe(404);
    return;
  }
  await page.goto("/concepts/");
  const conceptLink = page.locator('main a[href^="/concepts/"]').first();
  const conceptTitle = (await conceptLink.innerText()).trim();
  await conceptLink.click();
  await expect(
    page.getByRole("heading", { name: "Supporting experiences" }),
  ).toBeVisible();
  await page.locator('main aside a[href^="/experiences/"]').first().click();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await page
    .getByRole("complementary", { name: "Related concepts" })
    .getByRole("link", { name: conceptTitle, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: conceptTitle, exact: true }),
  ).toBeVisible();
});

test("whole phrases support tap, keyboard, dismissal, hover and footer navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.PREVIEW_URL,
    "Current public revisions predate phrase annotations; verify the new drafts in preview.",
  );
  await page.goto("/experiences/2026-03-29-mcp-needs-auth-and-governance/");
  const term = page.getByRole("button", {
    name: "virtual server",
    exact: true,
  });
  await expect(term).toBeVisible();
  if (testInfo.project.name === "mobile") await term.tap();
  else await term.click();
  const tooltip = page.locator(`#${await term.getAttribute("aria-controls")}`);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("IBM ContextForge");
  const bounds = await tooltip.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await term.focus();
  await page.keyboard.press("Space");
  await expect(tooltip).toBeVisible();
  await page.locator("h1").click();
  await expect(tooltip).toBeHidden();
  if (testInfo.project.name === "desktop") {
    await term.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
  }
  const ref = page.locator("a[data-footnote-ref]").nth(1);
  await ref.click();
  expect(page.url()).toContain(await ref.getAttribute("href"));
  await expect(page.locator(await ref.getAttribute("href"))).toContainText(
    "IBM ContextForge",
  );
});

test("whole phrase links work with JavaScript disabled", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !process.env.PREVIEW_URL,
    "New annotations are in the private draft revisions.",
  );
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto("/experiences/2026-03-29-mcp-needs-auth-and-governance/");
  const term = page.getByRole("link", { name: "virtual server", exact: true });
  await term.click();
  expect(page.url()).toContain(await term.getAttribute("href"));
  await expect(page.locator(await term.getAttribute("href"))).toContainText(
    "IBM ContextForge",
  );
  await context.close();
});
