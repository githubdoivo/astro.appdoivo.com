// Astro: picks the moment, asks sky.js for the sky, draws it.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = "︎";                                   // text, not emoji, for the symbols below
  const GLYPH = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
  const SIGN = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  const ASP = { conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍" };
  const g = (s) => s + T;
  const home = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = (Intl.supportedValuesOf && Intl.supportedValuesOf("timeZone")) || [home];
  if (!zones.includes(home)) zones.unshift(home);

  // Language: ?lang=, then the last choice, then the browser
  let saved = null; try { saved = localStorage.getItem("lang"); } catch (_) {}
  const params = new URLSearchParams(location.search);
  let lang = params.get("lang") || saved || ((navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en");
  if (!WORDS[lang]) lang = "en";
  let w = WORDS[lang];

  // Time zone: ?tz=, else the device's. All times are shown and typed in it.
  let zone = zones.includes(params.get("tz")) ? params.get("tz") : home;
  // Minutes the zone is ahead of UTC at instant t
  function offset(t) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / 60000;
  }
  // "2026-10-29T14:30" read as a wall clock in the zone
  function fromWall(v) {
    const [d, tm] = v.split("T"), [y, mo, da] = d.split("-").map(Number), [h, mi] = (tm || "00:00").split(":").map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    let t = guess - offset(guess) * 60000;
    t = guess - offset(t) * 60000;                       // once more, for the days the clocks change
    return new Date(t);
  }

  // The moment: ?d= (a wall clock in the zone, as the date field writes it), else now
  const parsed = params.get("d") ? fromWall(params.get("d")) : null;
  let when = parsed && !isNaN(parsed) ? parsed : new Date();
  let live = !parsed;                                   // "now" keeps ticking; a chosen date stays put

  const loc = () => (lang === "pt" ? "pt-PT" : "en-GB");
  const fmtDay = (t) => new Date(t).toLocaleDateString(loc(), { timeZone: zone, day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (t) => new Date(t).toLocaleTimeString(loc(), { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  const fmtWhen = (t) => `${fmtDay(t)}, ${fmtTime(t)}`;
  const deg = (d) => { const a = Math.floor(d), m = Math.floor((d - a) * 60); return `${a}°${String(m).padStart(2, "0")}′`; };
  const unit = (n, k) => `${n} ${w.unit[k][n === 1 ? 0 : 1]}`;
  function span(a, b) {
    if (a == null || b == null) return "—";
    if (b - a < 3 * 86400000) {                          // the Moon: days and hours
      const h = Math.round((b - a) / 3600000), d = Math.floor(h / 24);
      return [d && unit(d, "d"), h % 24 && unit(h % 24, "h")].filter(Boolean).join(" ");
    }
    const x = new Date(a), y = new Date(b);
    let Y = y.getFullYear() - x.getFullYear(), M = y.getMonth() - x.getMonth(), D = y.getDate() - x.getDate();
    if (D < 0) { M--; D += new Date(y.getFullYear(), y.getMonth(), 0).getDate(); }
    if (M < 0) { Y--; M += 12; }
    return [Y && unit(Y, "y"), M && unit(M, "m"), D && unit(D, "d")].filter(Boolean).join(" ") || unit(0, "d");
  }
  const localInput = (d) => new Date(d.getTime() + offset(d.getTime()) * 60000).toISOString().slice(0, 16);
  const zoneName = (z) => { const parts = z.split("/"); return parts.length > 1 ? `${parts.at(-1).replace(/_/g, " ")} (${parts.slice(0, -1).join(" / ").replace(/_/g, " ")})` : z; };
  const gmt = (z) => { const m = (() => { const o = zone; zone = z; const v = offset(Date.now()); zone = o; return v; })();
    return `GMT${m < 0 ? "−" : "+"}${String(Math.floor(Math.abs(m) / 60)).padStart(2, "0")}:${String(Math.abs(m) % 60).padStart(2, "0")}`; };

  // ---- drawing ----
  function wheel(sky) {
    const C = 180, R1 = 172, R2 = 140, RP = 116, RA = 84;
    const pt = (l, r) => { const a = Math.PI + (l * Math.PI) / 180; return [C + r * Math.cos(a), C - r * Math.sin(a)]; };
    let s = `<svg viewBox="0 0 360 360" role="img" aria-labelledby="wheel-title"><title id="wheel-title">${esc(w.wheel)}</title>`;
    s += `<circle cx="${C}" cy="${C}" r="${R1}" class="ring"/><circle cx="${C}" cy="${C}" r="${R2}" class="ring"/><circle cx="${C}" cy="${C}" r="${RA}" class="ring faint"/>`;
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = pt(i * 30, R2), [x2, y2] = pt(i * 30, R1), [gx, gy] = pt(i * 30 + 15, (R1 + R2) / 2);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tick"/>`;
      s += `<text x="${gx}" y="${gy}" class="sign el-${Sky.ELEMENT[i % 4]}">${g(SIGN[i])}</text>`;
    }
    for (let d = 0; d < 360; d += 5) { const [a, b] = pt(d, R2), [c, e] = pt(d, R2 - (d % 30 === 0 ? 0 : d % 10 === 0 ? 7 : 4)); s += `<line x1="${a}" y1="${b}" x2="${c}" y2="${e}" class="tick"/>`; }
    // Aspect lines between the planets, inside
    const by = Object.fromEntries(sky.planets.map((p) => [p.body, p]));
    for (const a of sky.aspects) {
      if (a.key === "conjunction") continue;
      const [x1, y1] = pt(by[a.a].lon, RA), [x2, y2] = pt(by[a.b].lon, RA);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="asp asp-${a.key}"/>`;
    }
    // Planets: nudge close ones inward so the glyphs never sit on top of each other
    const sorted = [...sky.planets].sort((a, b) => a.lon - b.lon);
    let lastLon = -99, level = 0;
    for (const p of sorted) {
      level = p.lon - lastLon < 9 ? level + 1 : 0; lastLon = p.lon;
      const r = RP - level * 20, [x, y] = pt(p.lon, r), [mx, my] = pt(p.lon, R2), [ix, iy] = pt(p.lon, RA);
      s += `<line x1="${mx}" y1="${my}" x2="${mx + (x - mx) * 0.25}" y2="${my + (y - my) * 0.25}" class="mark"/>`;
      s += `<circle cx="${ix}" cy="${iy}" r="2" class="dot"/>`;
      s += `<text x="${x}" y="${y}" class="planet${p.retro ? " is-retro" : ""}"><title>${esc(w.bodies[p.body])} ${deg(p.deg)} ${esc(w.signs[p.sign])}${p.retro ? " " + esc(w.retro) : ""}</title>${g(GLYPH[p.body])}</text>`;
    }
    return s + "</svg>";
  }

  function moonCard(m) {
    // A small drawn moon: the lit part as an ellipse over a dark disc
    const r = 34, k = Math.cos((m.angle * Math.PI) / 180);          // 1 new … -1 full
    const waxing = m.angle < 180, rx = Math.abs(k) * r;
    const litSide = waxing ? 1 : 0;                                  // which half is lit
    const half = `M 40 ${40 - r} A ${r} ${r} 0 0 ${litSide} 40 ${40 + r}`;
    const term = `A ${rx} ${r} 0 0 ${k > 0 ? 1 - litSide : litSide} 40 ${40 - r}`;
    const svg = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="moon-dark"/><path d="${half} ${term} Z" class="moon-lit"/></svg>`;
    const next = m.next.map((q) => `<li><span>${esc(w.quarters[q.quarter])}</span><time>${esc(fmtWhen(q.time))}</time></li>`).join("");
    return `${svg}<div><p class="moon-phase">${esc(w.phases[m.phase])}</p><p class="muted">${Math.round(m.lit * 100)}% ${esc(w.lit)}</p></div>
      <h3>${esc(w.nextPhases)}</h3><ul class="phases">${next}</ul>`;
  }

  function planetRows(sky) {
    return sky.planets.map((p) => `<tr>
      <th scope="row"><span class="glyph">${g(GLYPH[p.body])}</span>${esc(w.bodies[p.body])}</th>
      <td><span class="glyph">${g(SIGN[p.sign])}</span>${esc(w.signs[p.sign])}</td>
      <td class="num">${deg(p.deg)}${p.retro ? ` <abbr class="retro" title="${esc(w.retro)}">${w.retroShort}</abbr>` : ""}</td>
      <td class="num"><span class="cap">${esc(w.entered)}</span>${p.since ? esc(p.body === "Moon" ? fmtWhen(p.since) : fmtDay(p.since)) : "—"}</td>
      <td class="num"><span class="cap">${esc(w.leaves)}</span>${p.until ? esc(p.body === "Moon" ? fmtWhen(p.until) : fmtDay(p.until)) : "—"}</td>
      <td class="num"><span class="cap">${esc(w.stay)}</span>${esc(span(p.since, p.until))}</td></tr>`).join("");
  }

  const short = (t) => new Date(t).toLocaleDateString(loc(), { timeZone: zone, day: "numeric", month: "short" });
  const shortOrYear = (t) => (Math.abs(t - when.getTime()) > 300 * 86400000 ? fmtDay(t) : short(t));
  function planetCards(sky) {
    const rp = Object.fromEntries(sky.retrogrades.filter((r) => r.now).map((r) => [r.body, r]));
    return sky.planets.map((p) => {
      const a = p.since ? (p.body === "Moon" ? `${short(p.since)}, ${fmtTime(p.since)}` : shortOrYear(p.since)) : "—";
      const b = p.until ? (p.body === "Moon" ? `${short(p.until)}, ${fmtTime(p.until)}` : shortOrYear(p.until)) : "—";
      return `<li class="pcard${p.retro ? " is-retro" : ""}">
        <p class="pc-top"><span class="pc-name"><span class="glyph">${g(GLYPH[p.body])}</span>${esc(w.bodies[p.body])}</span><span class="pc-deg num">${deg(p.deg)}</span></p>
        <p class="pc-sign"><span class="glyph">${g(SIGN[p.sign])}</span>${esc(w.signs[p.sign])} <span class="pc-sm">· ${esc(w.signMeans[p.sign])}</span></p>
        <p class="pc-means">${esc(w.means[p.body])}</p>
        <p class="pc-dates">${esc(w.sinceUntil.replace("{a}", a).replace("{b}", b))} <span class="muted">(${esc(span(p.since, p.until))})</span></p>
        ${rp[p.body] ? `<p class="pc-retro">${esc(w.retroUntil.replace("{d}", short(rp[p.body].end)))}</p>` : ""}</li>`;
    }).join("");
  }
  function summary(sky) {
    const by = Object.fromEntries(sky.planets.map((p) => [p.body, p]));
    const n = sky.planets.filter((p) => p.retro).length;
    const lead = live ? w.sumNow : w.sumOn.replace("{d}", fmtWhen(when));
    const bits = [
      `<span class="nw">${g(GLYPH.Sun)} ${esc(w.bodies.Sun)}</span> ${esc(w.inSign)} ${esc(w.signs[by.Sun.sign])}`,
      `<span class="nw">${g(GLYPH.Moon)} ${esc(w.bodies.Moon)}</span> ${esc(w.inSign)} ${esc(w.signs[by.Moon.sign])}`,
      esc(n === 0 ? w.retroNone : n === 1 ? w.retroOne : w.retroMany.replace("{n}", n)),
    ].filter(Boolean);
    return `<span class="lead">${esc(lead)}:</span> ${bits.join(" · ")}`;
  }

  function bars(groups, names) {
    const total = Object.values(groups).reduce((n, list) => n + list.length, 0);
    return Object.entries(groups).map(([k, list]) => `<li class="bar el-${k}">
      <span class="bar-name">${esc(names[k])}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(list.length / total) * 100}%"></span></span>
      <span class="bar-n">${list.length}</span>
      <span class="bar-who" aria-label="${esc(list.map((b) => w.bodies[b]).join(", "))}">${list.map((b) => g(GLYPH[b])).join(" ")}</span></li>`).join("");
  }

  function aspectList(sky) {
    if (!sky.aspects.length) return `<p class="muted">${esc(w.noAspects)}</p>`;
    return `<ul class="aspects">${sky.aspects.map((a) => `<li>
      <span class="pair"><span class="glyph">${g(GLYPH[a.a])}</span>${esc(w.bodies[a.a])} <span class="asp-glyph asp-${a.key}" title="${esc(w.aspect[a.key])}">${g(ASP[a.key])}</span> <span class="glyph">${g(GLYPH[a.b])}</span>${esc(w.bodies[a.b])}</span>
      <span class="what">${esc(w.aspect[a.key])}</span>
      <span class="num muted">${esc(w.orb)} ${deg(a.orb)} · ${esc(a.applying ? w.applying : w.separating)}</span></li>`).join("")}</ul>`;
  }

  // Days left, as a short count
  const daysTo = (t) => Math.max(0, Math.ceil((t - when.getTime()) / 86400000));
  function mercury(sky) {
    const r = sky.retrogrades.find((x) => x.body === "Mercury");
    if (!r) return "";
    const signs = r.from === r.to ? `${g(SIGN[r.from])} ${esc(w.signs[r.from])}` : `${g(SIGN[r.from])} ${esc(w.signs[r.from])} → ${g(SIGN[r.to])} ${esc(w.signs[r.to])}`;
    const count = esc((r.now ? w.left : w.startsIn).replace("{n}", unit(r.now ? daysTo(r.end) : daysTo(r.start), "d")));
    return `<p class="merc-title"><span class="glyph">${g(GLYPH.Mercury)}</span>${esc(r.now ? w.mercNow : w.mercNext)}</p>
      <p class="merc-dates"><time>${esc(fmtDay(r.start))}</time> – <time>${esc(fmtDay(r.end))}</time></p>
      <p class="muted">${signs} · ${count}</p>`;
  }
  function retroList(sky) {
    const row = (r) => {
      const signs = r.from === r.to ? `<span class="glyph">${g(SIGN[r.from])}</span>${esc(w.signs[r.from])}`
        : `<span class="glyph">${g(SIGN[r.from])}</span>${esc(w.signs[r.from])} → <span class="glyph">${g(SIGN[r.to])}</span>${esc(w.signs[r.to])}`;
      return `<li class="${r.now ? "is-now" : ""}"><span class="who"><span class="glyph">${g(GLYPH[r.body])}</span>${esc(w.bodies[r.body])}</span>
        <span class="state">${esc(r.now ? w.retroNow : w.retroNext)}</span>
        <span class="num">${esc(fmtDay(r.start))} – ${esc(fmtDay(r.end))}</span>
        <span class="where">${signs}</span>
        <span class="track" aria-hidden="true"><span style="width:${r.now ? Math.min(100, ((when.getTime() - r.start) / (r.end - r.start)) * 100) : 0}%"></span></span></li>`;
    };
    const now = sky.retrogrades.filter((r) => r.now), next = sky.retrogrades.filter((r) => !r.now).sort((a, b) => a.start - b.start);
    return `<ul class="retros">${[...now, ...next].map(row).join("")}</ul>`;
  }

  function comingList(events) {
    if (!events.length) return `<p class="muted">${esc(w.nothing)}</p>`;
    return `<ol class="coming">${events.map((e) => {
      const who = `<span class="glyph">${g(GLYPH[e.body])}</span>${esc(w.bodies[e.body])}`;
      const sign = `<span class="glyph">${g(SIGN[e.sign])}</span>${esc(w.signs[e.sign])}`;
      const what = e.type === "ingress" ? `${who} ${esc(w.enters)} ${sign}${e.retro ? ` <span class="muted">(${esc(w.whileRetro)})</span>` : ""}`
        : `${who} ${esc(e.type === "retro" ? w.turnsRetro : w.turnsDirect)} ${sign}`;
      return `<li><time>${esc(fmtWhen(e.time))}</time><span>${what}</span></li>`;
    }).join("")}</ol>`;
  }

  function draw() {
    const sky = Sky.sky(when);
    $("when").value = localInput(when);
    $("now").setAttribute("aria-pressed", String(live));
    $("wheel").innerHTML = wheel(sky);
    $("moon-card").innerHTML = moonCard(sky.moon);
    $("planet-rows").innerHTML = planetRows(sky);
    $("planet-cards").innerHTML = planetCards(sky);
    $("summary").innerHTML = summary(sky);
    $("elements").innerHTML = bars(sky.elements, w.element);
    $("modalities").innerHTML = bars(sky.modalities, w.modality);
    $("aspect-list").innerHTML = aspectList(sky);
    $("mercury").innerHTML = mercury(sky);
    $("mercury").classList.toggle("is-now", sky.retrogrades.some((r) => r.body === "Mercury" && r.now));
    $("retro-list").innerHTML = retroList(sky);
    $("coming-list").innerHTML = comingList(Sky.upcoming(when, 45));
  }

  function fill() {
    w = WORDS[lang];
    document.documentElement.lang = w.lang;
    document.title = w.title;
    document.querySelectorAll("[data-w]").forEach((el) => (el.textContent = w[el.dataset.w]));
    document.querySelectorAll("[data-wl]").forEach((el) => el.setAttribute("aria-label", w[el.dataset.wl]));
    const b = $("lang"); b.textContent = w.other; b.setAttribute("aria-label", `${w.other}: ${w.otherLabel}`);
    const sel = $("tz");
    if (!sel.options.length) sel.innerHTML = zones.map((z) => `<option value="${esc(z)}">${esc(zoneName(z))}</option>`).join("");
    sel.value = zone;
    $("tz-offset").textContent = gmt(zone);
    draw();
  }

  function setWhen(d, isLive = false) {
    if (isNaN(d)) return;
    when = d; live = isLive;
    const q = new URLSearchParams(location.search);
    if (live) q.delete("d"); else q.set("d", localInput(d));
    if (zone === home) q.delete("tz"); else q.set("tz", zone);
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
    draw();
  }

  $("when").addEventListener("change", (e) => { if (e.target.value) setWhen(fromWall(e.target.value)); });
  // Changing the zone keeps the same instant; the clock on screen moves to the new place
  $("tz").addEventListener("change", (e) => { zone = e.target.value; $("tz-offset").textContent = gmt(zone); setWhen(when, live); });
  $("now").addEventListener("click", () => setWhen(new Date(), true));
  $("prev").addEventListener("click", () => setWhen(new Date(when.getTime() - 86400000)));
  $("next").addEventListener("click", () => setWhen(new Date(when.getTime() + 86400000)));
  // Cards or table: remembered on this device
  let view = "cards"; try { view = localStorage.getItem("view") === "table" ? "table" : "cards"; } catch (_) {}
  function setView(v) {
    view = v;
    $("planet-cards").hidden = v !== "cards"; $("planet-table").hidden = v !== "table";
    $("view-cards").setAttribute("aria-pressed", String(v === "cards")); $("view-table").setAttribute("aria-pressed", String(v === "table"));
    try { localStorage.setItem("view", v); } catch (_) {}
  }
  $("view-cards").addEventListener("click", () => setView("cards"));
  $("view-table").addEventListener("click", () => setView("table"));
  setView(view);

  $("lang").addEventListener("click", () => {
    lang = lang === "pt" ? "en" : "pt";
    try { localStorage.setItem("lang", lang); } catch (_) {}
    fill();
  });
  // "Now" stays now: redraw every minute while the page is showing the present
  setInterval(() => { if (live && !document.hidden) { when = new Date(); draw(); } }, 60000);

  fill();
})();
