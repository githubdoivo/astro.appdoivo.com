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
  // Dates written the way each language writes them by hand: "29 Oct 2026", "29 out 2026"
  // (pt-PT's own short format is numeric, "29/10/2026", which reads like a form).
  const MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"], pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] };
  const parts = (t) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const dm = (t) => { const p = parts(t); return `${+p.day} ${MON[lang][p.month - 1]}`; };
  const fmtDay = (t) => `${dm(t)} ${parts(t).year}`;
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
  const CITY_PT = { Lisbon: "Lisboa", Madeira: "Madeira", Azores: "Açores", Sao_Paulo: "São Paulo", London: "Londres", Paris: "Paris", Madrid: "Madrid", Berlin: "Berlim",
    Rome: "Roma", Brussels: "Bruxelas", Amsterdam: "Amesterdão", Zurich: "Zurique", Geneva: "Genebra", New_York: "Nova Iorque", Los_Angeles: "Los Angeles", Luanda: "Luanda", Maputo: "Maputo", Cape_Verde: "Cabo Verde", Tokyo: "Tóquio" };
  const city = (z) => { const c = z.split("/").at(-1); return (lang === "pt" && CITY_PT[c]) || c.replace(/_/g, " "); };
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

  const short = (t) => dm(t);
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
    const done = r.now ? Math.min(100, ((when.getTime() - r.start) / (r.end - r.start)) * 100) : 0;
    return `<span class="merc-planet" aria-hidden="true"></span>
      <p class="merc-title"><span class="glyph">${g(GLYPH.Mercury)}</span>${esc(r.now ? w.mercNow : w.mercNext)}</p>
      <p class="merc-dates"><time>${esc(fmtDay(r.start))}</time> – <time>${esc(fmtDay(r.end))}</time></p>
      <p class="meta">${signs} · ${count}</p>
      ${r.now ? `<p class="merc-track" aria-hidden="true"><span style="width:${done}%"></span></p>` : ""}`;
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


  // The landing table: one row per planet, like an almanac
  const when2 = (p, t) => (t == null ? "—" : p.body === "Moon" ? `${short(t)}, ${fmtTime(t)}` : shortOrYear(t));
  // The same, as table HTML: the Moon's hour in its own span, so phones can put it on a second line
  const whenCell = (p, t) => (t != null && p.body === "Moon" ? `${esc(short(t))}<span class="tm"><span class="cm">, </span>${esc(fmtTime(t))}</span>` : esc(when2(p, t)));
  function skyTable(sky) {
    return sky.planets.map((p) => `<tr${p.retro ? ' class="is-retro"' : ""}>
      <th scope="row"><span class="nw"><span class="glyph">${g(GLYPH[p.body])}</span>${esc(w.bodies[p.body])}${p.retro ? `<abbr class="retro" title="${esc(w.retro)}">${w.retroShort}</abbr>` : ""}</span></th>
      <td><span class="nw"><span class="glyph">${g(SIGN[p.sign])}</span>${esc(w.signs[p.sign])}</span> <span class="deg">${deg(p.deg)}</span></td>
      <td class="num c-since">${whenCell(p, p.since)}</td>
      <td class="num c-until">${whenCell(p, p.until)}<small class="ph">${esc(w.since)} ${esc(when2(p, p.since))}</small></td>
      <td class="num c-stay">${esc(span(p.since, p.until))}</td></tr>`).join("");
  }
  function eventText(e) {
    const who = `<span class="nw"><span class="glyph">${g(GLYPH[e.body])}</span>${esc(w.bodies[e.body])}</span>`;
    const sign = `<span class="nw"><span class="glyph">${g(SIGN[e.sign])}</span>${esc(w.signs[e.sign])}</span>`;
    if (e.type === "phase") return `<span class="nw"><span class="glyph">${g(GLYPH.Moon)}</span>${esc(w.quarters[e.quarter])}</span> ${esc(w.phaseOn)} ${sign}`;
    if (e.type === "ingress") return `${who} ${esc(w.enters)} ${sign}${e.retro ? ` <span class="muted">(${esc(w.whileRetro)})</span>` : ""}`;
    return `${who} ${esc(e.type === "retro" ? w.turnsRetro : w.turnsDirect)} ${sign}`;
  }
  function skyNotes(sky) {
    const out = [];
    const merc = sky.retrogrades.find((r) => r.body === "Mercury");
    if (merc && merc.now) out.push(`<p class="note is-merc"><span class="glyph">${g(GLYPH.Mercury)}</span>${esc(w.mercLine.replace("{d}", fmtDay(merc.end)))} <a href="${link("retrogrades")}">${esc(w.aboutRetro)}</a></p>`);
    else if (merc && merc.start - when.getTime() < 21 * 86400000) out.push(`<p class="note"><span class="glyph">${g(GLYPH.Mercury)}</span>${esc(w.mercSoon.replace("{d}", fmtDay(merc.start)))} <a href="${link("retrogrades")}">${esc(w.aboutRetro)}</a></p>`);
    const next = Sky.upcoming(when, 45)[0];
    if (next) out.push(`<p class="note"><span class="lead">${esc(w.nextIs)}</span> <time class="nw">${esc(fmtDay(next.time))}</time> · ${eventText(next)} <a href="${link("calendar")}">${esc(w.nav.calendar)}</a></p>`);
    return out.join("");
  }
  function calendarList(events) {
    if (!events.length) return `<p class="muted">${esc(w.nothing)}</p>`;
    let html = "", month = "";
    for (const e of events) {
      const m = new Date(e.time).toLocaleDateString(loc(), { timeZone: zone, month: "long", year: "numeric" });
      if (m !== month) { html += `${month ? "</ol>" : ""}<h2 class="month">${esc(m)}</h2><ol class="coming">`; month = m; }
      const day = new Date(e.time).toLocaleDateString(loc(), { timeZone: zone, weekday: "short", day: "numeric" });
      html += `<li class="ev-${e.type}"><time>${esc(day)}, ${esc(fmtTime(e.time))}</time><span>${eventText(e)}</span></li>`;
    }
    return html + "</ol>";
  }
  function moonSign(sky) {
    const m = sky.planets.find((p) => p.body === "Moon");
    const nextSign = (m.sign + 1) % 12;
    return `<p class="moon-sign"><span class="glyph">${g(SIGN[m.sign])}</span>${esc(w.moonIn.replace("{s}", w.signs[m.sign]))}</p>
      <p class="muted">${esc(w.moonUntil.replace("{d}", `${short(m.until)}, ${fmtTime(m.until)}`).replace("{s}", w.signs[nextSign]))}</p>`;
  }

  // ---- returns: when each planet comes back to its place at birth ----
  const YEAR = 365.2425 * 86400000;
  const inZone = (z, f) => { const o = zone; zone = z; try { return f(); } finally { zone = o; } };
  // The birth: from the link (?born=1990-01-01T08:30&btz=Europe/Lisbon), else saved on this device
  function readBorn() {
    const q = new URLSearchParams(location.search);
    if (q.get("born")) return { d: q.get("born"), tz: zones.includes(q.get("btz")) ? q.get("btz") : home };
    try { const b = JSON.parse(localStorage.getItem("born")); if (b && b.d) return b; } catch (_) {}
    return null;
  }
  let born = readBorn(), bornCache = null;
  function returnsData() {
    const t = inZone(born.tz, () => fromWall(born.d).getTime());
    const key = `${t}|${Math.floor(when.getTime() / 86400000)}`;
    if (bornCache && bornCache.key === key) return bornCache.data;
    const now = when.getTime(), data = {};
    for (const b of Sky.BODIES) {
      const P = Sky.PERIOD[b] * 86400000, l = Sky.lon(b, new Date(t));
      // Saturn and Uranus: every return in a long life; the rest: the one before now and the one after
      const lifelong = b === "Saturn" || b === "Uranus";
      const list = P > 100 * YEAR ? [] : lifelong ? Sky.returns(b, t, t, t + 92 * YEAR) : Sky.returns(b, t, Math.max(t, now - 1.2 * P), now + 1.2 * P);
      data[b] = { lon: l, sign: Math.floor(l / 30), deg: l % 30, list };
    }
    bornCache = { key, data: { t, data } };
    return bornCache.data;
  }
  // "in 21 years 5 months": the two largest units are enough this far ahead
  const rough = (a, b) => span(a, b).split(" ").slice(0, 4).join(" ");
  const ago = (x) => (x > when.getTime() ? w.inT.replace("{t}", rough(when.getTime(), x)) : w.wasPast);
  const ageAt = (t0, x) => w.ageN.replace("{n}", Math.floor((x - t0) / YEAR));
  function passLine(r) {
    if (r.passes.length === 1) return `<time>${esc(fmtDay(r.start))}</time>`;
    return `<time>${esc(fmtDay(r.start))}</time> – <time>${esc(fmtDay(r.end))}</time>`;
  }
  function returnsOut() {
    if (!born) return `<p class="muted ret-empty">${esc(w.retEmpty)}</p>`;
    const { t, data } = returnsData(), now = when.getTime();
    const pos = (b) => `<span class="glyph">${g(SIGN[data[b].sign])}</span>${esc(w.signs[data[b].sign])} <span class="num">${deg(data[b].deg)}</span>`;
    // Saturn first, in its own card: every return in a lifetime, with the age
    const sat = data.Saturn.list.map((r, i) => {
      const nowIn = now >= r.start - 30 * 86400000 && now <= r.end + 30 * 86400000;
      const state = nowIn ? w.happening : ago(r.start);
      const passes = r.passes.length > 1 ? `<small>${esc(w.passesN.replace("{n}", r.passes.length))}: ${r.passes.map((x) => esc(dm(x))).join(" · ")}</small>` : "";
      return `<li class="${nowIn ? "is-now" : r.start < now ? "is-past" : ""}"><span class="nth">${esc(w.nth[i] || "")}</span>
        <span class="when">${passLine(r)}${passes}</span><span class="age">${esc(ageAt(t, r.start))}</span><span class="state">${esc(state)}</span></li>`;
    }).join("");
    const card = `<div class="merc ret-sat"><span class="merc-planet" aria-hidden="true"></span>
      <h2 class="merc-title">${esc(w.satReturn)}</h2>
      <p class="merc-dates">${esc(w.atBirth.replace("{b}", w.bodies.Saturn))}: ${pos("Saturn")}</p>
      <ol class="sat-list">${sat}</ol></div>`;
    // Every planet: where it was, the last return and the next one
    const rows = Sky.BODIES.filter((b) => b !== "Saturn").map((b) => {
      const list = data[b].list, before = list.filter((r) => r.start <= now).pop(), after = list.find((r) => r.start > now);
      const years = Sky.PERIOD[b] / 365.25;
      const cell = (r, label) => `<span class="rcell"><span class="rlabel">${esc(label)}</span>${r ? `${passLine(r)} <span class="muted">· ${esc(ageAt(t, r.start))}</span>` : `<span class="muted">${esc(w.noReturnYet)}</span>`}</span>`;
      const body = years > 100
        ? `<span class="rnever muted">${esc(w.neverR.replace("{n}", Math.round(years / 5) * 5))}</span>`
        : `${cell(before, w.lastR)}${cell(after, w.nextR)}${after ? `<span class="rin">${esc(ago(after.start))}</span>` : ""}`;
      return `<li><span class="who"><span class="glyph">${g(GLYPH[b])}</span>${esc(w.bodies[b])}</span><span class="where">${pos(b)}</span>${body}</li>`;
    }).join("");
    return `${card}<h2>${esc(w.everyPlanet)}</h2><ul class="rets">${rows}</ul>`;
  }
  function bornForm() {
    const f = $("born"); if (!f || f.dataset.ready) return;
    f.dataset.ready = "1";
    const sel = $("born-tz");
    sel.innerHTML = zones.map((z) => `<option value="${esc(z)}">${esc(zoneName(z))}</option>`).join("");
    sel.value = born ? born.tz : home;
    if (born) { const [d, tm] = born.d.split("T"); $("born-date").value = d; $("born-time").value = tm || "12:00"; $("forget").hidden = false; }
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!$("born-date").value) return;
      born = { d: `${$("born-date").value}T${$("born-time").value || "12:00"}`, tz: sel.value };
      try { localStorage.setItem("born", JSON.stringify(born)); } catch (_) {}
      $("forget").hidden = false;
      set("returns-out", returnsOut());
      $("returns-out").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("forget").addEventListener("click", () => {
      born = null; bornCache = null;
      try { localStorage.removeItem("born"); } catch (_) {}
      $("born-date").value = ""; $("born-time").value = "12:00"; $("forget").hidden = true;
      const q = new URLSearchParams(location.search); q.delete("born"); q.delete("btz");
      history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
      set("returns-out", returnsOut());
    });
  }
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };

  // ---- the shell: header, menu, the moment, footer (the same on every page) ----
  const PAGES = [["sky", "/"], ["planets", "/planets/"], ["retrogrades", "/retrogrades/"], ["moon", "/moon/"], ["chart", "/chart/"], ["returns", "/returns/"], ["calendar", "/calendar/"]];
  const page = document.body.dataset.page || "sky";
  const state = () => { const q = new URLSearchParams(); if (!live) q.set("d", localInput(when)); if (zone !== home) q.set("tz", zone); return q.toString(); };
  const link = (key) => { const q = state(); return PAGES.find((p) => p[0] === key)[1] + (q ? "?" + q : ""); };

  function shell() {
    $("top").innerHTML = `<div class="topbar">
        <a class="brand" href="/">Astro</a>
        <span class="tools"><button class="mode" id="mode" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/><g class="i-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg></button><button class="lang" id="lang" type="button"></button></span>
      </div>
      <nav class="nav" id="nav"><ul>${PAGES.map(([k]) => `<li><a data-page="${k}"${k === page ? ' aria-current="page"' : ""}></a></li>`).join("")}</ul></nav>`;
    $("moment").innerHTML = `<p class="moment-line"><span id="moment-text"></span><button type="button" class="change" id="change" aria-expanded="false" aria-controls="controls"></button></p>
      <form class="controls" id="controls" hidden>
        <label class="field"><span data-w="skyOn"></span><input type="datetime-local" id="when" step="60" required></label>
        <label class="field"><span><span data-w="zone"></span> · <span id="tz-offset"></span></span><select id="tz"></select></label>
        <div class="steps">
          <button type="button" id="prev">←</button>
          <button type="button" id="now" data-w="now"></button>
          <button type="button" id="next">→</button>
        </div>
      </form>`;
    $("foot").innerHTML = `<p data-w="about"></p>`;
    // The engraved arc, star, moon and planet over the page title (decoration only)
    const head = document.querySelector(".page-head");
    if (head) head.insertAdjacentHTML("afterbegin", `<div class="orn" aria-hidden="true"><span class="orn-arc"></span><span class="orn-star"></span><span class="orn-moon"></span><span class="orn-planet"></span><span class="orn-s1"></span><span class="orn-s2"></span><span class="orn-s3"></span></div>`);
  }

  function renderPage() {
    const sky = Sky.sky(when);
    set("sky-rows", skyTable(sky));
    set("sky-notes", skyNotes(sky));
    set("planet-cards", planetCards(sky));
    if ($("mercury")) { set("mercury", mercury(sky)); $("mercury").classList.toggle("is-now", sky.retrogrades.some((r) => r.body === "Mercury" && r.now)); }
    set("retro-list", retroList(sky));
    set("moon-card", moonCard(sky.moon));
    set("moon-sign", moonSign(sky));
    set("wheel", wheel(sky));
    set("elements", bars(sky.elements, w.element));
    set("modalities", bars(sky.modalities, w.modality));
    set("aspect-list", aspectList(sky));
    set("calendar-list", calendarList(Sky.calendar(when, 90)));
    bornForm();
    set("returns-out", returnsOut());
  }

  function draw() {
    const full = new Date(when).toLocaleDateString(loc(), { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("moment-text").innerHTML = `${live ? `<b>${esc(w.now)}</b> · ` : ""}<time>${esc(full)}, ${esc(fmtTime(when))}</time> · ${esc(city(zone))}`;
    $("when").value = localInput(when);
    $("now").setAttribute("aria-pressed", String(live));
    document.querySelectorAll("#nav a").forEach((a) => (a.href = link(a.dataset.page)));
    $("brand-link") && ($("brand-link").href = link("sky"));
    renderPage();
  }

  function fill() {
    w = WORDS[lang];
    document.documentElement.lang = w.lang;
    document.title = w.pageTitle[page];
    document.querySelectorAll("[data-w]").forEach((el) => (el.textContent = w[el.dataset.w]));
    document.querySelectorAll("#nav a").forEach((a) => (a.textContent = w.nav[a.dataset.page]));
    document.querySelectorAll("[data-wn]").forEach((el) => (el.textContent = w.nav[el.dataset.wn]));
    $("nav").setAttribute("aria-label", w.navLabel);
    const b = $("lang"); b.textContent = w.other; b.setAttribute("aria-label", `${w.other}: ${w.otherLabel}`);
    paintTheme();
    $("prev").setAttribute("aria-label", w.prevDay); $("next").setAttribute("aria-label", w.nextDay);
    $("change").textContent = $("controls").hidden ? w.change : w.close;
    $("change").setAttribute("aria-label", $("controls").hidden ? w.changeLabel : w.close);
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
    q.delete("lang");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
    draw();
  }

  shell();
  // On phones the menu scrolls sideways: bring the current page into view
  const here = document.querySelector("#nav a[aria-current=page]");
  if (here) $("nav").scrollLeft = Math.max(0, here.offsetLeft - 20);
  $("change").addEventListener("click", () => {
    const c = $("controls"); c.hidden = !c.hidden;
    $("change").setAttribute("aria-expanded", String(!c.hidden));
    $("change").textContent = c.hidden ? w.change : w.close;
    $("change").setAttribute("aria-label", c.hidden ? w.changeLabel : w.close);
    if (!c.hidden) $("when").focus();
  });
  $("when").addEventListener("change", (e) => { if (e.target.value) setWhen(fromWall(e.target.value)); });
  $("tz").addEventListener("change", (e) => { zone = e.target.value; $("tz-offset").textContent = gmt(zone); setWhen(when, live); });
  $("now").addEventListener("click", () => setWhen(new Date(), true));
  $("prev").addEventListener("click", () => setWhen(new Date(when.getTime() - 86400000)));
  $("next").addEventListener("click", () => setWhen(new Date(when.getTime() + 86400000)));
  // Dark or light: the device decides until a choice is made here, then the choice is kept
  const isDark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  function paintTheme() {
    const m = $("mode"), dark = isDark();
    m.setAttribute("aria-label", dark ? w.toLight : w.toDark); m.title = dark ? w.toLight : w.toDark;
    m.classList.toggle("is-dark", dark);
    document.querySelectorAll('meta[name="theme-color"]').forEach((t) => (t.content = dark ? "#0b0a09" : "#f4ede0"));
  }
  $("mode").addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (_) {}
    paintTheme();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintTheme);
  $("lang").addEventListener("click", () => {
    lang = lang === "pt" ? "en" : "pt";
    try { localStorage.setItem("lang", lang); } catch (_) {}
    fill();
  });
  // "Now" stays now: redraw every minute while the page shows the present
  setInterval(() => { if (live && !document.hidden) { when = new Date(); draw(); } }, 60000);
  fill();
})();
