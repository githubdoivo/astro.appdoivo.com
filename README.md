# astro.appdoivo.com

[![CI](https://github.com/githubdoivo/astro.appdoivo.com/actions/workflows/ci.yml/badge.svg)](https://github.com/githubdoivo/astro.appdoivo.com/actions/workflows/ci.yml)

**Astro**: where the planets are, now or at any date, time and time zone. Calm and easy
to read for people who don't know astrology: the landing page is almost only a table
(inspired by ponteiro.com.br/transitos.php); everything else lives on its own quiet page.

| Page | What it shows |
| --- | --- |
| `/` Sky | The table: each planet's sign (and degree), since when, until when, time in sign, **R** for retrograde. One line for Mercury retrograde and one for what changes next. |
| `/planets/` | Each planet in plain words: what it stands for and what its sign brings. |
| `/retrogrades/` | Mercury retrograde first (period, signs, days left), then every planet's current or next retrograde. |
| `/moon/` | Phase, how lit, the next four phases, the Moon's sign and when it changes. |
| `/chart/` | The zodiac wheel with aspect lines, the element and modality balance, the aspects. |
| `/calendar/` | The next 90 days: sign changes, stations, new and full moons, month by month. |

The date, time and place sit in one quiet line on every page; **Change** opens the
controls. The menu carries the chosen moment from page to page, and links can share it:
`/retrogrades/?d=2026-10-29T12:00&tz=America/Sao_Paulo`. English and Portuguese; light
and dark follow the device.

Everything is calculated in the browser with [Astronomy Engine](https://github.com/cosinekitty/astronomy)
(MIT, `vendor/astronomy.min.js`): tropical zodiac, geocentric, true ecliptic of date.
No server, so hosting is free (GitHub Pages). Where it is going: [ROADMAP.md](ROADMAP.md).

## Files

| File | What it is |
| --- | --- |
| `sky.js` | The sums: positions, retrograde, sign entry/exit, retrograde periods, aspects, Moon, calendar. No page code. |
| `app.js` | The shell (header, menu, the moment line, footer) and one small renderer per page section. A page only renders the sections it has. |
| `words.js` | Every word in both languages (the tests check both have the same keys). |
| `astro.css` | The look: a calm first version, to be replaced by the real design. |
| `index.html`, `*/index.html` | The pages: each is a `data-page` plus the sections it shows. `404.html` for lost links. |

**Adding a page:** copy one of the `*/index.html` files, change `data-page` and the
sections, add it to `PAGES` in `app.js` and to `nav` and `pageTitle` in both languages
in `words.js`.

## Rules

- EN labels in Title Case; PT in sentence case, impersonal, European Portuguese
  (Carneiro, Balança, Vénus, Neptuno, Úrano).
- Tap targets 44px or more; no sideways scroll; contrast AA in light and dark (tested).
- Bump the `?v=` stamps on every CSS/JS change.

`npm test` runs the Playwright tests (desktop + phone), including checks against known dates.
