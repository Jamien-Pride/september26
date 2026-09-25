# Fact-check notes: code and source citations (fetched 2026-09-25)
Raw downloads were kept in the session scratchpad, not in this repo.

## Access problems
- codelibrary.amlegal.com (Sec. 148 and 139): HTTP 403 Cloudflare "Just a moment..." challenge from curl and WebFetch. Headless Chromium failed TLS through the agent proxy, and a TLS-pinning workaround was denied by the permission system, so I did not use it. Replacement: I read the enacting ordinances in full from the SF Board of Supervisors archive (below).
- sfmx.org PDF: 403 WAF. Replacement: Wayback copy dated 2024-09-13 (id_ raw), read in full.
- mdpi.com: 403 Akamai. Replacement: the publisher's own PDF at mdpi-res.com, read in full (18 pp).
- darksky.org: 403 Cloudflare. Replacement: Wayback copy dated 2026-09-18, read in full.
- solaracks.com: SiteGround CAPTCHA (403/202). The page is not in Wayback (404). NOT VERIFIED.

## 1. SF Planning Code Sec. 148
Opened: https://sfbos.archive.sf.gov/sites/default/files/o0245-25.pdf (Ord. 245-25, File 250701, "Family Zoning Plan", 471 pp, loaded in full). Sec. 148 is on ordinance pp. 49-51.
Section-ID check: amlegal's own search-result titles map 0-0-0-18821 to "SEC. 148. REDUCTION OF GROUND-LEVEL WIND CURRENTS FOR BUILDINGS TALLER THAN 85 FEET IN CERTAIN DISTRICTS", which matches the ordinance's new heading. I could not open the page itself.
Legislative history: "December 09, 2025 Board of Supervisors - FINALLY PASSED" (6-4). Sec. 17: effective "30 days after enactment". A search snippet of amlegal's history note gives Ord. 245-25 as adopted 12/12/2025 and effective 1/12/2026. That date comes from a search excerpt only and is unverified.

CURRENT TEXT (new):
- (a) Applicability: "In the C-3 Districts, Van Ness Special Use District, Folsom and Main Residential/Commercial Special Use District, Downtown Residential (DTR) Districts, and Central SoMa Special Use District, this Section 148 shall apply to new buildings taller than 85 feet in Height, vertical additions of more than 30 feet resulting in a total building height greater than 85 feet, or vertical additions of more than 30 feet to an existing building that is taller than 85 feet."
- (b) "'Equivalent Wind Speed' means an hourly average wind speed adjusted to incorporate the effects of gustiness or turbulence on pedestrians, pursuant to the methodology adopted by the Planning Commission, as amended from time to time."
- "'Nine-Hour Hazard Criterion' means a ground-level equivalent wind speed of 26 miles per hour for nine or more hours per year."
- (c) "Projects shall not result in any net new locations that exceed the Nine-Hour Hazard Criterion."
- (d)/(e): wind-reducing features must be shown on plans and maintained for the life of the project.
- The comfort criteria (11/7 mph, 10%, 7am-6pm) are DELETED from Sec. 148.

OLD TEXT (struck through in the ordinance, C-3 only): "...will not cause ground-level wind currents to exceed, more than 10 percent of the time year round, between 7:00 a.m. and 6:00 p.m., the comfort level of 11 m.p.h. equivalent wind speed in areas of substantial pedestrian use and seven m.p.h. equivalent wind speed in public seating areas." "No exception shall be granted and no building or addition shall be permitted that causes equivalent wind speeds to reach or exceed the hazard level of 26 miles per hour for a single hour of the year." "(b) Definition. The term 'equivalent wind speed' shall mean an hourly mean wind speed adjusted to incorporate the effects of gustiness or turbulence on pedestrians."
(Central SoMa Sec. 249.78 in the same ordinance keeps a comfort level at 15% and both a nine-hour and a one-hour hazard criterion.)

Verdicts:
- 11 mph pedestrian / 7 mph seating, 10% of the time, 7 AM-6 PM: accurate for the OLD text (C-3 only). The current Sec. 148 no longer contains any comfort criterion. Label it as the pre-2026 wording, or cite Sec. 249.78 or the Planning methodology.
- Hazard 26 mph for a single hour: OUTDATED. The current rule is 26 mph equivalent for nine or more hours per year, with no net new exceeding locations.
- "about 36 mph one-minute" equivalent: NOT FOUND in the code. The code defines only an hourly mean/average adjusted for gustiness or turbulence. Any one-minute conversion is the reviewer's own inference.
- "governs buildings downtown, not art on Treasure Island": CONFIRMED in substance. Current applicability covers only buildings over 85 ft in C-3, Van Ness SUD, Folsom & Main SUD, DTR and Central SoMa SUD. Treasure Island is not listed. The old text was C-3 only.

## 2. SF Planning Code Sec. 139 (bird-safe)
Opened: https://sfplanning.org/sites/default/files/documents/reports/bird_safe_bldgs/BOS%20Amended%20Ordinance%209-12-11.pdf (clean text, 12 pp) and https://sfbos.archive.sf.gov/ftp/uploadedfiles/bdsupvrs/ordinances11/o0199-11.pdf (enacted Ord. 199-11, finally passed 9/27/2011). Also read: the SF Planning "Standards for Bird-Safe Buildings" (via abcbirds.org/wp-content/uploads/2020/11/San-Francisco.pdf, V.7.14.2011) and the SF Planning Design Guide PDF.
Section-ID check: amlegal search title "SEC. 139. STANDARDS FOR BIRD-SAFE BUILDINGS." for 0-0-0-18643. I could not open the page.
Caveat: a search snippet says the section was amended by File No. 130062 (effective 4/27/2013). I could not read that amendment or the current codified text.
- Code text (c)(2): "Feature-related hazards include free-standing glass walls, wind barriers, skywalks, balconies, and greenhouses on rooftops that have unbroken glazed segments 24 square feet and larger in size. Feature-related hazards can occur throughout the City. Any structure that contains these elements shall treat 100% of the glazing on Feature-Specific hazards."
- The doc's exact wording ("free-standing clear glass walls, skywalks, greenhouses on rooftops, and balconies that have unbroken glazed segments 24 square feet and larger") is from the Planning Dept Standards document p.30, not the code. The code wording has no "clear" and adds "wind barriers".
- Reflective features: NOT covered. The operative text regulates glazing only: "Bird-Safe Glazing Treatment", "unbroken glazed segments", "100% of the glazing". "Reflective" appears only in the findings (Sec. 1(a)(1): "reflective/transparent glass") and in Sec. 145.1 ("dark or mirrored glass shall not count towards the required transparent"). A free-standing mirror-polished steel funnel is not a glazed feature under the text.
- Treasure Island: the text has no district limit. "Feature-related hazards can occur throughout the City", and "These controls shall apply to all structures subject to this Section regardless of whether the ownership or use is public or private." Location-related standards apply to buildings in or within 300 ft of an Urban Bird Refuge, which includes "open water". Whether the Treasure Island SUD / Design for Development overrides this was not checked.
Verdict: the list is essentially correct but paraphrases the Planning guide (code adds "wind barriers" and omits "clear"). The code covers glazing, not reflective metal.

## 3. 2010 ADA Standards
Opened: https://www.corada.com/documents/2010ADAStandards/307 (full), https://www.access-board.gov/ada/ (full), https://www.ada.gov/law-and-regs/design-standards/2010-stds/ (full), https://www.corada.com/documents/2010ADAStandards/403.
- 307.2: "Objects with leading edges more than 27 inches (685 mm) and not more than 80 inches (2030 mm) above the finish floor or ground shall protrude 4 inches (100 mm) maximum horizontally into the circulation path." CONFIRMED (handrail exception 4½ in).
- 307.4: "Vertical clearance shall be 80 inches (2030 mm) high minimum. Guardrails or other barriers shall be provided where the vertical clearance is less than 80 inches (2030 mm) high. The leading edge of such guardrail or barrier shall be located 27 inches (685 mm) maximum above the finish floor or ground." CONFIRMED.
- Also relevant, 307.3 post-mounted: "Free-standing objects mounted on posts or pylons shall overhang circulation paths 12 inches (305 mm) maximum when located 27 inches (685 mm) minimum and 80 inches (2030 mm) maximum above the finish floor or ground."
- 403.5.1: "the clear width of walking surfaces shall be 36 inches (915 mm) minimum. EXCEPTION: The clear width shall be permitted to be reduced to 32 inches (815 mm) minimum for a length of 24 inches (610 mm) maximum provided that reduced width segments are separated by segments that are 48 inches (1220 mm) long minimum and 36 inches (915 mm) wide minimum." CONFIRMED. Note the 48-in separation condition.

## 4. SimScale Lawson (https://www.simscale.com/blog/lawson-wind-comfort-criteria/, 200, full)
The page covers three variants:
- Original: 2% exceedance, 1.8/3.6/5.3/7.6 m/s, no safety category.
- LDDC: 5% exceedance, 2.5/4/6/8 m/s, plus a safety category ">15 m/s > 0.022%" ("about 2 hours" a year).
- Lawson 2001: 5% exceedance, 4/6/8/10 m/s, plus S15 and S20 at >0.023%.
Speeds are "at pedestrian height, between 1.5 m and 1.75 m". The doc cites it generically; that is fine.

## 5. SFMX "Weather, San Francisco Bay" (Wayback 20240913 copy of the sfmx.org PDF, 10 pp, full)
- "During the summer months, afternoon and evening wind speeds frequently reach 20 to 25 knots (meeting small craft advisory criteria) in the northern San Francisco Bay from mid-afternoon through mid-evening. In fact, small craft advisory conditions occur nearly every day in summer through the central and northern San Francisco Bay and eastward through the Carquinez Strait. Wind speeds sometimes locally reach 30 knots in these areas."
- "The strongest afternoon and evening summer seabreezes usually occur along a path from the Golden Gate ... past Alcatraz and the southern end of Angel Island (Point Blunt), east to Berkeley..."
- "Elsewhere in the Bay, summer seabreezes generally do not exceed 20 knots."
- "Wind direction is generally west-to-east".
- The only "15 to 25 knots" is for the COASTAL WATERS outside the Gate (Gulf of the Farallones, northwest winds): "increasing to 10 to 20 knots or even 15 to 25 knots in the afternoon and early evening hours."
- SCA definition in the doc: "Forecast winds of 22 to 33 knots".
- The phrase "15–25 kt across the Central Bay" actually appears in a sailing blog (breezada-blog.com), not SFMX.
Verdict: WRONG/MISATTRIBUTED figure. SFMX says 20-25 kt (locally 30) with small-craft-advisory conditions nearly daily in the central/northern Bay. The direction (westerly) is confirmed.

## 6. MDPI INVELOX review. Chitura, Mukumba, Shambira, "Increased Velocity (INVELOX) Wind Delivery System: A Review of Performance Enhancement Advances", Wind 2025, 5, 19, doi:10.3390/wind5030019. Read in full via mdpi-res.com PDF.
- "The speed ratio SR is always positive, with [8] suggesting a value between 1 and 2.6."
- Other values: "the speed ratio was improved to 2.3", "the speed ratio can be increased up to 3", "improve the speed ration to 2.77", table "1.67 times", "1.72 times", "2.3 times", "2.77 times", "acceleration ratio of 1.78".
- "Practical construction of INVELOX systems has been limited in studies, leaving their analysis to be mostly numerical more that empirical."
Verdict: NOT FOUND. The page has no "1.5-2.1x" range and no "average about 1.8x", and says the results are mostly CFD, not measured. Corrected statement: SR is roughly 1-2.6 per the cited source, with individual studies reporting about 1.7-2.8 and up to 3, mostly numerical.

## 7. DarkSky "Five Principles for Responsible Outdoor Lighting" (Wayback 2026-09-18, full)
- Image alt text: "Responsible outdoor lighting is: 1. Useful, 2. Targeted, 3. Low Level, 4. Controlled, and 5. Warm-Colored". Principle 5: "Use warmer-color lights where possible. Limit the amount of shorter wavelength (blue-violet) light to the least amount needed."
- Jointly published with IES (April 2020, graphics updated September 2023).
Verdict: five principles CONFIRMED. "3000 K or warmer" is NOT on this page, which gives no Kelvin figure. That number comes from DarkSky's fixture certification program; cite that instead.

## 8. Siemens blog (2015-03-05, full)
- "29th August, 2012. A Jaguar XJ parked in Fenchurch Street, London, suffered melted panels between 1200 and 1400 ... 20 Fenchurch Street ... 'Walkie-Talkie'..."
- The page says 2012, which is the page's own error: the incident was August 2013, and Physics World (5 Sep 2013) reports it "this week". The doc's "2013" is right, but the cited page contradicts it.
- The page does NOT mention Vdara, Viñoly or Las Vegas. That claim needs source 9.

## 9. Physics World (published 2013-09-05, full)
- "The Vdara hotel – which was designed by the same architect as the Walkie Talkie – attracted similar criticism when it opened in 2009 after guests complained that the pool deck was hot enough to singe hair and melt plastic. The hotel was briefly known as the 'death ray hotel'."
- "reports of flaming bicycle seats and melting cars".
- The architect is not named (Rafael Viñoly appears on neither page). Its "scorched" corresponds to the page's "singe hair and melt plastic".
- EJP scale-model results: 110 °C wood, 250 °C black paper.
Verdict: CONFIRMED except the architect's name, which is not on either cited page.

## 10. ASSDA tea staining FAQ (200, full, plus Table image)
- "Grade 316, or a grade with equivalent corrosion resistance, should be selected as a minimum within five kilometres of the surf." CONFIRMED. Also: "up to five kilometres from a surf beach and one kilometre from still marine waters"; "20 kilometres or more" possible.
- Unrinsed chlorides: "Conditions are very aggressive in rain-sheltered areas ... can cause significant tea staining"; "Areas that are sheltered or not rain washed are particularly susceptible"; "Washing removes deposits (such as salt) ... It is necessary to avoid tea staining." CONFIRMED.
- Mirror polish: "The most corrosion resistant, mechanically finished surface is a mirror polish (ASTM A480 No. 8 ...). It is very smooth, resistant to salt accumulation and easy to clean." Also "keeping a pristine surface finish requires ... usually, additional cost ... This normally includes a maintenance program." Table (for 304): seaside, rain-washed 1/year; not rain-washed 3-4/year, or 4-12/year where deposits accumulate.
- Verdict: regular cleaning is supported as general guidance. The page does not single out mirror polish as needing more cleaning; it calls it the most resistant finish and "easy to clean".
- Also: San Francisco Bay is "still marine water" (the 1 km guideline) as well as close to the Golden Gate surf influence.

## 11. Solaracks C4 vs C5: NOT VERIFIED (CAPTCHA, not archived). A search excerpt suggests the page ties C5 to "immediately on the beachfront or offshore" and says a site "within 1 km of the sea ... is often C4". That is not verification, and if accurate it conflicts with "C5 within 0.5-1 km".

## 12. PatSnap galvanic (200, full)
- "Aluminum carries a corrosion potential of approximately −700 to −900 mV vs. SCE, while stainless steel sits at approximately −100 to +200 mV vs. SCE ... This electrode potential gap of hundreds of millivolts". Callouts: "−800 mV", "+100 mV", "366 mV Measured potential difference Al 6061 vs. SS 304 at 10°C (2022 study)".
- Verdict: "0.5-1 V" is NOT stated. The page's ranges imply about 0.6-1.1 V (typical ~0.9 V), but it words the gap as "hundreds of millivolts" and cites a measured 0.37 V.

## 13. PPG FGIA/AAMA 2605 (200, full)
- "Built on 70% PVDF fluoropolymer technology or FEVE-based resin systems"
- "To meet the AAMA 2605 standard, coatings must pass a demanding 10-year South Florida exposure test, proving outstanding fade resistance (≤ 5 ΔE), chalk resistance (≥ 8), and gloss retention (≥ 50%)..."
- Verdict: CONFIRMED. Nuance: the page says 70% PVDF *or FEVE*, so "typically" is fair. The page says NOTHING about reds, magentas or yellows fading.
