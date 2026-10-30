# Astro: where it is going

Written down 2026-10-30 from Ivo's ideas. Version 1 (now) is only the sky; everything
below is intention, not built yet.

## Now (v1): the sky at any moment
- Planet signs, degrees, retrograde markers; when each entered and leaves its sign.
- Retrograde periods (now and next), with Mercury retrograde called out at the top.
- Zodiac wheel with aspects, element and modality balance, aspect list, Moon phase,
  what changes in the next 45 days.
- Any date and time, any time zone. EN/PT. All calculated in the browser (free to host).
- Inspired by ponteiro.com.br/transitos.php, done better.

## Next
1. **Design pass**: a clean, calm "mind space" look in the spirit of Co–Star, darker
   mood, light and dark modes (from ChatGPT mockups).
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
