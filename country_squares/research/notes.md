# Research notes: every country as a square

## Sources

| Tag | Source | Used for |
|---|---|---|
| [CIA] | CIA World Factbook, **final edition**. The CIA discontinued the Factbook in February 2026; the [factbook.json](https://github.com/factbook/factbook.json) mirror keeps its last data (commit `144d6977`, 2026-09-11). Public domain (US government work). The area lines of every entry are saved verbatim in `research/sources/factbook_areas.json`. | Every area ("Area: total" = land + inland water), UN membership (each entry's "International organization participation" line) |
| [NE] | Natural Earth 1:50m Admin 0 – Countries (public domain), sha256 in `data/countries.json`. | Outlines on the map only. No size in the Short comes from these shapes |
| [EE] | Šavrič, Patterson & Jenny (2018), *The Equal Earth map projection*, IJGIS 33(3). Authalic latitude for WGS84 from Snyder (1987), *Map Projections: A Working Manual*, USGS PP 1395. | The map. Equal-area, so a square of the right area is to scale with the map (`tests/test_geo.py`: within 0.02% of the WGS84 geodesic area at every latitude tested) |
| [WALK] | A typical walking pace of 5 km/h (1.39 m/s). Comfortable adult walking speed is usually given as about 1.3–1.5 m/s (e.g. Bohannon 1997, *Age and Ageing* 26). | "you could walk across in about eight minutes" (663 m at 5 km/h = 7.96 min; at 1.3–1.5 m/s it is 7.4–8.5 min) |
| [FLAGS] | flag-icons 7.6.0 (lipis/flag-icons, MIT), the square 1x1 SVGs. | The flags on the squares |
| [VA] | Secondary sources agree on 0.44 km² (44 ha) for Vatican City, e.g. [Britannica](https://www.britannica.com:443/facts/Vatican-City), [Nations Online](https://www.nationsonline.org/oneworld/vatican.htm). The vaticanstate.va page itself was not reached. | Cross-check of the Factbook's 0.44 |
| [MC] | Monaco is 2.08 km² (208 ha) since the Mareterra extension opened on 4 December 2024 ([petrini.mc](https://www.petrini.mc/en/area-monaco.html), [Paris Match](https://www.parismatch.be/actualites/2024/12/07/monaco-inaugure-son-nouveau-quartier-impressionant-mareterra-un-projet-revolutionnaire-sur-la-mer-CJ7DA7YJCZDEJMSC56YMLNOK2U/)). | Cross-check of the Factbook's 2 sq km (FLAG 5) |

## FLAGs (choices a viewer could question)

1. **Which 195.** The 193 UN member states plus the two UN observer states, the Holy See and Palestine. This is the
   usual "195 countries". Taiwan, Kosovo and Western Sahara are not in the queue. Dependencies such as Greenland,
   Puerto Rico and New Caledonia aren't either. They are drawn on the map in grey ("other land") and fade out when
   the countries become squares.
2. **Total area, not land area.** The Factbook's "total" includes inland water (lakes, rivers, reservoirs). On land
   area alone, China (9,326,410) is bigger than the United States (9,147,593), so places 3 and 4 swap. The script only
   says those three are "almost triplets" (all within 4% of each other on total area) and never ranks the US above
   China out loud. The on-screen labels follow the Factbook order.
3. **Morocco.** Since 2021 the Factbook's Morocco total (716,550 sq km) includes Western Sahara, which the Factbook also
   lists separately (266,000 sq km) and the UN treats as a non-self-governing territory. The Short counts Morocco as
   716,550 − 266,000 = **450,550 km²** (rank 55, not 39). Natural Earth's default Morocco outline also runs into
   Western Sahara, so the map cuts it at Western Sahara's northern border, the parallel 27°40′ N.
4. **Vatican City.** The Factbook prints "total: 0 sq km" (rounded) and "land: 0.44 sq km". The Short uses 0.44, which
   matches the usual figure of 44 ha [VA]. The other figure in circulation is 0.49 km² (it includes extraterritorial
   ground). With 0.49 the square would be 700 m, still about an eight-minute walk, but Russia would hold 35 million
   Vatican Cities, not 39 million.
5. **Monaco.** The Factbook says 2 sq km (rounded). Monaco has been 2.08 km² since Mareterra (December 2024) [MC]. The
   square is then 1.44 km instead of 1.41 km, so "about one and a half kilometers" and the on-screen "1.4 km" both
   still hold. Its rank (194th) doesn't change.
6. **What "total" covers per country.** These follow the Factbook. France 643,801 includes its five overseas regions
   (metropolitan France alone is 551,500). Norway 323,802 excludes Svalbard and Jan Mayen, but Natural Earth's outline
   includes them, so they shrink into Norway's square (`tests/test_geo.py` lists this as the one shape exception).
   Denmark excludes Greenland and the Faroes, and the United Kingdom excludes its overseas territories. China excludes
   Taiwan, Hong Kong and Macau. Russia excludes Crimea. India (3,287,263) is India's own figure, which includes all of
   Kashmir, so a little disputed ground counts for two countries. Palestine is the West Bank plus the Gaza Strip
   (5,860 + 360 = 6,220). The Palestinian Central Bureau of Statistics gives 6,020.
7. **"47 percent of the area of all 195 countries".** This is the first six's share of the sum of the 195 Factbook
   totals, 133.8 million km². That sum includes inland water and excludes Antarctica, Greenland and the other
   territories. It is not 47% of Earth's land.
8. **"Russia holds India more than five times"** is by area (5.20). As whole squares only four Indias fit inside
   Russia's square. The picture shows the comparison as a nested outline with "5.2×", not as tiled squares.
9. **"A twelfth as wide"** is Russia's side over Malawi's (4,135 / 344.2 = 12.01). The 12 Malawi flags drawn across
   Russia's width are exact.
10. **Where the squares sit on the map.** Each square is centred on the centroid of its country's largest landmass,
    and islands shrink into it. In Europe and the Caribbean the squares overlap, which is expected: a square of the
    same area can't fit where the country's real shape does.
