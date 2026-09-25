# Handoff: fact-check with full network access

Earlier session built the site visualization, the blueprint lessons page and a
written review. Its web research could only see search-result excerpts. This
session should verify the numbers with full pages and real data.

## Published pages (update these, don't create new ones)
- Written review (Claude Doc): https://claude.ai/code/artifact/37ec5ee1-faf7-416a-a690-0e52c98b33d7
- Funnel Lessons (lessons.html): https://claude.ai/artifact/Xn31zd3Ryn4jdjEVrWwfW8
- Site visualization (index.html): https://claude.ai/artifact/FRHFwggP7Vum2r9MtTPksn

## Verification status (September 2026, full network)
Done. Doc, lessons.html and the Wind tab now use verified numbers. Notes with exact quotes
are in notes/; the site wind analysis is tools/site_wind.py -> data/site_wind.json.

- Wind: Yerba Buena Island (9414782) has no wind sensor. Used the Treasure Island Naval
  Station record (NCEI ISD 724943, 1983-96) bridged to 2021-25 through Oakland airport;
  six NOAA CO-OPS stations read 25-45% low (sheltered). Open lawn > 11 mph in 24-36% of
  7 AM-6 PM hours; throat 34-64%.
- Design wind: ASCE Hazard Tool 92 mph (RC II, 7-22 and 7-16), Exposure D.
  F = 3,400-4,500 lbf, M = 24,000-32,000 ft-lbf.
- Codes: Sec. 148 rewritten by Ord. 245-25 (Dec 2025): comfort criterion removed, hazard
  now 26 mph for 9+ h/yr, applies to 85 ft+ buildings downtown only. Sec. 139 covers
  glazing only. ADA 307.2 / 307.4 confirmed.
- Ground: pad ~12.9 ft NAVD88 (March 2023 lidar; 11.3 in 2010). 100-yr still water
  9.2 ft NAVD88; floors >= 12.7. Fill + shoal sand ~30-50 ft.

## Still open
- Force coefficient for an open funnel (1.2-1.6 assumed).
- No boring log for Cityside Park; no as-built park grade.
- Solaracks page (ISO 9223 distances) blocked by CAPTCHA; replaced with ASSDA.
- amlegal.com blocked automated reads; Sec. 148/139 read from their ordinances.

## Computed results (from the drawings; unchanged)
- Glare: ~550 h/yr with a head-height spot >=1x sun; peak 2.2x (Dec 19, 4:40 PM);
  3.8x line on the pad in early Nov / early Feb ~3:30 PM. data/glare_year.json.
- Throat: 78 in top, 43 in clear at floor, overhang >4 in above 74 in.
- Wind 2D LBM: throat 1.3-1.4x, rim edges ~2x (tools/wind_check.mjs, re-run Sept 2026:
  1.28-1.44x).

## Tools
- `tools/glare_year.mjs`, `tools/wind_check.mjs`, `tools/sun_facts.mjs` run in Node
  (need `three` resolvable: `npm i three@0.186.1` in /tools or a node_modules symlink).
- `tools/site_wind.py [cache_dir]` downloads NOAA/NCEI data and writes data/site_wind.json.
