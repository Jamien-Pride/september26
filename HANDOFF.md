# Handoff: fact-check with full network access

Earlier session built the site visualization, the blueprint lessons page and a
written review. Its web research could only see search-result excerpts. This
session should verify the numbers with full pages and real data.

## Published pages (update these, don't create new ones)
- Written review (Claude Doc): https://claude.ai/code/artifact/37ec5ee1-faf7-416a-a690-0e52c98b33d7
- Funnel Lessons (lessons.html): https://claude.ai/artifact/Xn31zd3Ryn4jdjEVrWwfW8
- Site visualization (index.html): https://claude.ai/artifact/FRHFwggP7Vum2r9MtTPksn

## To verify
1. **Site wind climate.** Pull multi-year wind from NOAA CO-OPS Yerba Buena Island
   (station 9414782, api.tidesandcurrents.noaa.gov). Compute the direction rose and
   hours/year the free wind at head height exceeds 11 mph (7 AM–6 PM), then the
   throat (x1.2–1.5) exceedance. Current doc uses regional guidance (15–25 kt
   summer afternoons, Central Bay).
2. **Design wind.** ASCE Hazard Tool (hazards.atcouncil.org) for 37.81958, -122.37321:
   basic wind speed (doc assumes 95 mph, Risk Cat II) and whether Exposure D applies.
   Load estimate: F = 0.00256 Kz V^2 Kd G Cf Af, Af = 175 sq ft, centroid 7 ft.
3. **Codes.** SF Planning Code Sec. 148 (11 mph / 10% / 26 mph hazard) and Sec. 139
   (24 sq ft feature hazard); ADA 307.2 / 307.4.
4. **Ground and flood.** USGS Loma Prieta Treasure Island reports (0.16 g, sand boils);
   fill thickness (~15 m) and Bay Mud layers; 100-yr tide 9.1 ft and 36 in rise design
   basis, and which datum (NAVD88?). Pad grade in the DEM is ~11.9 ft NAVD88.
5. **Everything in the doc's Sources list**: read in full and correct any figure.

## Computed results (from the drawings; should not change)
- Glare: ~550 h/yr with a head-height spot >=1x sun; peak 2.2x (Dec 19, 4:40 PM);
  3.8x line on the pad in early Nov / early Feb ~3:30 PM. data/glare_year.json.
- Throat: 78 in top, 43 in clear at floor, overhang >4 in above 74 in.
- Wind 2D LBM: throat 1.3–1.4x, rim edges ~2x (tools/wind_check.mjs).

## Tools
- `tools/glare_year.mjs`, `tools/wind_check.mjs`, `tools/sun_facts.mjs` run in Node
  (need `three` resolvable: `npm i three@0.186.1` in /tools or a node_modules symlink).
