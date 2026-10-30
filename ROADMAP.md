# Astro: where it is going

Written down 2026-10-30 from Ivo's ideas. Version 1 (now) is only the sky; everything
below is intention, not built yet.

## Now (v1): the sky at any moment
- A calm landing page that is almost only the table (sign, since, until, R), so
  nobody is overwhelmed; the rest on quiet pages: Planets (plain words),
  Retrogrades (Mercury first), Moon, Chart (wheel, balance, aspects), Calendar (90 days).
- Any date and time, any time zone. EN/PT. All calculated in the browser (free to host).
- Inspired by ponteiro.com.br/transitos.php, done better.
- Built to grow: one shared shell (header, menu, moment line) and a renderer per
  section, so new pages (Me, Friends, Daily) slot in without touching the others.

## Asked for (2026-10-30), in this order
1. **Readings per planet in each sign**: Sun in Virgo must not read like Mercury in
   Virgo. 120 short readings (10 planets x 12 signs), EN and PT; drafts for Ivo to edit.
2. **A real calendar**: a month grid you can move through, plus filters such as
   "every Moon in Pisces this year", "every Mercury retrograde", "full moons".
3. **Big three look-alikes**: from a birth date, time and place (the city search gives
   latitude and longitude, so the Ascendant can be worked out), find famous people
   with the same Sun, Moon and Rising. Needs a list of public figures with reliable
   birth times (Rodden rating AA/A); the signs are calculated here, not copied.

## Next
1. ~~Design pass~~: done 2026-10-30, ink and gold, light and dark.
2. **Installable web app (PWA)** with **notifications**: Mercury retrograde starts / ends,
   other stations, new and full moons, sign changes the user picks.
   Needs a small server for web push (scheduled sends); free tiers are enough to start.
3. **Accounts**: sign up, birth date, time and place.
4. **Natal chart**: houses and ascendant (needs place → latitude/longitude), the wheel,
   and written descriptions of each placement.
5. **Daily**: a daily line/quote, and today's transits to the user's own chart.
6. **Social**: add friends, see their charts, compatibility.

## Notes
- Accounts and social need a backend and a database (likely the same Fly + SQLite stack
  as Festa, or a hosted database); v1 stays a static page until then.
- Descriptions must be written (or carefully edited) by Ivo, not mass-generated.
