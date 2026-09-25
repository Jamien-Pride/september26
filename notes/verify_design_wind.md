# ASCE 7 wind parameters: Cityside Park, Treasure Island (37.81958, -122.37321)

Retrieved 2026-09-25. Raw files were kept in the session scratchpad, not in this repo.

## 1. Basic wind speed (ASCE Hazard Tool, https://ascehazardtool.org/)

How it was retrieved: I drove the live web app in headless Chromium using Playwright, with the URL hash
`#lat=37.81958&lon=-122.37321&r=2&sv=7-22&sc=3&m=imperial&l=Wind`, then opened the **Wind Details** popup.
Wind data is free and needs no login. I also sent the same ArcGIS REST calls that the app makes directly to gis.asce.org.

App text for ASCE 7-22, RC II (`page_7-22_rc2.txt`, `shot_7-22_rc2.png`):
- "Elevation 12 ft with respect to North American Vertical Datum of 1988 (NAVD 88)"
- "Wind Speed 92 Vmph", with MRIs 10-yr 64 / 25-yr 70 / 50-yr 74 / 100-yr 79 / 300-yr 87 / 700-yr 92 / 1,700-yr 99 / 3,000-yr 103 / 10,000-yr 112 / 100,000-yr 129 / 1,000,000-yr 147 Vmph
- "Value provided is 3-second gust wind speeds at 33 ft above ground for Exposure C Category, based on linear interpolation between contours. ... (annual exceedance probability = 0.00143, MRI = 700 years)."
- "Site is not in a hurricane-prone region as defined in ASCE/SEI 7-22 Section 26.2."
- "Data Source ASCE/SEI 7-22, Fig. 26.5-1B and Figs. CC.2-1–CC.2-4, and Section 26.5.2"

App text for ASCE 7-16, RC II (`page_7-16_rc2.txt`): "Wind Speed 92 Vmph", with MRIs 10-yr 64 / 25-yr 70 / 50-yr 74 / 100-yr 79. It also says "Site is not in a hurricane-prone region as defined in ASCE/SEI 7-16 Section 26.2."

Raw values from the REST service (mph):

| RC | ASCE 7-22 | ASCE 7-16 | Rounded |
|---|---|---|---|
| I (300-yr) | 86.56 | 86.56 | 87 |
| II (700-yr) | 91.94 | 91.96 | **92** |
| III (1,700-yr) | 98.64 | 98.58 | 99 |
| IV (3,000-yr) | 102.86 | 102.87 | 103 |

- The 7-22 values are from `ASCE722/w2022_CONUS_Mosaic/ImageServer/identify` (`w2022_CONUS_Mosaic_identify.json`) and `ASCE722/w2022_Tile_RC_{I..IV}/MapServer/identify` (`w722_RC_*.json`).
- The 7-16 values are from `ASCE/wind2016_{300,700,1700,3000}/ImageServer/identify` (`w716_*.json`).

Flags:
- **Special wind region:** none. `ASCE722/w2022_Special_Wind_Regions/MapServer/0` returned 0 features, and `w2022_SWR_CA` and `SWR_CO_Mosaic_1007` returned NoData.
- **Hurricane-prone region:** no.
- **Wind-borne debris region:** does not apply. `ASCE_Hurricane_WindBorneDebris` layers 2 and 4 returned 0 features, and wind-borne debris regions exist only inside hurricane-prone regions.

**Conclusion:** V = 92 mph for RC II under both 7-22 and 7-16. The document's 95 mph is conservative by 3 mph, which is (95/92)² ≈ 1.066, or about 6.6% higher velocity pressure.

## 2. Fallbacks
None were needed, because the tool worked.

## 3. Exposure category

Source: CBC 2022 (IBC 2021 basis, which references ASCE 7-16), Section 1609.4, via UpCodes:
https://up.codes/viewer/california/ca-building-code-2022-1/chapter/16/structural-design (excerpt in `cbc2022_1609.4_excerpt.txt`). These sections reproduce ASCE 7 §26.7.2 and §26.7.3.

- "Surface Roughness D. Flat, unobstructed areas and water surfaces. This category includes smooth mud flats, salt flats and unbroken ice."
- "Exposure D. Exposure D shall apply where the ground surface roughness, as defined by Surface Roughness D, prevails in the upwind direction for a distance of not less than 5,000 feet (1524 m) or 20 times the height of the building, whichever is greater. Exposure D shall apply where the ground surface roughness immediately upwind of the site is B or C, and the site is within a distance of 600 feet (183 m) or 20 times the building height, whichever is greater, from an Exposure D condition as defined in the previous sentence."
- "Exposure C. Exposure C shall apply for all cases where Exposure B or D does not apply."
- §1609.4.1 requires evaluating "the two upwind sectors extending 45 degrees ... either side of the selected wind direction", and "the exposure resulting in the highest wind loads shall be used."

Hurricane versus non-hurricane water:
- ASCE 7-05's Surface Roughness D read "...water surfaces outside hurricane-prone regions". ASCE 7-10 removed that restriction, so all water surfaces are Surface Roughness D.
- ASCE 7-22 did not reverse this. Its only related change is to the wind-borne debris trigger: "deletes the word 'coastal' and adds language to require that an Exposure D condition exist upwind of the water line". The fact sheet adds: "In hurricane-prone regions, Exposure D applies where a water exposure prevails in the upwind direction for 5000 feet or 20 times the height of the building." Source: FEMA fact sheet, Aug 2022, https://www.fema.gov/sites/default/files/documents/fema_asce-7-22-wind-highlights_fact-sheet_2022.pdf (saved in `fema_asce722_wind_factsheet.pdf`).
- The site is not hurricane-prone in any case.

Applying this to the site:
- About 2 mi (≈10,560 ft) of open bay lies to the W/WSW. That is more than 5,000 ft, and more than 20h for any h up to 528 ft, so an Exposure D condition exists at the seawall for those wind directions.
- The site is about 300 ft inland across park or landscaped land (roughness C or B). That is less than 600 ft, and less than 20h for any h.
- **Result: Exposure D applies** for wind directions from roughly W, WSW and NW over the Bay. It governs the design because the highest-exposure sector must be used.

Kz, Table 26.10-1, for z ≤ 15 ft:
- **Exposure C = 0.85, Exposure D = 1.03.** Exposure B is 0.57 for reference.
- The ASCE 7-22 standard text is paywalled (ASCE Amplify), so these values come from secondary sources:
  - https://windload.solutions/exposure-d-coastal-ocean-wind-loads
  - CED course S02-048
- As a cross-check, 7-16 Table 26.10-1 has the same 0–15 ft values (0.57 / 0.85 / 1.03).
- ASCE 7-22 did revise Table 26.10-1 and Table 26.11-1. Professional Roofing says: "The Kz values for Exposure B and Exposure C decreased for most building heights by about 2%" (https://www.professionalroofing.net/Articles/Updating-the-standard--07-01-2022/5088). No source I found reports a change to the C or D values at 15 ft. Verify against a licensed copy before relying on this.

Kd, Table 26.6-1 (ASCE 7-22), per secondary source https://windload.solutions/wind-directionality-factor-guide:
- Open signs and single-plane open frames: 0.85
- Solid freestanding walls, rooftop equipment and solid signs: 0.85
- Trussed towers, triangular/square/rectangular: 0.85
- Trussed towers, all other cross sections: 0.95
- Buildings, MWFRS and C&C: 0.85
- Arched roofs: 0.85
- Chimneys/tanks: square 0.90, hexagonal 0.95, octagonal and round 1.0
- Circular domes: 1.0
- ASCE 7-16 listed "lattice framework" at 0.85.
- In 7-22, Kd was moved out of the qz equation and into the pressure and force equations (Meca, Professional Roofing).

Ke (ground elevation factor):
- Ke was **introduced in ASCE 7-16, not 7-22**, as §26.9 and Table 26.9-1. STRUCTURE magazine: "The new Ke factor adjusts the velocity pressure to account for the reduced mass density of air..." (https://www.structuremag.org/article/asce-7-16-wind-load-provisions/).
- ASCE 7-22 keeps it: qz = 0.00256 Kz Kzt Ke V². Ke = e^(−0.0000362 zg); it equals 1.0 at sea level and may conservatively be taken as 1.0.
- Some 7-22 course notes (for example CED S02-048) wrongly call Ke "new in ASCE 7-22".
- For this site (12 ft NAVD88 per the tool), Ke = 0.9996 ≈ 1.00.
