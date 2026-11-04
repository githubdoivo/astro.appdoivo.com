// Astrocartography: where on Earth each planet was rising, setting, overhead or underfoot
// at the moment of birth, and how close each country comes to those lines.
// Geocentric, true equator of date (in mundo), the method of Jim Lewis's maps.
// No page code here: app.js draws, this file only counts.
(function (root) {
  const A = root.Astronomy;
  const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  const ANGLES = ["AS", "DS", "MC", "IC"];         // rising, setting, overhead, underfoot
  const R = Math.PI / 180, KM = 111.2;            // km in one degree of a great circle
  const wrap = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
  const clamp = (x) => Math.max(-1, Math.min(1, x));

  // Each planet's sub-point: where on Earth it stood straight overhead at that instant
  function points(date) {
    const time = A.MakeTime(date), rot = A.Rotation_EQJ_EQD(time), gast = A.SiderealTime(time) * 15;
    return BODIES.map((body) => {
      const eq = A.EquatorFromVector(A.RotateVector(rot, A.GeoVector(A.Body[body], time, true)));
      return { body, lat: eq.dec, lon: wrap(eq.ra * 15 - gast) };
    });
  }

  // The lines, as [lon, lat] runs for drawing (split where they cross the date line)
  function lines(date, maxLat = 80) {
    const out = [];
    for (const p of points(date)) {
      out.push({ body: p.body, angle: "MC", runs: [[[p.lon, maxLat], [p.lon, -maxLat]]] });
      out.push({ body: p.body, angle: "IC", runs: [[[wrap(p.lon + 180), maxLat], [wrap(p.lon + 180), -maxLat]]] });
      const td = Math.tan(p.lat * R);
      for (const [angle, side] of [["AS", -1], ["DS", 1]]) {
        const runs = []; let run = [];
        for (let lat = -maxLat; lat <= maxLat; lat += 0.5) {
          const c = -Math.tan(lat * R) * td;
          if (Math.abs(c) > 1) { if (run.length > 1) runs.push(run); run = []; continue; }
          const lon = wrap(p.lon + side * Math.acos(c) / R);
          if (run.length && Math.abs(lon - run[run.length - 1][0]) > 180) { runs.push(run); run = []; }
          run.push([lon, lat]);
        }
        if (run.length > 1) runs.push(run);
        out.push({ body: p.body, angle, runs });
      }
    }
    return out;
  }

  // Degrees from a place to each of a planet's four lines
  function distances(p, lat, lon) {
    const f = lat * R, H = (lon - p.lon) * R, d = p.lat * R;
    const sinAlt = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H);
    const horizon = Math.abs(Math.asin(clamp(sinAlt))) / R;          // the horizon circle: the gap is the altitude
    const meridian = Math.asin(clamp(Math.abs(Math.cos(f) * Math.sin(H)))) / R;
    const east = Math.sin(H) < 0;                                      // east of the meridian: rising side
    const near = Math.cos(H) > 0;                                      // the overhead half, not the underfoot half
    return { AS: east ? horizon : 90, DS: east ? 90 : horizon, MC: near ? meridian : 90, IC: near ? 90 : meridian };
  }

  // How much each line counts for a theme. Negative: worth knowing, not a place to seek out.
  const THEMES = {
    love: {
      Venus: { DS: 1, AS: 0.8, IC: 0.7, MC: 0.6 }, Moon: { DS: 0.6, IC: 0.6, AS: 0.4 }, Jupiter: { DS: 0.7, AS: 0.5, IC: 0.4, MC: 0.3 },
      Sun: { DS: 0.5, AS: 0.2 }, Saturn: { DS: -0.6, AS: -0.3, IC: -0.3 }, Mars: { DS: -0.3 }, Pluto: { DS: -0.4 }, Neptune: { DS: -0.3 }, Uranus: { DS: -0.3 },
    },
  };

  // Where in the country the best spot lies: "n", "se", "c" (centre)…, from the spread of its spots
  function part(spots, best) {
    if (spots.length < 6) return "";
    const lats = spots.map((p) => p[0]), lons = spots.map((p) => p[1]);
    const lo = (a) => Math.min(...a), hi = (a) => Math.max(...a);
    if (hi(lons) - lo(lons) > 300) return "";                      // wraps the date line: no simple east and west
    const y = (best.lat - lo(lats)) / (hi(lats) - lo(lats) || 1), x = (best.lon - lo(lons)) / (hi(lons) - lo(lons) || 1);
    const ns = y > 0.62 ? "n" : y < 0.38 ? "s" : "", ew = x > 0.62 ? "e" : x < 0.38 ? "w" : "";
    return ns + ew || "c";
  }

  // Every country: its best spot for the theme, and the lines that make it so.
  // orb: how far a line reaches, in degrees (about 780 km at 7)
  function rank(date, world, theme = "love", orb = 7) {
    const ps = points(date), weights = THEMES[theme], out = [];
    for (const [code, all] of Object.entries(world.points)) {
      // Near the poles every line bunches up; count where people live (below 60°) when the country has land there
      const lived = all.filter(([lat]) => Math.abs(lat) <= 60), spots = lived.length ? lived : all;
      let best = null;
      for (const [lat, lon] of spots) {
        let score = 0; const near = [];
        for (const p of ps) {
          const wt = weights[p.body]; if (!wt) continue;
          const ds = distances(p, lat, lon);
          for (const a of ANGLES) {
            if (!wt[a] || ds[a] >= orb) continue;
            const s = (1 - ds[a] / orb) ** 2;
            score += wt[a] * s;
            near.push({ body: p.body, angle: a, km: Math.round((ds[a] * KM) / 10) * 10, weight: wt[a] });
          }
        }
        if (!best || score > best.score) best = { score, lat, lon, near };
      }
      if (best && best.near.length) out.push({ code, ...best, part: part(spots, best), near: best.near.sort((a, b) => a.km - b.km) });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  root.Atlas = { BODIES, ANGLES, THEMES, KM, points, lines, distances, rank };
})(typeof window !== "undefined" ? window : globalThis);
