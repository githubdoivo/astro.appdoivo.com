import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// A fixed moment, so the checks below do not drift: 29 Oct 2026, 12:00 in Lisbon
const Q = "?lang=en&d=2026-10-29T12:00&tz=Europe/Lisbon";
const PAGES = ["/", "/planets/", "/retrogrades/", "/moon/", "/chart/", "/returns/", "/calendar/"];

test.beforeEach(async ({ page }) => {
  // Start each test with nothing saved, but keep what the test itself saves across pages
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("fresh")) { localStorage.clear(); sessionStorage.setItem("fresh", "1"); } } catch (_) {} });
});

test("every page renders with no errors or missing files", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith("http://localhost")) errors.push(`${r.status()}: ${r.url()}`); });
  for (const p of PAGES) {
    await page.goto(p + Q);
    await expect(page.locator("h1"), p).not.toBeEmpty();
    await expect(page.locator("#nav a[aria-current=page]"), p).toHaveCount(1);
  }
  for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "og-image.png"]) expect((await page.request.get(`/${f}`)).status(), f).toBe(200);
  expect(errors).toEqual([]);
});

// Checked against published ephemerides and ponteiro.com.br for the same dates
test("the sums match known dates", async ({ page }) => {
  await page.goto("/" + Q);
  const r = await page.evaluate(() => {
    const s = Sky.sky(new Date("2026-10-29T12:00:00Z"));
    const day = (t) => new Date(t).toISOString().slice(0, 10);
    const p = Object.fromEntries(s.planets.map((x) => [x.body, { sign: x.sign, retro: x.retro, since: day(x.since), until: day(x.until) }]));
    const merc = s.retrogrades.find((x) => x.body === "Mercury");
    return { p, merc: { now: merc.now, start: day(merc.start), end: day(merc.end) } };
  });
  expect(r.p.Sun).toEqual({ sign: 7, retro: false, since: "2026-10-23", until: "2026-11-22" });
  expect(r.p.Mars).toMatchObject({ sign: 4, since: "2026-09-28", until: "2026-11-25" });
  expect(r.p.Jupiter).toMatchObject({ sign: 4, since: "2026-06-30" });
  expect(r.p.Saturn).toMatchObject({ sign: 0, retro: true, since: "2026-02-14" });
  expect(r.p.Pluto).toMatchObject({ sign: 10, since: "2024-11-19" });
  expect(r.p.Mercury).toMatchObject({ sign: 7, retro: true });
  expect(r.merc).toEqual({ now: true, start: "2026-10-24", end: "2026-11-13" });
});

test("the landing page is the table: ten planets, their sign, since, until, retrograde marks", async ({ page, isMobile }) => {
  await page.goto("/" + Q);
  await expect(page.locator("h1")).toHaveText("The Sky");
  const rows = page.locator("#sky-rows tr");
  await expect(rows).toHaveCount(10);
  await expect(rows.nth(0)).toContainText("Sun");
  await expect(rows.nth(0)).toContainText("Scorpio");
  await expect(rows.nth(0)).toContainText("22 Nov");
  await expect(page.locator("#sky-rows abbr.retro")).toHaveCount(5);           // Mercury, Venus, Saturn, Uranus, Neptune
  await expect(page.locator(".legend")).toContainText("R: retrograde");
  await expect(page.locator("#sky-notes")).toContainText("Mercury is retrograde until 13 Nov 2026");
  // Nothing else competes with the table: no cards, wheel or open controls
  await expect(page.locator(".pcard, .wheel")).toHaveCount(0);
  await expect(page.locator("#controls")).toBeHidden();
  for (const c of [".c-since", ".c-until", ".c-stay"]) await expect(page.locator(`thead ${c}`)).toBeVisible();   // the full table on phones too
});

test("the date and place sit in one line; Change opens the controls", async ({ page }) => {
  await page.goto("/" + Q);
  await expect(page.locator("#moment-text")).toContainText("Thursday, 29 October 2026, 12:00");
  await expect(page.locator("#moment-text")).toContainText("Lisbon");
  await expect(page.locator("#controls")).toBeHidden();
  await page.locator("#change").click();
  await expect(page.locator("#controls")).toBeVisible();
  await expect(page.locator("#change")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#when")).toBeFocused();
  await page.locator("#next").click();
  await expect(page.locator("#when")).toHaveValue("2026-10-30T12:00");
  expect(page.url()).toContain("d=2026-10-30T12%3A00");
  await page.locator("#now").click();
  await expect(page.locator("#now")).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).not.toContain("d=");
  await expect(page.locator("#moment-text")).toContainText("Now");
});

test("the menu keeps the chosen moment from page to page", async ({ page }) => {
  await page.goto("/?lang=en&d=2026-10-29T12:00&tz=America/New_York");
  await page.locator("#nav a[data-page=retrogrades]").click();
  await expect(page).toHaveURL(/\/retrogrades\/\?d=2026-10-29T12%3A00&tz=America%2FNew_York/);
  await expect(page.locator("h1")).toHaveText("Retrogrades");
  await expect(page.locator("#moment-text")).toContainText("29 October 2026, 12:00");
  await expect(page.locator("#moment-text")).toContainText("New York");
  await page.locator("#nav a[data-page=sky]").click();
  await expect(page.locator("#sky-rows tr")).toHaveCount(10);
});

test("Retrogrades: Mercury first, with its period and days left; the next one after it ends", async ({ page }) => {
  await page.goto("/retrogrades/" + Q);
  const m = page.locator("#mercury");
  await expect(m).toHaveClass(/is-now/);
  await expect(m).toContainText("24 Oct 2026 – 13 Nov 2026");
  await expect(m).toContainText("16 days left");
  await expect(page.locator("#retro-list li")).toHaveCount(8);
  await page.goto("/retrogrades/?lang=en&d=2026-11-20T12:00&tz=Europe/Lisbon");
  await expect(m).not.toHaveClass(/is-now/);
  await expect(m).toContainText("Next Mercury retrograde");
});

test("Planets, Moon, Chart and Calendar each show their part", async ({ page }) => {
  await page.goto("/planets/" + Q);
  await expect(page.locator(".pcard")).toHaveCount(10);
  await expect(page.locator(".pcard", { hasText: "Mercury" })).toContainText("Retrograde until 13 Nov");
  await page.goto("/moon/" + Q);
  await expect(page.locator("#moon-card")).toContainText("Waning Gibbous");
  await expect(page.locator("#moon-sign")).toContainText("Moon in Gemini");
  await page.goto("/chart/" + Q);
  await expect(page.locator("#wheel .planet")).toHaveCount(10);
  await expect(page.locator("#elements .bar")).toHaveCount(4);
  await expect(page.locator("#aspect-list li").first()).toBeVisible();
  await page.goto("/calendar/" + Q);
  await expect(page.locator("#calendar-list .month")).toHaveCount(3);
  await expect(page.locator("#calendar-list")).toContainText("Mercury turns direct in");
  await expect(page.locator("#calendar-list")).toContainText("Full Moon in");
});

test("changing the time zone keeps the instant and moves the clock", async ({ page }) => {
  await page.goto("/" + Q);
  await page.locator("#change").click();
  await page.locator("#tz").selectOption("America/Sao_Paulo");
  await expect(page.locator("#when")).toHaveValue("2026-10-29T09:00");
  await expect(page.locator("#tz-offset")).toHaveText(/GMT−03:00/);
  await expect(page.locator("#moment-text")).toContainText("Sao Paulo");
});

test("Portuguese: from the browser, European Portuguese names, remembered across pages", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "pt-PT", timezoneId: "Europe/Lisbon" });
  const page = await ctx.newPage();
  await page.goto("/?d=2026-10-29T12:00");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  await expect(page.locator("h1")).toHaveText("O Céu");
  await expect(page.locator("#sky-rows")).toContainText("Balança");
  await expect(page.locator("#sky-rows")).toContainText("Carneiro");
  await expect(page.locator("#sky-notes")).toContainText("Mercúrio está retrógrado");
  await page.locator("#lang").click();
  await expect(page.locator("h1")).toHaveText("The Sky");
  await page.locator("#nav a[data-page=moon]").click();
  await expect(page.locator("h1")).toHaveText("Moon");
  await ctx.close();
});

test("English labels use Title Case, and both languages have the same words", async ({ page }) => {
  await page.goto("/" + Q);
  const e = await page.evaluate(() => WORDS.en);
  const small = new Set(["a", "an", "and", "the", "of", "in", "on", "at", "to", "for", "by"]);
  const labels = [e.bornDate, e.bornTime, e.bornZone, e.findReturns, e.satReturn, e.everyPlanet, e.toDark, e.toLight, e.skyTitle, e.now, e.prevDay, e.nextDay, e.zone, e.skyOn, e.change, e.close, e.planet, e.sign, e.since, e.untilCol, e.stay,
    e.wheel, e.balance, e.elements, e.modalities, e.aspects, e.nextPhases, e.retroNow, e.retroNext, e.aboutRetro, ...Object.values(e.nav)];
  for (const label of labels) label.split(/\s+/).forEach((w, i) => { if (i === 0 || !small.has(w.toLowerCase())) expect(w[0], `"${label}"`).toBe(w[0].toUpperCase()); });
  const pt = await page.evaluate(() => WORDS.pt);
  expect(Object.keys(pt).sort()).toEqual(Object.keys(e).sort());
  // Golden rule: Portuguese labels are Title Case too, so both languages match ("The Sky" / "O Céu")
  const smallPt = new Set(["o", "a", "os", "as", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "ao", "aos", "à", "um", "uma", "por", "para", "com"]);
  const ptLabels = [pt.skyTitle, pt.now, pt.prevDay, pt.nextDay, pt.zone, pt.skyOn, pt.change, pt.close, pt.planet, pt.sign, pt.since, pt.untilCol, pt.stay,
    pt.wheel, pt.balance, pt.elements, pt.modalities, pt.aspects, pt.nextPhases, pt.retroNow, pt.retroNext, pt.aboutRetro, pt.bornDate, pt.bornTime, pt.bornZone,
    pt.findReturns, pt.satReturn, pt.everyPlanet, pt.toDark, pt.toLight, ...Object.values(pt.nav), ...pt.quarters];
  for (const label of ptLabels) label.split(/\s+/).forEach((w, i) => { if (i === 0 || !smallPt.has(w.toLowerCase())) expect(w[0], `"${label}"`).toBe(w[0].toUpperCase()); });
  expect(Object.keys(pt.nav).sort()).toEqual(Object.keys(e.nav).sort());
});

test("no sideways scroll on any page, at any width, light or dark", async ({ browser }) => {
  test.setTimeout(180000);
  for (const scheme of ["light", "dark"]) for (const width of [340, 390, 768, 1280, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      await page.goto(p + Q);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${p} ${width} ${scheme}`).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  }
});

test("touch targets are at least 44px", async ({ page }) => {
  await page.goto("/" + Q);
  await page.locator("#change").click();
  for (const sel of ["#lang", ".brand", "#change", "#when", "#tz", "#prev", "#now", "#next", "#nav a >> nth=0"]) {
    const b = await page.locator(sel).boundingBox();
    expect(b.height, sel).toBeGreaterThanOrEqual(44);
    expect(b.width, sel).toBeGreaterThanOrEqual(24);
  }
});

test("no serious accessibility problems on any page, light and dark", async ({ browser }) => {
  test.setTimeout(120000);
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      await page.goto(p + Q);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), `${p} ${scheme}`).toEqual([]);
    }
    await ctx.close();
  }
});

test("a lost link shows a calm 404 with a way back", async ({ page }) => {
  await page.goto("/404.html");
  await expect(page.locator("h1")).toHaveText("Lost in Space");
  await expect(page.locator("a[href='/']")).toBeVisible();
});

test("returns: Saturn comes back at about 29 and 58, every planet has a row, and the birth can be forgotten", async ({ page }) => {
  await page.goto("/returns/" + Q);
  await expect(page.locator("#returns-out")).toContainText("Enter a birth date");
  await page.locator("#born-date").fill("1990-01-01");
  await page.locator("#born-time").fill("12:00");
  await page.locator("#born-tz").selectOption("Europe/Lisbon");
  await page.locator("#born button[type=submit]").click();
  const sat = page.locator(".sat-list li");
  await expect(sat).toHaveCount(3);                                         // ages 29, 58, 88
  await expect(sat.nth(0)).toContainText("7 Feb 2019");                     // Saturn back on 15° Capricorn, three passes in 2019
  await expect(sat.nth(0)).toContainText("age 29");
  await expect(sat.nth(1)).toContainText("age 58");
  await expect(page.locator(".rets li")).toHaveCount(9);
  await expect(page.locator(".rets")).toContainText("no return in a lifetime");   // Neptune and Pluto
  await page.reload();                                                      // kept on this device
  await expect(sat).toHaveCount(3);
  await page.locator("#forget").click();
  await expect(page.locator("#returns-out")).toContainText("Enter a birth date");
});
