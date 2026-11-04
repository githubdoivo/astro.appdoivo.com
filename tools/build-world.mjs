// Builds places/world.json for the Places page from Natural Earth (via world-atlas, public domain):
//  - shapes: each country drawn on a plain longitude/latitude map (x = lon + 180, y = 90 - lat), from the 1:110m set
//  - points: spots inside each country (a 2° grid, at least one), from the finer 1:50m set, so small
//    countries count too; the page measures how close a country comes to each planet line from these
// Run: node tools/build-world.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoPath, geoEquirectangular, geoContains, geoCentroid, geoArea } from "d3-geo";
import countries from "i18n-iso-countries";

const load = (f) => JSON.parse(readFileSync(new URL(`../node_modules/world-atlas/${f}`, import.meta.url)));
const EXTRA = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };   // no ISO number in the set; drawn as part of their neighbour
const code = (f) => (f.id && countries.numericToAlpha2(f.id)) || EXTRA[f.properties.name] || null;
// Places nobody lives (Antarctica, Heard Island, Bouvet, South Georgia, French Southern Lands, US minor islands, Chagos)
const EMPTY = new Set(["AQ", "HM", "BV", "GS", "TF", "UM", "IO"]);
const keep = (f) => code(f) && !EMPTY.has(code(f));

// Plain map, 1 unit = 1 degree
const path = geoPath(geoEquirectangular().scale(180 / Math.PI).translate([180, 90]).precision(0.1)).digits(1);
const shapes = {};
for (const f of feature(load("countries-110m.json"), load("countries-110m.json").objects.countries).features.filter(keep)) {
  const c = code(f); shapes[c] = (shapes[c] || "") + path(f);
}

const points = {};
const r1 = (x) => Math.round(x * 10) / 10;
for (const f of feature(load("countries-50m.json"), load("countries-50m.json").objects.countries).features.filter(keep)) {
  const c = code(f), [[w, s], [e, n]] = geoPath().bounds(f), list = points[c] || (points[c] = []);
  const step = 2;
  if (e - w < 300) {                                   // a shape that does not wrap around the date line
    for (let lat = Math.ceil(s / step) * step; lat <= n; lat += step)
      for (let lon = Math.ceil(w / step) * step; lon <= e; lon += step)
        if (geoContains(f, [lon, lat])) list.push([lat, lon]);
  } else {                                             // Russia, Fiji, the US: walk the whole width
    for (let lat = Math.ceil(s / step) * step; lat <= n; lat += step)
      for (let lon = -180; lon < 180; lon += step) if (geoContains(f, [lon, lat])) list.push([lat, lon]);
  }
  // Each separate piece of land big or small gets its centre, so islands and small countries are never empty
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) {
    const g = { type: "Polygon", coordinates: p };
    if (geoArea(g) > 1e-6 || polys.length < 4) { const [lon, lat] = geoCentroid(g); list.push([r1(lat), r1(lon)]); }
  }
}
for (const c of Object.keys(points)) points[c] = [...new Map(points[c].map((p) => [p.join(), p])).values()];

const out = { note: "Made with Natural Earth (public domain) via world-atlas. Built by tools/build-world.mjs.", shapes, points };
writeFileSync(new URL("../places/world.json", import.meta.url), JSON.stringify(out));
const n = Object.values(points).reduce((a, p) => a + p.length, 0);
console.log(`${Object.keys(shapes).length} shapes, ${Object.keys(points).length} countries, ${n} points, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
