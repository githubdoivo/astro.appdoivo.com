import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// A fixed moment, so the checks below do not drift: 29 Oct 2026, 12:00 in Lisbon
const AT = "/?lang=en&d=2026-10-29T12:00&tz=Europe/Lisbon";

test.beforeEach(async ({ page }) => {
  // Start each test with nothing saved, but keep what the test itself saves across reloads
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("fresh")) { localStorage.clear(); sessionStorage.setItem("fresh", "1"); } } catch (_) {} });
});

test("the page renders with no errors and every section filled", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith("http://localhost")) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(AT);
  await expect(page.locator("#planet-cards .pcard")).toHaveCount(10);
  await expect(page.locator("#planet-rows tr")).toHaveCount(10);
  await expect(page.locator("#retro-list li")).toHaveCount(8);           // every planet but the Sun and Moon
  await expect(page.locator("#coming-list li").first()).toBeVisible();
  await expect(page.locator("#moon-card")).toContainText("Waning Gibbous");
  for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]) expect((await page.request.get(`/${f}`)).status(), f).toBe(200);
  expect(errors).toEqual([]);
});

// Checked against published ephemerides and ponteiro.com.br for the same dates
test("the sums match known dates", async ({ page }) => {
  await page.goto(AT);
  const r = await page.evaluate(() => {
    const s = Sky.sky(new Date("2026-10-29T12:00:00Z"));
    const day = (t) => new Date(t).toISOString().slice(0, 10);
    const p = Object.fromEntries(s.planets.map((x) => [x.body, { sign: x.sign, retro: x.retro, since: day(x.since), until: day(x.until) }]));
    const merc = s.retrogrades.find((x) => x.body === "Mercury");
    return { p, merc: { now: merc.now, start: day(merc.start), end: day(merc.end) } };
  });
  // Signs: 0 Aries … 7 Scorpio … 10 Aquarius
  expect(r.p.Sun).toEqual({ sign: 7, retro: false, since: "2026-10-23", until: "2026-11-22" });
  expect(r.p.Mars).toMatchObject({ sign: 4, since: "2026-09-28", until: "2026-11-25" });
  expect(r.p.Jupiter).toMatchObject({ sign: 4, since: "2026-06-30" });
  expect(r.p.Saturn).toMatchObject({ sign: 0, retro: true, since: "2026-02-14" });
  expect(r.p.Pluto).toMatchObject({ sign: 10, since: "2024-11-19" });
  expect(r.p.Mercury).toMatchObject({ sign: 7, retro: true });
  expect(r.merc).toEqual({ now: true, start: "2026-10-24", end: "2026-11-13" });
});

test("Mercury retrograde is called out at the top, with its period and days left", async ({ page }) => {
  await page.goto(AT);
  const m = page.locator("#mercury");
  await expect(m).toHaveClass(/is-now/);
  await expect(m).toContainText("Mercury is retrograde");
  await expect(m).toContainText("24 Oct 2026 – 13 Nov 2026");
  await expect(m).toContainText("16 days left");
  // After it ends, the banner shows the next one instead
  await page.goto("/?lang=en&d=2026-11-20T12:00&tz=Europe/Lisbon");
  await expect(m).not.toHaveClass(/is-now/);
  await expect(m).toContainText("Next Mercury retrograde");
});

test("cards first, a table on request, and the choice is remembered", async ({ page }) => {
  await page.goto(AT);
  await expect(page.locator("#planet-cards")).toBeVisible();
  await expect(page.locator("#planet-table")).toBeHidden();
  const merc = page.locator(".pcard", { hasText: "Mercury" });
  await expect(merc).toContainText("Scorpio");
  await expect(merc).toContainText("Thinking, talking");
  await expect(merc).toContainText("Retrograde until 13 Nov");
  await page.locator("#view-table").click();
  await expect(page.locator("#planet-table")).toBeVisible();
  await expect(page.locator("#view-table")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("#planet-table")).toBeVisible();
});

test("the wheel, balance and aspects stay folded until asked for", async ({ page }) => {
  await page.goto(AT);
  await expect(page.locator("#wheel svg")).toBeHidden();
  await page.locator("#more summary").click();
  await expect(page.locator("#wheel svg")).toBeVisible();
  await expect(page.locator("#wheel .planet")).toHaveCount(10);
  await expect(page.locator("#elements .bar")).toHaveCount(4);
  await expect(page.locator("#aspect-list li").first()).toBeVisible();
});

test("the arrows move a day, Now goes back to the present, and the link keeps the moment", async ({ page }) => {
  await page.goto(AT);
  await page.locator("#next").click();
  await expect(page.locator("#when")).toHaveValue("2026-10-30T12:00");
  expect(page.url()).toContain("d=2026-10-30T12%3A00");
  await page.locator("#prev").click();
  await page.locator("#prev").click();
  await expect(page.locator("#when")).toHaveValue("2026-10-28T12:00");
  await page.locator("#now").click();
  await expect(page.locator("#now")).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).not.toContain("d=");
});

test("changing the time zone keeps the instant and moves the clock", async ({ page }) => {
  await page.goto(AT);
  await page.locator("#tz").selectOption("America/Sao_Paulo");
  await expect(page.locator("#when")).toHaveValue("2026-10-29T09:00");
  await expect(page.locator("#tz-offset")).toHaveText(/GMT−03:00/);
  // The Sun's sign change is now shown in Brazilian time
  await page.locator("#view-table").click();
  await expect(page.locator("#planet-rows tr").first()).toContainText("23 Oct 2026");
});

test("Portuguese: from the browser, European Portuguese names, and remembered", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "pt-PT", timezoneId: "Europe/Lisbon" });
  const page = await ctx.newPage();
  await page.goto("/?d=2026-10-29T12:00");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  await expect(page.locator("#mercury")).toContainText("Mercúrio está retrógrado");
  await expect(page.locator(".pcard", { hasText: "Vénus" })).toContainText("Balança");
  await expect(page.locator(".pcard", { hasText: "Saturno" })).toContainText("Carneiro");
  await page.locator("#lang").click();
  await expect(page.locator("#view-cards")).toHaveText("Cards");
  await page.reload();
  await expect(page.locator("#lang")).toHaveText("PT");
  await ctx.close();
});

test("English labels use Title Case", async ({ page }) => {
  await page.goto(AT);
  const e = await page.evaluate(() => WORDS.en);
  const small = new Set(["a", "an", "and", "the", "of", "in", "on", "at", "to", "for", "by"]);
  for (const label of [e.tagline, e.skyOn, e.now, e.prevDay, e.nextDay, e.zone, e.wheel, e.planets, e.planet, e.sign, e.position, e.entered, e.leaves, e.stay, e.retro, e.balance, e.elements, e.modalities, e.aspects, e.moon, e.nextPhases, e.coming, e.soonTitle, e.retros, e.retroNow, e.retroNext, e.cards, e.table, e.more]) {
    label.split(/\s+/).forEach((w, i) => { if (i === 0 || !small.has(w.toLowerCase())) expect(w[0], `"${label}"`).toBe(w[0].toUpperCase()); });
  }
  // Both languages have the same keys
  const pt = await page.evaluate(() => WORDS.pt);
  expect(Object.keys(pt).sort()).toEqual(Object.keys(e).sort());
});

test("no sideways scroll, at any width, light or dark", async ({ browser }) => {
  for (const scheme of ["light", "dark"]) for (const width of [340, 390, 768, 1280, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(AT);
    await page.locator("#more summary").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width} ${scheme}`).toBeLessThanOrEqual(0);
    await ctx.close();
  }
});

test("touch targets are at least 44px", async ({ page }) => {
  await page.goto(AT);
  for (const sel of ["#lang", "#prev", "#now", "#next", "#when", "#tz", "#view-cards", "#view-table", "#more summary", "footer a"]) {
    const b = await page.locator(sel).boundingBox();
    expect(b.height, sel).toBeGreaterThanOrEqual(44);
  }
});

test("no serious accessibility problems, folded and open, light and dark", async ({ browser }) => {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(AT);
    await page.locator("#more summary").click();
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), scheme).toEqual([]);
    await ctx.close();
  }
});
