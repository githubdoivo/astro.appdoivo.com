// Builds people/ for the Look-Alikes page:
//  - people/sun-0.json … sun-11.json: well-known people (Wikidata, CC0) by Sun sign, with their Moon sign
//    worked out from the birth date (two signs when the Moon changed sign that day). No birth time needed.
//  - people/timed.json: people whose birth time is widely published (tools/timed.json), with Sun, Moon
//    and Rising worked out here. Kept only when the date matches Wikidata and the Rising matches the one
//    usually quoted, two separate checks.
// Run: node tools/build-people.mjs   (asks qlever.dev, a fast public Wikidata mirror)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.Astronomy = require("astronomy-engine");
globalThis.window = globalThis;
require("../sky.js");
const Sky = globalThis.Sky;
const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const sign = (body, t) => Math.floor(Sky.lon(body, new Date(t)) / 30);

const PREFIX = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;
const people = (filter) => `${PREFIX}SELECT ?p ?links ?dob ?en ?mul ?pt ?coord ?den ?dpt WHERE {
  ?p wdt:P31 wd:Q5 . ?p wikibase:sitelinks ?links . ${filter}
  ?p p:P569/psv:P569 ?v . ?v wikibase:timeValue ?dob ; wikibase:timePrecision ?prec . FILTER(?prec = 11)
  FILTER(?dob >= "1850-01-01T00:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>)
  OPTIONAL { ?p rdfs:label ?en FILTER(lang(?en)="en") }
  OPTIONAL { ?p rdfs:label ?mul FILTER(lang(?mul)="mul") }
  OPTIONAL { ?p rdfs:label ?pt FILTER(lang(?pt)="pt") }
  OPTIONAL { ?p wdt:P19/wdt:P625 ?coord }
  OPTIONAL { ?p schema:description ?den FILTER(lang(?den)="en") }
  OPTIONAL { ?p schema:description ?dpt FILTER(lang(?dpt)="pt") }
}`;
// Nobody wants to hear they match a mass murderer: anyone convicted of murder, genocide, war crimes or
// crimes against humanity, and the dictators below, are left out
const crimes = `${PREFIX}SELECT DISTINCT ?p WHERE { ?p wdt:P1399 ?c . VALUES ?c { wd:Q132821 wd:Q41397 wd:Q135010 wd:Q173099 wd:Q1366217 } }`;
const DICTATORS = new Set(["Adolf Hitler", "Joseph Stalin", "Benito Mussolini", "Mao Zedong", "Pol Pot", "Saddam Hussein", "Osama bin Laden",
  "Heinrich Himmler", "Joseph Goebbels", "Hermann Göring", "Adolf Eichmann", "Josef Mengele", "Reinhard Heydrich", "Rudolf Hess", "Francisco Franco",
  "Augusto Pinochet", "Idi Amin", "Kim Il Sung", "Kim Jong Il", "Kim Jong Un", "Muammar Gaddafi", "Nicolae Ceaușescu", "Robert Mugabe",
  "Bashar al-Assad", "Hafez al-Assad", "Lavrentiy Beria", "Enver Hoxha", "António de Oliveira Salazar", "Jean-Bédel Bokassa", "Mobutu Sese Seko",
  "François Duvalier", "Rafael Trujillo", "Fulgencio Batista", "Ferdinand Marcos", "Slobodan Milošević", "Radovan Karadžić", "Ratko Mladić",
  "Charles Manson", "Ted Bundy", "Jeffrey Dahmer", "Anders Behring Breivik", "Timothy McVeigh", "Lee Harvey Oswald", "Pablo Escobar",
  "Ruhollah Khomeini", "Ali Khamenei", "Alfredo Stroessner", "Jorge Rafael Videla", "Leopoldo Galtieri", "Emílio Garrastazu Médici", "Saif al-Islam al-Gaddafi", "Klara Hitler", "Eva Braun", "Magda Goebbels"]);

async function ask(q) {
  const url = "https://qlever.dev/api/wikidata?query=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error(`qlever ${r.status}`);
  return (await r.json()).results.bindings;
}
const val = (b, k) => (b[k] ? b[k].value : "");
const qid = (b) => val(b, "p").split("/").pop();

const [all, lusa, bad] = await Promise.all([
  ask(people("FILTER(?links >= 50)")),
  ask(people("FILTER(?links >= 20) ?p wdt:P27 ?c . VALUES ?c { wd:Q45 wd:Q155 }")),           // Portugal, Brazil
  ask(crimes),
]);
const skip = new Set(bad.map(qid));
const byQ = new Map();
for (const b of [...all, ...lusa]) {
  const q = qid(b); if (skip.has(q)) continue;
  // Many names now sit in Wikidata's shared "mul" label instead of an English one
  const en = val(b, "en") || val(b, "mul"); if (!en || DICTATORS.has(en) || DICTATORS.has(val(b, "mul"))) continue;
  const o = byQ.get(q) || { q, links: 0, dob: val(b, "dob").slice(0, 10), en, pt: val(b, "pt") || en, den: val(b, "den"), dpt: val(b, "dpt"), lon: null };
  o.links = Math.max(o.links, +val(b, "links"));
  const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(val(b, "coord")); if (m && o.lon == null) o.lon = +m[1];
  if (o.dob > val(b, "dob").slice(0, 10)) o.dob = val(b, "dob").slice(0, 10);   // two dates on record: the earlier one
  byQ.set(q, o);
}
console.log(`${byQ.size} people`);

// Sun and Moon over the local day of birth (the whole UTC day ±12 h when the birthplace is unknown)
const short = (s, n = 60) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const files = Array.from({ length: 12 }, () => []);
for (const o of byQ.values()) {
  const day = Date.parse(o.dob + "T00:00:00Z");
  if (isNaN(day)) continue;
  const [a, b] = o.lon == null ? [day - 12 * 3600e3, day + 36 * 3600e3] : [day - (o.lon / 15) * 3600e3, day - (o.lon / 15) * 3600e3 + 24 * 3600e3 - 1];
  const s1 = sign("Sun", a), s2 = sign("Sun", b), m1 = sign("Moon", a), m2 = sign("Moon", b);
  const row = [+o.q.slice(1), o.en, o.pt === o.en ? "" : o.pt, short(o.den), short(o.dpt), m1, m2 === m1 ? -1 : m2, o.links, s1 === s2 ? 0 : 1];
  files[s1].push(row); if (s2 !== s1) files[s2].push(row);
}
mkdirSync(new URL("../people/", import.meta.url), { recursive: true });
files.forEach((list, i) => {
  list.sort((x, y) => y[7] - x[7]);
  writeFileSync(new URL(`../people/sun-${i}.json`, import.meta.url), JSON.stringify(list));
});
console.log("by Sun sign:", files.map((f) => f.length).join(" "));

// The timed list: exact Sun, Moon and Rising
const src = JSON.parse(readFileSync(new URL("./timed.json", import.meta.url)));
// Found by birth date and surname, so "Donald J. Trump" or "Meghan Markle" still match
const plain = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const find = (name, date) => {
  const last = plain(name.replace(/,.*$/, "").replace(/ (Jr\.|II|III)$/, "").split(" ").pop());
  return [...byQ.values()].filter((o) => o.dob === date && plain(o.en).includes(last)).sort((a, b) => b.links - a.links)[0];
};
const timed = [], rejected = [];
for (const [name, local, off, lat, lon, quoted] of src.people) {
  const t = Date.parse(local + ":00Z") - off * 3600e3, o = find(name, local.slice(0, 10));
  const asc = Math.floor(Sky.ascendant(new Date(t), lat, lon) / 30);
  if (!o) { rejected.push(`${name}: no one by that name born on ${local.slice(0, 10)} on Wikidata`); continue; }
  if (SIGNS[asc] !== quoted) { rejected.push(`${name}: Rising works out ${SIGNS[asc]}, quoted ${quoted}`); continue; }
  timed.push([+o.q.slice(1), o.en, o.pt === o.en ? "" : o.pt, short(o.den), short(o.dpt), sign("Sun", t), sign("Moon", t), asc, o.links]);
}
timed.sort((x, y) => y[8] - x[8]);
writeFileSync(new URL("../people/timed.json", import.meta.url), JSON.stringify(timed));
console.log(`timed: ${timed.length} kept, ${rejected.length} left out`);
for (const r of rejected) console.log("  ✗ " + r);
