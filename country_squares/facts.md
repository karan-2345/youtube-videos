# Facts: every country as a square

> **Generated file** (`python -m config.facts`). Inputs carry a source tag (research/notes.md); everything else is computed in `config/facts.py` from `data/countries.json`.

Factbook mirror commit `144d6977b2b0`; Natural Earth 1:50m sha256 `3e458fc036ad`.


## The queue

| Key | Value | Unit | What | Source |
|---|---:|---|---|---|
| `n.countries` | 195 | countries | UN member states + UN observer states | computed |
| `n.members` | 193 | countries | UN member states | computed |
| `n.observers` | 2 | countries | the Holy See and Palestine | computed |
| `a.all` | 133,800,620 | km² | the 195 areas added up | computed |

## Areas (CIA World Factbook, final edition, 'Area: total')

| Key | Value | Unit | What | Source |
|---|---:|---|---|---|
| `a.ru` | 1.70982e+07 | km² | Russia: 17,098,242 sq km | [CIA] |
| `rank.ru` | 1 |  | Russia's place in the queue | computed |
| `side.ru` | 4,135 | km | side of Russia's square | computed |
| `a.ca` | 9.98467e+06 | km² | Canada: 9,984,670 sq km | [CIA] |
| `rank.ca` | 2 |  | Canada's place in the queue | computed |
| `side.ca` | 3,160 | km | side of Canada's square | computed |
| `a.us` | 9.83352e+06 | km² | United States: 9,833,517 sq km | [CIA] |
| `rank.us` | 3 |  | United States's place in the queue | computed |
| `side.us` | 3,136 | km | side of United States's square | computed |
| `a.cn` | 9.59696e+06 | km² | China: 9,596,960 sq km | [CIA] |
| `rank.cn` | 4 |  | China's place in the queue | computed |
| `side.cn` | 3,098 | km | side of China's square | computed |
| `a.br` | 8.51577e+06 | km² | Brazil: 8,515,770 sq km | [CIA] |
| `rank.br` | 5 |  | Brazil's place in the queue | computed |
| `side.br` | 2,918 | km | side of Brazil's square | computed |
| `a.au` | 7.74122e+06 | km² | Australia: 7,741,220 sq km | [CIA] |
| `rank.au` | 6 |  | Australia's place in the queue | computed |
| `side.au` | 2,782 | km | side of Australia's square | computed |
| `a.in` | 3.28726e+06 | km² | India: 3,287,263 sq km | [CIA] |
| `rank.in` | 7 |  | India's place in the queue | computed |
| `side.in` | 1,813 | km | side of India's square | computed |
| `a.mw` | 118,484 | km² | Malawi: 118,484 sq km | [CIA] |
| `rank.mw` | 98 |  | Malawi's place in the queue | computed |
| `side.mw` | 344.2 | km | side of Malawi's square | computed |
| `a.mt` | 316 | km² | Malta: 316 sq km | [CIA] |
| `rank.mt` | 186 |  | Malta's place in the queue | computed |
| `side.mt` | 17.78 | km | side of Malta's square | computed |
| `a.li` | 160 | km² | Liechtenstein: 160 sq km | [CIA] |
| `rank.li` | 190 |  | Liechtenstein's place in the queue | computed |
| `side.li` | 12.65 | km | side of Liechtenstein's square | computed |
| `a.sm` | 61 | km² | San Marino: 61 sq km | [CIA] |
| `rank.sm` | 191 |  | San Marino's place in the queue | computed |
| `side.sm` | 7.81 | km | side of San Marino's square | computed |
| `a.tv` | 26 | km² | Tuvalu: 26 sq km | [CIA] |
| `rank.tv` | 192 |  | Tuvalu's place in the queue | computed |
| `side.tv` | 5.099 | km | side of Tuvalu's square | computed |
| `a.nr` | 21 | km² | Nauru: 21 sq km | [CIA] |
| `rank.nr` | 193 |  | Nauru's place in the queue | computed |
| `side.nr` | 4.583 | km | side of Nauru's square | computed |
| `a.mc` | 2 | km² | Monaco: 2 sq km | [CIA] |
| `rank.mc` | 194 |  | Monaco's place in the queue | computed |
| `side.mc` | 1.414 | km | side of Monaco's square | computed |
| `a.va` | 0.44 | km² | Vatican City: 0 sq km (the land figure) | [CIA] |
| `rank.va` | 195 |  | Vatican City's place in the queue | computed |
| `side.va` | 0.6633 | km | side of Vatican City's square | computed |
| `side.va_m` | 663 | m | side of Vatican City's square, in metres | computed |

## Comparisons

| Key | Value | Unit | What | Source |
|---|---:|---|---|---|
| `x.ru_ca` | 0.712 |  | how much bigger Russia's square is than Canada's (area) | computed |
| `x.ca_cn` | 0.0404 |  | Canada vs China, the spread of places 2-4 (area) | computed |
| `x.top6` | 0.4691 |  | share of the queue's area in the first six | computed |
| `x.ru_in` | 5.201 | x | Russia's area / India's | computed |
| `rank.median` | 98 |  | the middle of the queue | computed |
| `x.ru_mw_side` | 12.013 | x | Russia's square is this many times as wide as Malawi's | computed |
| `x.ru_va` | 38,859,641 | x | Vatican Cities that fit in Russia (area) | computed |
| `x.ru_va_side` | 6,234 | x | Russia's square is this many times as wide as Vatican City's (the camera's zoom) | computed |
| `walk.kmh` | 5.0 | km/h | a typical walking pace | [WALK] |
| `va.walk_min` | 7.96 | min | walking across Vatican City's square | computed |

## Checks: 12/12 pass

| | Check | Result |
|---|---|---|
| PASS | 195 countries = 193 UN members + 2 UN observer states | 195 = 193 + 2 |
| PASS | the first six: Russia, Canada, United States, China, Brazil, Australia | Russia, Canada, United States, China, Brazil, Australia |
| PASS | India is 7th | 7 |
| PASS | Malawi is the middle (98th of 195) | Malawi |
| PASS | the last nine end Liechtenstein, San Marino, Tuvalu, Nauru, Monaco, Vatican City | Maldives, St Kitts & Nevis, Marshall Islands, Liechtenstein, San Marino, Tuvalu, Nauru, Monaco, Vatican City |
| PASS | Canada, the US and China within 5% of each other (said: 'within about 4 percent') | 4.04% |
| PASS | San Marino, Tuvalu and Nauru: squares less than eight kilometres wide | 7.81 / 5.10 / 4.58 km |
| PASS | Monaco's square is about one and a half kilometres wide (1.25-1.75) | 1.41 km |
| PASS | Russia holds more than 'five times' India | 5.20 |
| PASS | Malawi's square is about a twelfth as wide as Russia's (11.5-12.5) | 12.01 |
| PASS | Vatican City walk rounds to eight minutes | 7.96 min |
| PASS | the queue is sorted by area |  |

## The queue

| # | Country | Area (km²) | Square side | Factbook text |
|---:|---|---:|---:|---|
| 1 | Russia | 17,098,242.00 | 4,135.0 km | 17,098,242 sq km |
| 2 | Canada | 9,984,670.00 | 3,159.9 km | 9,984,670 sq km |
| 3 | United States | 9,833,517.00 | 3,135.8 km | 9,833,517 sq km |
| 4 | China | 9,596,960.00 | 3,097.9 km | 9,596,960 sq km |
| 5 | Brazil | 8,515,770.00 | 2,918.2 km | 8,515,770 sq km |
| 6 | Australia | 7,741,220.00 | 2,782.3 km | 7,741,220 sq km |
| 7 | India | 3,287,263.00 | 1,813.1 km | 3,287,263 sq km |
| 8 | Argentina | 2,780,400.00 | 1,667.5 km | 2,780,400 sq km |
| 9 | Kazakhstan | 2,724,900.00 | 1,650.7 km | 2,724,900 sq km |
| 10 | Algeria | 2,381,740.00 | 1,543.3 km | 2,381,740 sq km |
| 11 | DR Congo | 2,344,858.00 | 1,531.3 km | 2,344,858 sq km |
| 12 | Saudi Arabia | 2,149,690.00 | 1,466.2 km | 2,149,690 sq km |
| 13 | Mexico | 1,964,375.00 | 1,401.6 km | 1,964,375 sq km |
| 14 | Indonesia | 1,904,569.00 | 1,380.1 km | 1,904,569 sq km |
| 15 | Sudan | 1,861,484.00 | 1,364.4 km | 1,861,484 sq km |
| 16 | Libya | 1,759,540.00 | 1,326.5 km | 1,759,540 sq km |
| 17 | Iran | 1,648,195.00 | 1,283.8 km | 1,648,195 sq km |
| 18 | Mongolia | 1,564,116.00 | 1,250.6 km | 1,564,116 sq km |
| 19 | Peru | 1,285,216.00 | 1,133.7 km | 1,285,216 sq km |
| 20 | Chad | 1,284,000.00 | 1,133.1 km | 1.284 million sq km |
| 21 | Niger | 1,267,000.00 | 1,125.6 km | 1.267 million sq km |
| 22 | Angola | 1,246,700.00 | 1,116.6 km | 1,246,700 sq km |
| 23 | Mali | 1,240,192.00 | 1,113.6 km | 1,240,192 sq km |
| 24 | South Africa | 1,219,090.00 | 1,104.1 km | 1,219,090 sq km |
| 25 | Colombia | 1,138,910.00 | 1,067.2 km | 1,138,910 sq km |
| 26 | Ethiopia | 1,104,300.00 | 1,050.9 km | 1,104,300 sq km |
| 27 | Bolivia | 1,098,581.00 | 1,048.1 km | 1,098,581 sq km |
| 28 | Mauritania | 1,030,700.00 | 1,015.2 km | 1,030,700 sq km |
| 29 | Egypt | 1,001,450.00 | 1,000.7 km | 1,001,450 sq km |
| 30 | Tanzania | 947,300.00 | 973.3 km | 947,300 sq km |
| 31 | Nigeria | 923,768.00 | 961.1 km | 923,768 sq km |
| 32 | Venezuela | 912,050.00 | 955.0 km | 912,050 sq km |
| 33 | Namibia | 824,292.00 | 907.9 km | 824,292 sq km |
| 34 | Mozambique | 799,380.00 | 894.1 km | 799,380 sq km |
| 35 | Pakistan | 796,095.00 | 892.2 km | 796,095 sq km |
| 36 | Türkiye | 783,562.00 | 885.2 km | 783,562 sq km |
| 37 | Chile | 756,102.00 | 869.5 km | 756,102 sq km |
| 38 | Zambia | 752,618.00 | 867.5 km | 752,618 sq km |
| 39 | Myanmar | 676,578.00 | 822.5 km | 676,578 sq km |
| 40 | Afghanistan | 652,230.00 | 807.6 km | 652,230 sq km |
| 41 | South Sudan | 644,329.00 | 802.7 km | 644,329 sq km |
| 42 | France | 643,801.00 | 802.4 km | 643,801 sq km ; 551,500 sq km (metropolitan France) |
| 43 | Somalia | 637,657.00 | 798.5 km | 637,657 sq km |
| 44 | none | 622,984.00 | 789.3 km | 622,984 sq km |
| 45 | Ukraine | 603,550.00 | 776.9 km | 603,550 sq km |
| 46 | Madagascar | 587,041.00 | 766.2 km | 587,041 sq km |
| 47 | Botswana | 581,730.00 | 762.7 km | 581,730 sq km |
| 48 | Kenya | 580,367.00 | 761.8 km | 580,367 sq km |
| 49 | Yemen | 527,968.00 | 726.6 km | 527,968 sq km |
| 50 | Thailand | 513,120.00 | 716.3 km | 513,120 sq km |
| 51 | Spain | 505,370.00 | 710.9 km | 505,370 sq km |
| 52 | Turkmenistan | 488,100.00 | 698.6 km | 488,100 sq km |
| 53 | Cameroon | 475,440.00 | 689.5 km | 475,440 sq km |
| 54 | Papua New Guinea | 462,840.00 | 680.3 km | 462,840 sq km |
| 55 | Morocco | 450,550.00 | 671.2 km | 716,550 sq km (total minus Western Sahara (266,000 sq km)) |
| 56 | Sweden | 450,295.00 | 671.0 km | 450,295 sq km |
| 57 | Uzbekistan | 447,400.00 | 668.9 km | 447,400 sq km |
| 58 | Iraq | 438,317.00 | 662.1 km | 438,317 sq km |
| 59 | Paraguay | 406,752.00 | 637.8 km | 406,752 sq km |
| 60 | Zimbabwe | 390,757.00 | 625.1 km | 390,757 sq km |
| 61 | Japan | 377,915.00 | 614.7 km | 377,915 sq km |
| 62 | Germany | 357,022.00 | 597.5 km | 357,022 sq km |
| 63 | Congo | 342,000.00 | 584.8 km | 342,000 sq km |
| 64 | Finland | 338,145.00 | 581.5 km | 338,145 sq km |
| 65 | Vietnam | 331,210.00 | 575.5 km | 331,210 sq km |
| 66 | Malaysia | 329,847.00 | 574.3 km | 329,847 sq km |
| 67 | Norway | 323,802.00 | 569.0 km | 323,802 sq km |
| 68 | Côte d'Ivoire | 322,463.00 | 567.9 km | 322,463 sq km |
| 69 | Poland | 312,685.00 | 559.2 km | 312,685 sq km |
| 70 | Oman | 309,500.00 | 556.3 km | 309,500 sq km |
| 71 | Italy | 301,340.00 | 548.9 km | 301,340 sq km |
| 72 | Philippines | 300,000.00 | 547.7 km | 300,000 sq km |
| 73 | Ecuador | 283,561.00 | 532.5 km | 283,561 sq km |
| 74 | Burkina Faso | 274,200.00 | 523.6 km | 274,200 sq km |
| 75 | New Zealand | 268,838.00 | 518.5 km | 268,838 sq km |
| 76 | Gabon | 267,667.00 | 517.4 km | 267,667 sq km |
| 77 | Guinea | 245,857.00 | 495.8 km | 245,857 sq km |
| 78 | United Kingdom | 243,610.00 | 493.6 km | 243,610 sq km |
| 79 | Uganda | 241,038.00 | 491.0 km | 241,038 sq km |
| 80 | Ghana | 238,533.00 | 488.4 km | 238,533 sq km |
| 81 | Romania | 238,391.00 | 488.3 km | 238,391 sq km |
| 82 | Laos | 236,800.00 | 486.6 km | 236,800 sq km |
| 83 | Guyana | 214,969.00 | 463.6 km | 214,969 sq km |
| 84 | Belarus | 207,600.00 | 455.6 km | 207,600 sq km |
| 85 | Kyrgyzstan | 199,951.00 | 447.2 km | 199,951 sq km |
| 86 | Senegal | 196,722.00 | 443.5 km | 196,722 sq km |
| 87 | Syria | 187,437.00 | 432.9 km | 187,437 sq km |
| 88 | Cambodia | 181,035.00 | 425.5 km | 181,035 sq km |
| 89 | Uruguay | 176,215.00 | 419.8 km | 176,215 sq km |
| 90 | Suriname | 163,820.00 | 404.7 km | 163,820 sq km |
| 91 | Tunisia | 163,610.00 | 404.5 km | 163,610 sq km |
| 92 | Bangladesh | 148,460.00 | 385.3 km | 148,460 sq km |
| 93 | Nepal | 147,181.00 | 383.6 km | 147,181 sq km |
| 94 | Tajikistan | 144,100.00 | 379.6 km | 144,100 sq km |
| 95 | Greece | 131,957.00 | 363.3 km | 131,957 sq km |
| 96 | Nicaragua | 130,370.00 | 361.1 km | 130,370 sq km |
| 97 | North Korea | 120,538.00 | 347.2 km | 120,538 sq km |
| 98 | Malawi | 118,484.00 | 344.2 km | 118,484 sq km |
| 99 | Eritrea | 117,600.00 | 342.9 km | 117,600 sq km |
| 100 | Benin | 112,622.00 | 335.6 km | 112,622 sq km |
| 101 | Honduras | 112,090.00 | 334.8 km | 112,090 sq km |
| 102 | Liberia | 111,369.00 | 333.7 km | 111,369 sq km |
| 103 | Bulgaria | 110,879.00 | 333.0 km | 110,879 sq km |
| 104 | Cuba | 110,860.00 | 333.0 km | 110,860 sq km |
| 105 | Guatemala | 108,889.00 | 330.0 km | 108,889 sq km |
| 106 | Iceland | 103,000.00 | 320.9 km | 103,000 sq km |
| 107 | South Korea | 99,720.00 | 315.8 km | 99,720 sq km |
| 108 | Hungary | 93,028.00 | 305.0 km | 93,028 sq km |
| 109 | Portugal | 92,090.00 | 303.5 km | 92,090 sq km |
| 110 | Jordan | 89,342.00 | 298.9 km | 89,342 sq km |
| 111 | Azerbaijan | 86,600.00 | 294.3 km | 86,600 sq km |
| 112 | Austria | 83,871.00 | 289.6 km | 83,871 sq km |
| 113 | UAE | 83,600.00 | 289.1 km | 83,600 sq km |
| 114 | Czechia | 78,867.00 | 280.8 km | 78,867 sq km |
| 115 | Serbia | 77,474.00 | 278.3 km | 77,474 sq km |
| 116 | Panama | 75,420.00 | 274.6 km | 75,420 sq km |
| 117 | Sierra Leone | 71,740.00 | 267.8 km | 71,740 sq km |
| 118 | Ireland | 70,273.00 | 265.1 km | 70,273 sq km |
| 119 | Georgia | 69,700.00 | 264.0 km | 69,700 sq km |
| 120 | Sri Lanka | 65,610.00 | 256.1 km | 65,610 sq km |
| 121 | Lithuania | 65,300.00 | 255.5 km | 65,300 sq km |
| 122 | Latvia | 64,589.00 | 254.1 km | 64,589 sq km |
| 123 | Togo | 56,785.00 | 238.3 km | 56,785 sq km |
| 124 | Croatia | 56,594.00 | 237.9 km | 56,594 sq km |
| 125 | Bosnia & Herzegovina | 51,197.00 | 226.3 km | 51,197 sq km |
| 126 | Costa Rica | 51,100.00 | 226.1 km | 51,100 sq km |
| 127 | Slovakia | 49,035.00 | 221.4 km | 49,035 sq km |
| 128 | Dominican Republic | 48,670.00 | 220.6 km | 48,670 sq km |
| 129 | Estonia | 45,228.00 | 212.7 km | 45,228 sq km |
| 130 | Denmark | 43,094.00 | 207.6 km | 43,094 sq km |
| 131 | Netherlands | 41,543.00 | 203.8 km | 41,543 sq km |
| 132 | Switzerland | 41,277.00 | 203.2 km | 41,277 sq km |
| 133 | Bhutan | 38,394.00 | 195.9 km | 38,394 sq km |
| 134 | Guinea-Bissau | 36,125.00 | 190.1 km | 36,125 sq km |
| 135 | Moldova | 33,851.00 | 184.0 km | 33,851 sq km |
| 136 | Belgium | 30,528.00 | 174.7 km | 30,528 sq km |
| 137 | Lesotho | 30,355.00 | 174.2 km | 30,355 sq km |
| 138 | Armenia | 29,743.00 | 172.5 km | 29,743 sq km |
| 139 | Solomon Islands | 28,896.00 | 170.0 km | 28,896 sq km |
| 140 | Albania | 28,748.00 | 169.6 km | 28,748 sq km |
| 141 | Equatorial Guinea | 28,051.00 | 167.5 km | 28,051 sq km |
| 142 | Burundi | 27,830.00 | 166.8 km | 27,830 sq km |
| 143 | Haiti | 27,750.00 | 166.6 km | 27,750 sq km |
| 144 | Rwanda | 26,338.00 | 162.3 km | 26,338 sq km |
| 145 | North Macedonia | 25,713.00 | 160.4 km | 25,713 sq km |
| 146 | Djibouti | 23,200.00 | 152.3 km | 23,200 sq km |
| 147 | Belize | 22,966.00 | 151.5 km | 22,966 sq km |
| 148 | Israel | 21,937.00 | 148.1 km | 21,937 sq km |
| 149 | El Salvador | 21,041.00 | 145.1 km | 21,041 sq km |
| 150 | Slovenia | 20,273.00 | 142.4 km | 20,273 sq km |
| 151 | Fiji | 18,274.00 | 135.2 km | 18,274 sq km |
| 152 | Kuwait | 17,818.00 | 133.5 km | 17,818 sq km |
| 153 | Eswatini | 17,364.00 | 131.8 km | 17,364 sq km |
| 154 | Timor-Leste | 14,874.00 | 122.0 km | 14,874 sq km |
| 155 | Bahamas | 13,880.00 | 117.8 km | 13,880 sq km |
| 156 | Montenegro | 13,812.00 | 117.5 km | 13,812 sq km |
| 157 | Vanuatu | 12,189.00 | 110.4 km | 12,189 sq km |
| 158 | Qatar | 11,586.00 | 107.6 km | 11,586 sq km |
| 159 | Gambia | 11,300.00 | 106.3 km | 11,300 sq km |
| 160 | Jamaica | 10,991.00 | 104.8 km | 10,991 sq km |
| 161 | Lebanon | 10,400.00 | 102.0 km | 10,400 sq km |
| 162 | Cyprus | 9,251.00 | 96.2 km | 9,251 sq km (of which 3,355 sq km are in north Cyprus) |
| 163 | Palestine | 6,220.00 | 78.9 km | 360 sq km + 5,860 sq km |
| 164 | Brunei | 5,765.00 | 75.9 km | 5,765 sq km |
| 165 | Trinidad & Tobago | 5,128.00 | 71.6 km | 5,128 sq km |
| 166 | Cabo Verde | 4,033.00 | 63.5 km | 4,033 sq km |
| 167 | Samoa | 2,831.00 | 53.2 km | 2,831 sq km |
| 168 | Luxembourg | 2,586.00 | 50.9 km | 2,586 sq km |
| 169 | Comoros | 2,235.00 | 47.3 km | 2,235 sq km |
| 170 | Mauritius | 2,040.00 | 45.2 km | 2,040 sq km |
| 171 | São Tomé & Príncipe | 964.00 | 31.0 km | 964 sq km |
| 172 | Kiribati | 811.00 | 28.5 km | 811 sq km |
| 173 | Bahrain | 760.00 | 27.6 km | 760 sq km |
| 174 | Dominica | 751.00 | 27.4 km | 751 sq km |
| 175 | Tonga | 747.00 | 27.3 km | 747 sq km |
| 176 | Singapore | 719.00 | 26.8 km | 719 sq km |
| 177 | Micronesia | 702.00 | 26.5 km | 702 sq km |
| 178 | Saint Lucia | 616.00 | 24.8 km | 616 sq km |
| 179 | Andorra | 468.00 | 21.6 km | 468 sq km |
| 180 | Palau | 459.00 | 21.4 km | 459 sq km |
| 181 | Seychelles | 455.00 | 21.3 km | 455 sq km |
| 182 | Antigua & Barbuda | 443.00 | 21.0 km | 443 sq km (Antigua 280 sq km; Barbuda 161 sq km) |
| 183 | Barbados | 430.00 | 20.7 km | 430 sq km |
| 184 | St Vincent & Grenadines | 389.00 | 19.7 km | 389 sq km (Saint Vincent 344 sq km) |
| 185 | Grenada | 344.00 | 18.5 km | 344 sq km |
| 186 | Malta | 316.00 | 17.8 km | 316 sq km |
| 187 | Maldives | 298.00 | 17.3 km | 298 sq km |
| 188 | St Kitts & Nevis | 261.00 | 16.2 km | 261 sq km (Saint Kitts 168 sq km; Nevis 93 sq km) |
| 189 | Marshall Islands | 181.00 | 13.5 km | 181 sq km |
| 190 | Liechtenstein | 160.00 | 12.6 km | 160 sq km |
| 191 | San Marino | 61.00 | 7.8 km | 61 sq km |
| 192 | Tuvalu | 26.00 | 5.1 km | 26 sq km |
| 193 | Nauru | 21.00 | 4.6 km | 21 sq km |
| 194 | Monaco | 2.00 | 1.4 km | 2 sq km |
| 195 | Vatican City | 0.44 | 663 m | 0 sq km (land) |
