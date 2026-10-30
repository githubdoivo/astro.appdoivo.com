# astro.appdoivo.com

[![CI](https://github.com/githubdoivo/astro/actions/workflows/ci.yml/badge.svg)](https://github.com/githubdoivo/astro/actions/workflows/ci.yml)

**Astro**: where the planets are right now, or at any date, time and time zone.
Signs and degrees, retrogrades (Mercury at the top), when each planet entered and
leaves its sign, a zodiac wheel with aspects, the element and modality balance,
the Moon's phase and what changes in the next 45 days. English and Portuguese.

Everything is calculated in the browser with [Astronomy Engine](https://github.com/cosinekitty/astronomy)
(MIT, `vendor/astronomy.min.js`): tropical zodiac, geocentric, true ecliptic of date.
No server, so hosting is free (GitHub Pages).

Where it is going (accounts, natal charts, notifications, friends): [ROADMAP.md](ROADMAP.md).

## Files

| File | What it is |
| --- | --- |
| `sky.js` | The sums: positions, speed (retrograde), sign entry/exit, retrograde periods, aspects, Moon, upcoming events. No page code. |
| `app.js` | The page: date, time zone, language, drawing the wheel and lists. |
| `words.js` | Every word in both languages. |
| `astro.css` | The look: a simple first version, to be replaced by the real design. |
| `index.html` | The sections. |

Links can carry the moment: `?d=2026-10-29T12:00&tz=America/Sao_Paulo&lang=pt`.

## Rules

- EN labels in Title Case; PT in sentence case, impersonal, European Portuguese
  (Carneiro, Balança, Vénus, Neptuno, Úrano).
- Tap targets 44px or more; no sideways scroll; light and dark follow the device.
- Bump the `?v=` stamps on every CSS/JS change.

`npm test` runs the Playwright tests (desktop + phone), including checks against known dates.
