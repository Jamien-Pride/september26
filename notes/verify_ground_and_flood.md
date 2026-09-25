# Fact-check: "Ground" section, sculpture pad, Cityside Park, Treasure Island (37.81958, -122.37321)

Checked 2026-09-25. I opened every source in full: HTML with curl and stripped the tags, PDFs with curl and PyMuPDF, and elevation data with rasterio and laspy. The raw downloads were kept in the session scratchpad, not in this repo.

---
## 1. USGS publication page + underlying report

**URL opened:** https://www.usgs.gov/publications/loma-prieta-earthquake-ground-motion-and-damage-oakland-treasure-island-and-san
(curl returned a CloudFront 403, so I read the page with WebFetch. I also read the mirror record https://pubs.usgs.gov/publication/70205993 in full.)

- **What it actually is:** Hanks, T.C., and Brady, A.G., 1991, "The Loma Prieta earthquake, ground motion, and damage in Oakland, Treasure Island, and San Francisco", *BSSA* v. 81 no. 5 p. 2019-2047, doi:10.1785/BSSA0810052019. It is a journal article, not a Professional Paper. The full text is paywalled (GeoScienceWorld), and the USGS page gives only the abstract.
- The abstract has no 1936-37 date, no 0.16 g, and no sand boils. It says: "an artificial-fill site on Treasure Island ... The S-wave group at Treasure Island is phase coherent with the Oakland records, but at somewhat diminished amplitudes, until the steps in acceleration at approximately 15 sec, apparently signaling the onset of liquefaction." It also says: "the Treasure island accelerogram is the most likely strong-motion surrogate for the filled areas of the Marina District".
- **Verdict:** this link does not support the specific claims. It confirms only that Treasure Island is artificial fill and that the recording shows liquefaction onset. **Cite the primary source below instead.**

**Primary source for the claims:** USGS Professional Paper 1551-B (1998), chapter "Analysis of liquefaction-induced damage on Treasure Island" (Power, Egan, Shewbridge, deBecker, Faris), https://pubs.usgs.gov/pp/pp1551/pp1551b/pp1551b.pdf (311 pp, opened in full).
- **Construction.** Quote: "More than 29 million yd3 of dredged material, mostly sand, was handled during filling operations that began in February 1936 and were completed in August 1937." The chapter also says the island was built "by hydraulically placing the fill materials with pipeline (suction), hopper, and clamshell dredging equipment." **CONFIRMED:** 1936-37, hydraulically placed sand dredged from the Bay.
- **Peak acceleration.** Quote: "The recorded east-west components of ground motion on Yerba Buena Island and the corresponding ground motion on Treasure Island are plotted in figure 11. As shown, the peak acceleration of 0.06 g on Yerba Buena Island was amplified to 0.16 g on Treasure Island." The Figure 11 label reads "CHN 1: 90 DEG 0.161g". **CONFIRMED:** 0.16 g, east-west component (channel 1, 90°), recorded at the fire station; Yerba Buena Island rock recorded 0.06 g on the same component.
  - Cross-check with Roy & Sharma 1993, WIT Transactions on the Built Environment v. 3 (https://www.witpress.com/Secure/elibrary/papers/SDEE93/SDEE93005FU.pdf, opened in full). Quote: "The corrected peak horizontal accelerations in the east-west direction ... were 0.067g at Yerba Buena and 0.159g at Treasure Island ... (California Div. of Mines and Geol. Report No. OSMS 89-08)." And: "The peak horizontal accelerations in the N-S direction at Treasure Island and Yerba Buena were 0.100g and 0.029g". The same paper also gives Yerba Buena Island "0.061g (channel 1: 90 degree, CSMIP accelerogram)". So Yerba Buena Island was about 0.06-0.067 g east-west, and Treasure Island about 0.16 g east-west, 0.10 g north-south.
  - Caveat: SF Public Press (2010, claim 4) says Loma Prieta produced "about .3 gs there". That conflicts with the records, so do not use it.
- **Ground failure.** Quotes: "sand boils were documented at 18 locations on the island"; "the island settled and spread laterally several inches during the earthquake. Locally, settlements as great as 2 ft were documented"; "small amounts of lateral spreading (generally less than 1 ft of horizontal movement) occurred around the island's perimeter"; "cracks were as much as 4 in. wide"; "total settlements generally ranged from 2 to 6 in." **CONFIRMED:** sand boils, settlement, cracking and lateral spread.
  - Relevant to the site: "those on the west side were generally limited to inland distances of 150 ft or less". Lateral spreading was "lesser ... along the north, south, and west sides of the island relative to the east side". The pad is about 270-300 ft inland, so it is beyond the 1989 west-side crack zone.

## 2. USGS OFR 90-253
**URL opened:** https://pubs.usgs.gov/of/1990/0253/report.pdf (131 pp, full text extracted)
- **What it is:** "EFFECTS OF THE LOMA PRIETA EARTHQUAKE ON THE MARINA DISTRICT SAN FRANCISCO, CALIFORNIA", Open-File Report 90-253, April 20, 1990 (Holzer, O'Rourke, Bonilla, Bennett and others). It is about the **Marina District**, not Treasure Island.
- It mentions Treasure Island only twice, as a reference point:
  - Bennett chapter, liquefaction analysis: "a minimum acceleration of 0.16 g ... The minimum acceleration was measured at Treasure Island, a site that experienced liquefaction, has a similar artificial fill, and is approximately the same distance from the seismic source."
  - Boatwright et al.: "The spectrum labelled TRI was obtained from the accelerogram recorded on Treasure Island which had a peak ground acceleration of 16% g."
- All of its sand boils, settlement and lateral spreading observations are for the Marina, for example "more than 30 sandboils".
- **Verdict:** it supports 0.16 g at Treasure Island and that Treasure Island liquefied. It does **NOT** document Treasure Island sand boils, settlement or lateral spread. **Mis-cited for those; replace with PP 1551-B.**

## 3. Soil profile / fill thickness
**URL opened:** https://se.ucsd.edu/seminars/geotechnical-conceptual-design-planned-redevelopment-treasure-island-california (ENGEO seminar, Feb 9, 2022)
- What the page says: "created in 1936-1937 ... constructed by placing approximately 30-million cubic yards of dredged sand fill over a sand shoal." It lists the hazards (liquefaction of fill and shoal sands, bay mud consolidation, perimeter stability) and the mitigation methods: "cement deep-soil mixing for shoreline stability", "vibro-compaction, vibro-replacement, deep dynamic compaction, and direct power compaction", "surcharging ... prefabricated vertical drains".
- **NOT FOUND on this page:** "15 m loose saturated fill over 15 m Young Bay Mud and 60 m Old Bay Mud". **Mis-attributed.**
- The actual source of the 15/15/60 wording is arXiv 2511.04074 ("Insights on Numerical Damping Formulations...", section 2.3, https://arxiv.org/pdf/2511.04074). Quote: "The surface deposits consist of approximately 15 m of loose, saturated, hydraulic fill ... underlain by approximately 15 m of San Francisco Young Bay Mud, followed by approximately 60 m of Old Bay Mud ... Bedrock is encountered at a depth of approximately 90 m". This describes the **Treasure Island Downhole Array (TIDA) site only** (fire station area, about 37.825 N, about 600 m north of the pad).
- The instrument operator's description of the same site, Graizer & Shakal, SMIP2000 (https://conservation.ca.gov/cgs/documents/program-smi/seminar/smip00/Paper2_Graizer.pdf). Quote: "At the array site there is approximately 12 m of hydraulic fill and sand overlying about 15 m of medium-stiff Holocene Bay Mud ... Franciscan sandstone and shale are encountered at 91 m". Array coordinates are listed as 37.825, -122.373.
- Island-wide primary sources:
  - PP 1551-B (Power et al.): "The sand fill and shoal sand range in combined thickness from approximately 30 to 50 ft, except in a small area on the north side ... approximately 70 ft thick"; "The bay mud ... ranges in thickness from approximately 10 to 120 ft, is thinnest on the eastern perimeter and thickest on the northwest side"; "depth to bedrock ... approximately 100 to 400 ft ... shallowest on the south side". On construction: the pre-fill bay bottom "ranged in elevation from 2 to 26 ft below mean lower low water (MLLW)", and filling continued "until the surface of the fill reached approximately 13 ft above MLLW".
  - TI/YBI Redevelopment Draft EIR, Case 2007.0903E, July 12 2010, Vol. 2 section IV.N Geology and Soils (https://sfmea.sfplanning.org/2007.0903E_V2.pdf). Quotes: "The thicknesses of the sand fill and shoal sands vary between approximately 30 and 50 feet"; "Young Bay Mud ... Thicknesses vary from 20 to 120 feet with the greatest thicknesses found in the northwest corner"; "Bedrock at Treasure Island is encountered approximately 285 feet below ground surface"; "The rock dikes were originally placed on top of the dredged sand in most areas of Treasure Island, or on top of the sand shoal in the southwest corner of the island."
  - ENGEO (Uri Eliahu) quoted in Informed Infrastructure (https://informedinfrastructure.com/post/getting-geotechnical-the-making-shaking-and-remaking-of-san-franciscos-treasure-island):
    - "artificial fill, about 25-45 feet"
    - "Beneath that, we have 20-25 feet of 'natural shoal deposit' ... also thought to be liquefiable"
    - "We have about 24 feet of the hydraulically placed fill sitting on top of a similar amount of the natural shoal"
    - The article's own summary: "about 50 feet of artificial fill susceptible to liquefaction". That summary conflates fill and shoal.
- **Verdict on "about 50 ft of loose fill":** overstated if it means placed fill. At or near the pad the **hydraulic fill is most likely about 20-30 ft (range 15-45 ft)**. It sits on loose, liquefiable shoal sand, and the **combined liquefiable sand column is about 30-50 ft**. A mechanical estimate gives the same range: fill top about +13 ft MLLW minus an original bottom of -2 to -26 ft MLLW gives 15-39 ft of placed fill.
- Suggested wording: "roughly 20-30 ft of hydraulically placed sand over natural shoal sand, about 30-50 ft of loose saturated sand in total, then soft Young Bay Mud (about 20-120 ft island-wide) and older bay deposits; bedrock is about 100-300 ft down."
- I could not find a west-side or Cityside-specific borehole log. The figures in PP 1551-B are images, and the ENGEO Cityside geotechnical reports are not online. So the range above is island-wide, bounded by the construction history.

## 4. SF Public Press, "Sand and silt require $137 million fix" (published 2010-06-29)
**URL opened:** https://www.sfpublicpress.org/sand-and-silt-require-137-million-fix-for-treasure-island/
- Quote: "The city and developer plan to compact the 100 acres of soil that will lie beneath the new buildings and around existing ones, as well as reinforce the island's perimeter. They estimate the geotechnical improvements will cost $137 million."
- Quote: "The interior areas beneath the new development will undergo densification through deep dynamic compaction ... Vibratory compaction methods ... will be used as well." It also mentions surcharging.
- On the perimeter, quote: "possibly by strengthening it with stone or soil cement columns and rock berms."
- Quote: "About 300 acres of open space and parks on Treasure Island will remain untreated."
- **Verdict:** partly confirmed.
  - 100 acres, $137 million, deep dynamic compaction and vibro-compaction are all correct.
  - "Deep soil mixing" is not named. The article says only "soil cement columns" at the perimeter, as a possibility. ENGEO (UCSD page) confirms "cement deep-soil mixing for shoreline stability".
  - The $137M is a **2010 planning estimate**, not an as-built cost.
- Note for the review: the article says open space (parks) is **not** densified. The pad is in a park, so it may sit on unimproved interior fill, except for the shoreline or perimeter treatment zone. Cityside's shoreline band was treated (DSM and perimeter work per ENGEO), but I found no source saying the whole 300-ft park width was densified.

## 5. Sea-level design basis
**URL opened:** https://www.sfpublicpress.org/uncertain-about-rising-seas-developers-using-mid-range-estimate-to-build-up-island/ (2010-06-29)
- Quote: "Moffatt & Nichol proposed adding enough soil to raise 100 acres of the island ... by 36 inches above the 9.1-foot, 100-year high tide. They also added six inches of 'freeboard' ... The remaining 230 acres will be left at their current height." Also: "New properties will be set back 300 feet from the shore". **CONFIRMED:** 36 in + 9.1 ft + 6 in.
- "Shoreline upgrades triggered at 30 in" is **NOT in this article** (I searched the full text).
  - The correct source is the BCDC letter to TIDA/TICD of March 1 2022 on Permit 2016.005.01 (https://www.sf.gov/sites/default/files/2022-06/2016.005.01_5Yr%20SLR%20Monitoring%20Report%20Review%20-FINAL.gg_.pdf). Quote: "(1) When a 30-inch SLR had occurred (compared to 2000 levels) planning would be initiated to adapt to a minimum of 36-inch SLR projection (or higher) for Project Phase 1 that includes the Cityside Park located in the southern and western portions of Treasure Island, and (2) when a 12-inch SLR had occurred ... for project parks and open spaces included in Phases 2-4". It also gives "an estimated duration of 8 years ... for Phase 1 ... when SLR levels reach 30 inches and completed before 36 inches".
  - So the 30-in trigger is **CONFIRMED, and it applies specifically to Cityside Park (Phase 1)**. It is a trigger to start planning, relative to 2000 sea level.
- **Primary design basis: Treasure Island Infrastructure Plan, June 28 2011** (https://media.api.sf.gov/documents/Ex._FF__-_Infrastructure_Plan.pdf, 179 pp)
  - **Datum.** Section 1.5: "All elevations referred to herein are based on North American Vertical Datum of 1988 (NAVD 88)."
  - **100-year still-water level.** Section 7.2.1: "the BFE for Treasure Island is 9.2 (NAVD 88) under current tide conditions" (Moffatt & Nichol 2009 Coastal Flooding Study).
    - The Draft EIR (2010) IV.O also says "9.2 feet NAVD88" for the 100-year tide. However, it gives open-space minimum "base flood elevation, which is 9.1 feet NAVD88", and SF Public Press uses 9.1. **Correct value: 9.2 ft NAVD88** (9.1 ft appears in the 2010 EIR and press).
    - Draft EIR: wave run-up "10 to 16.3 feet NAVD88".
    - Mean sea level: "3.29 feet (NAVD 88)".
  - **Local datums.**
    - Draft EIR footnote: "MLLW elevations are approximately 0.1 feet higher than the North American Vertical Datum ('NAVD') from 1988 which is often used to describe the elevations at Treasure Island". NOAA CO-OPS station 9414290 San Francisco (1983-2001 epoch) agrees: MLLW 5.98 ft and NAVD88 5.92 ft on station datum, so MLLW is about +0.06 ft NAVD88 and MHHW is about +5.9 ft NAVD88. Older MLLW-based elevations (PP 1551-B, Navy) are therefore effectively equal to NAVD88, within about 0.1 ft.
    - San Francisco City Datum, Infrastructure Plan: "The tidal elevation of -3.5 City Datum is equal to 7.81 NAVD 88 Datum". So NAVD88 = City Datum + 11.31 ft.
    - I found no separate "TI datum" in these documents. The Navy-era datum was MLLW.
  - **Finished grades (NAVD88).**
    - New buildings. Section 5.3.1.2.1: "a minimum of 42-inches above the current Base Flood Elevation". Section 7.3.2: "minimum finished floor elevations and garage entrances ... set at 12.7 (9.2 BFE + 36" SLR + 6" freeboard) ... The grades will vary between 12.7 and 14.5 (NAVD 88)". The 2010 EIR said 12.6.
    - Streets next to retained buildings: "12 to 15".
    - Parks and open space. Table 5.1: "Minimum Elevation: 9.2' (NAVD 88) Current 100-year high tide (ponding allowed ...)". Section 7.3.3: "The minimum elevations for the open space areas will be set at the existing BFE (elevation 9.2)".
    - Perimeter or shoreline. There is no single number. It is designed so that "only a 1% chance of wave overtopping" occurs at current tides "plus 16-inches" SLR. Existing perimeter "generally ranges from elevation 10 to 14 (NAVD 88)". SFPP 2010 gives the riprap wall at "between 12 and 14 feet".
    - Existing island grades before development: "approximately 6 (NAVD 88) in the northwestern edge ... to approximately 14 ... near the southern edge". The EIR gives "6 to 14 feet".
    - FEMA 2021 BFEs, per the BCDC 2022 letter: "range from +11 to +14 feet" NAVD88 at the island. These include wave effects in the VE/AE zones.

## 6. CMG site
**URL opened:** https://www.cmgsite.com/places/cityside-park/
- Quote: "The park includes shoreline improvements to protect the island and its residents from future sea-level rise, and the 300-foot width of the park provides ample space for future adaptation."
- Quote: "A series of stormwater gardens are woven through south and back edges of the park and are designed to filter and remove pollutants from the adjacent neighborhood (nearly 20 acres) ... Stormwater flows from the neighborhood to a pump station that lifts the water to forebays, channels, and weirs".
- **CONFIRMED.** Minor correction: "south and back edges", not only the back edges.
- Other facts on the page: "The 6-acre first phase of the park opened in September 2025" (the Chronicle gives opening day Sept 13 2025); "eventually 24 acres"; geotechnical engineer ENGEO; coastal engineer Moffatt & Nichol.
- TIDA (sf.gov Phase 1 parks page) says: "24-acre open space, 300-feet wide from the shore to Cityside Avenue and around three quarters of a mile in length".
- **Site check against OSM** (Overpass, data timestamp 2026-05): the Cityside Park polygon (way 1428380753, 5.9 acres) has its east (back) edge passing within about 0.1 m of the pad coordinate. **The pad is on the park's back edge**, where the stormwater gardens are. OSM coastline is 83 m (274 ft) west of the pad, which fits "~300 ft from the seawall".

## 7. Regrading and DEM vintage
- **SF Chronicle, 2025-09-01** (https://www.sfchronicle.com/sf/article/treasure-island-cityside-park-21014711.php). Quote: "the entire property, including the new park and the 22-story Isle House and six-story Hawkins Apartment buildings behind it, has been raised 3 feet to defend against the rising seas". **CONFIRMED:** the Cityside Park area was raised about 3 ft.
- SF Public Press 2023 (https://www.sfpublicpress.org/promising-to-prevent-floods-at-treasure-island-builders-downplay-risk-of-sea-rise/) says workers "piled 1 million cubic yards of soil atop the compacted layer", with the development pad at "3 feet, 6 inches above the 'base flood elevation'", and the seawall "raised to allow for just over 1 foot of sea rise".
- **Lidar and DEM at the pad**, which I sampled myself (bare earth, NAVD88):

  | Dataset | Acquisition | Elevation at pad |
  |---|---|---|
  | USGS LPC CA_SANFRANBAYFEMA_2004 (tile 000489), points within 5 m | 2004 | about 11.8 ft (11.4-12.0), model-keypoint class |
  | USGS LPC ARRA_CA_GOLDENGATE_2010 (tile 001077), ground class, 339 pts within 5 m | 2010 | median 11.26 ft (10.8-11.7) |
  | USGS 1/3 arc-second DEM, 2012-08-01 edition (Golden Gate 2010 source) | 2010 | 11.3 ft (bilinear 11.2) |
  | USGS 1 m CA_NoCAL_Wildfires_B5b_2018 | 2018 | 7.2 ft, site stripped or excavated mid-construction |
  | USGS 1 m CA_SanFrancisco_B23; also EPQS today, which reports AcquisitionDate 3/4/2023 | 2023-03-04 | 13.1 ft (EPQS 12.93 ft) |
  | USGS 1/3 arc-second current edition (2024-08-26 and 2025-08-26 tiles) | 2023 source | 12.9 ft |

  - Control points away from construction (Job Corps interior, north Treasure Island, Building 1 area) agree across 2010, 2018 and 2023 within about 0.5 ft. So the changes at the pad are real regrading, not datum artifacts.
  - BCDC 2022 notes that the Monitoring Report used "coastal LiDAR data from 2010 and 2018-2019".
- **Verdict:** 11.9 ft NAVD88 matches the **pre-redevelopment** surface (2004 about 11.8 ft; 2010 about 11.3 ft).
  - The latest USGS surface (March 2023 lidar, now served by 3DEP/EPQS) gives **about 12.9-13.1 ft NAVD88**. That is about 1.5-2 ft above the 2010 surface.
  - Park construction continued until the September 2025 opening, so the final as-built grade may differ. I found no published as-built grade for Cityside Park.
  - In any case, the pad is about 3.7-3.9 ft above the 9.2 ft BFE (2023 surface) and above the 9.2 ft open-space minimum.
  - **Replace 11.9 with about 13 ft NAVD88 (2023 3DEP lidar), and say the area was raised about 3 ft during the 2016-2025 redevelopment.**
