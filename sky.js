// The sky at any moment, from Astronomy Engine (vendor/astronomy.min.js).
// Tropical zodiac, geocentric, true ecliptic of date - the same frame
// astrologers use. No page code here: app.js draws, this file only counts.
(function (root) {
  const A = root.Astronomy;
  const DAY = 86400000;
  const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  // How far to step when looking for a sign change: about a tenth of the
  // shortest time each body can spend in one sign.
  const STEP = { Moon: 0.08, Sun: 1, Mercury: 0.5, Venus: 0.5, Mars: 1, Jupiter: 2, Saturn: 3, Uranus: 5, Neptune: 5, Pluto: 5 };
  const ELEMENT = ["fire", "earth", "air", "water"];          // Aries fire, Taurus earth, …
  const MODALITY = ["cardinal", "fixed", "mutable"];          // Aries cardinal, Taurus fixed, …
  const ASPECTS = [
    { key: "conjunction", angle: 0, orb: 8 },
    { key: "sextile", angle: 60, orb: 4 },
    { key: "square", angle: 90, orb: 7 },
    { key: "trine", angle: 120, orb: 7 },
    { key: "opposition", angle: 180, orb: 8 },
  ];

  const norm = (x) => ((x % 360) + 360) % 360;
  const at = (ms) => new Date(ms);

  // Ecliptic longitude, 0-360 from 0° Aries
  function lon(body, date) {
    if (body === "Moon") return norm(A.EclipticGeoMoon(date).lon);
    if (body === "Sun") return norm(A.SunPosition(date).elon);
    return norm(A.Ecliptic(A.GeoVector(A.Body[body], date, true)).elon);
  }
  // Degrees per day; negative = retrograde
  function speed(body, date) {
    const t = date.getTime(), h = body === "Moon" ? 0.05 : 0.5;
    let d = lon(body, at(t + h * DAY)) - lon(body, at(t - h * DAY));
    if (d > 180) d -= 360; if (d < -180) d += 360;
    return d / (2 * h);
  }
  const signOf = (l) => Math.floor(norm(l) / 30);

  // Walk from t (ms) in direction dir until the body leaves sign s; then
  // halve the step down to a minute. Gives up after `limit` days (null).
  function edge(body, t, s, dir, limit = 40 * 366) {
    const step = STEP[body] * DAY * dir;
    let a = t, b = t + step, n = 0;
    while (signOf(lon(body, at(b))) === s) {
      a = b; b += step;
      if (++n * STEP[body] > limit) return null;
    }
    while (Math.abs(b - a) > 60000) {
      const m = (a + b) / 2;
      if (signOf(lon(body, at(m))) === s) a = m; else b = m;
    }
    return dir > 0 ? b : a;
  }

  function planet(body, date) {
    const l = lon(body, date), s = signOf(l), v = speed(body, date);
    const t = date.getTime();
    return {
      body, lon: l, sign: s, deg: l - s * 30, speed: v, retro: v < 0,
      element: ELEMENT[s % 4], modality: MODALITY[s % 3],
      since: edge(body, t, s, -1), until: edge(body, t, s, +1),
    };
  }

  function aspects(ps) {
    const out = [];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      let d = Math.abs(ps[i].lon - ps[j].lon); if (d > 180) d = 360 - d;
      for (const a of ASPECTS) {
        const off = Math.abs(d - a.angle);
        if (off <= a.orb) {
          // Applying when the gap to the exact angle is shrinking
          const later = (p) => p.lon + p.speed * 0.1;
          let d2 = Math.abs(later(ps[i]) - later(ps[j])); d2 = norm(d2); if (d2 > 180) d2 = 360 - d2;
          out.push({ a: ps[i].body, b: ps[j].body, key: a.key, angle: a.angle, orb: off, applying: Math.abs(d2 - a.angle) < off });
        }
      }
    }
    return out.sort((x, y) => x.orb - y.orb);
  }

  function moon(date) {
    const angle = A.MoonPhase(date);                        // 0 new, 90 first quarter, 180 full, 270 last quarter
    const lit = A.Illumination(A.Body.Moon, date).phase_fraction;
    const phase = Math.floor(norm(angle + 22.5) / 45);     // 0..7: new, waxing crescent, first quarter, …
    const next = [];
    let q = A.SearchMoonQuarter(date);
    for (let i = 0; i < 4; i++) { next.push({ quarter: q.quarter, time: q.time.date.getTime() }); q = A.NextMoonQuarter(q); }
    return { angle, lit, phase, next };
  }

  // Sign changes and stations (turning retrograde or direct) from date for `days`
  function upcoming(date, days = 45) {
    const out = [], t0 = date.getTime();
    for (const body of BODIES) {
      if (body === "Moon") continue;                        // the Moon changes sign every 2-3 days; shown on its own
      let t = t0, s = signOf(lon(body, date));
      while (true) {
        const e = edge(body, t, s, +1, days);
        if (e === null || e > t0 + days * DAY) break;
        const ns = signOf(lon(body, at(e + 60000)));
        out.push({ type: "ingress", body, time: e, sign: ns, retro: speed(body, at(e)) < 0 });
        t = e + 60000; s = ns;
      }
      if (body === "Sun") continue;                         // the Sun and Moon never turn back
      let prev = speed(body, date) < 0;
      for (let d = 1; d <= days; d++) {
        const r = speed(body, at(t0 + d * DAY)) < 0;
        if (r !== prev) {
          let a = t0 + (d - 1) * DAY, b = t0 + d * DAY;    // halve to the hour
          while (b - a > 3600000) { const m = (a + b) / 2; if ((speed(body, at(m)) < 0) === prev) a = m; else b = m; }
          out.push({ type: r ? "retro" : "direct", body, time: b, sign: signOf(lon(body, at(b))) });
          prev = r;
        }
      }
    }
    return out.sort((x, y) => x.time - y.time);
  }

  // When the speed changes sign, walking from t in direction dir (to the hour)
  function station(body, t, dir, limit = 800) {
    const was = speed(body, at(t)) < 0;
    for (let d = 1; d <= limit; d++) {
      const u = t + dir * d * DAY;
      if ((speed(body, at(u)) < 0) !== was) {
        let a = u - dir * DAY, b = u;
        while (Math.abs(b - a) > 3600000) { const m = (a + b) / 2; if ((speed(body, at(m)) < 0) === was) a = m; else b = m; }
        return b;
      }
    }
    return null;
  }
  // The retrograde period the body is in now, or else its next one:
  // { now, start, end, from (sign at start), to (sign at end) }
  function retrograde(body, date) {
    if (body === "Sun" || body === "Moon") return null;
    const t = date.getTime();
    let start, end;
    if (speed(body, date) < 0) { start = station(body, t, -1); end = station(body, t, +1); }
    else { start = station(body, t, +1); end = start && station(body, start + 3600000, +1); }
    if (!start || !end) return null;
    return { body, now: speed(body, date) < 0, start, end, from: signOf(lon(body, at(start))), to: signOf(lon(body, at(end))) };
  }

  function sky(date) {
    const ps = BODIES.map((b) => planet(b, date));
    const count = (k, keys) => Object.fromEntries(keys.map((x) => [x, ps.filter((p) => p[k] === x).map((p) => p.body)]));
    return {
      date: date.getTime(), planets: ps, aspects: aspects(ps), moon: moon(date),
      retrogrades: BODIES.map((b) => retrograde(b, date)).filter(Boolean),
      elements: count("element", ELEMENT), modalities: count("modality", MODALITY),
    };
  }

  root.Sky = { BODIES, ELEMENT, MODALITY, ASPECTS, sky, upcoming, retrograde, lon, speed };
})(typeof window !== "undefined" ? window : globalThis);
