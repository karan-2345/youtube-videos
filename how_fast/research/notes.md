# Research notes: "How fast are you moving right now?"

Checked 2026-09-29. The network policy of this cloud session blocks direct access to nasa.gov, nhm.ac.uk and arxiv,
so each value below was confirmed through web-search results quoting the page, not by opening the page itself.
Numbers are computed in `config/facts.py`.

| Claim in the Short | Value used | Source | Notes / disagreement |
|---|---|---|---|
| Earth's equator spins at about 1,670 km/h | 2π × 6,378.137 km ÷ 23.9345 h = **1,674 km/h** | [NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) (equatorial radius, sidereal rotation period) | Uses the sidereal day (spin relative to the stars). Poles: 0 km/h. |
| Nearly twice as fast as a passenger jet | 787 cruise Mach 0.85 = **903 km/h** → ratio 1.85 | [Simple Flying, citing EASA data](https://simpleflying.com/how-fast-boeing-787/) | Airliners cruise at roughly 830–930 km/h; ratio stays 1.8–2.0. |
| We don't feel it: steady motion feels like standing still | Spin's inward acceleration at the equator = **0.35% of g** | Derived from the fact sheet values | On screen: "Earth's path does curve, but gently". |
| Earth circles the Sun at more than 100,000 km/h | Mean orbital velocity **29.78 km/s = 107,208 km/h** | [NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) | Ranges 29.29–30.29 km/s over the year. |
| A marathon in about a second and a half | 42.195 km ÷ 29.78 km/s = **1.42 s** | [World Athletics](https://worldathletics.org/disciplines/road-running/marathon), [Britannica](https://www.britannica.com/sports/marathon-race) | |
| The Sun carries us around the Milky Way at about 800,000 km/h | **828,000 km/h (230 km/s)** used for the counter | [NASA StarChild](https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question18.html) | **Estimates disagree**: [EarthSky](https://earthsky.org/astronomy-essentials/milky-way-rotation/) ~800,000 km/h; circular speed at the Sun 229 km/s ([Eilers et al. 2019](https://ui.adsabs.harvard.edu/abs/2019ApJ...871..120E/abstract)) or 236 ± 7 km/s ([Reid et al. 2019](https://ui.adsabs.harvard.edu/abs/2019ApJ...885..131R/abstract)); older quotes 782,000 km/h. On screen: "estimates range ≈ 780,000–900,000 km/h". |
| One lap takes around 230 million years | **230 Myr** | [NASA StarChild](https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question18.html) | EarthSky: 225–250 Myr; Reid 2019 geometry (2π × 8.15 kpc ÷ 236 km/s) gives ~212 Myr. On screen: "estimates ≈ 210–250 million years". |
| Last time we were here, the first dinosaurs were just starting out | Earliest dinosaurs **~231 Mya** (Herrerasaurus, Eoraptor) to **~245 Mya** | [NHM: When did dinosaurs live?](https://www.nhm.ac.uk/discover/when-did-dinosaurs-live.html), [Smithsonian](https://www.smithsonianmag.com/science-nature/eodromaeus-adds-context-to-dinosaur-origins-91973732/) | NHM says about 245 Mya; the oldest definite dinosaurs are ~231 Mya. Either way it overlaps one galactic year ago. |
| While you watched, about 2,000 km around the Sun | 29.78 km/s × video time (≈ 2,100 km at 70 s) | Derived | The on-screen counter shows the exact live value. |
| Through the galaxy, farther than Earth is wide | ≥ 217 km/s × time > **12,756 km** (Earth's equatorial diameter) | Derived | Holds even at the lowest speed estimate once the video passes 59 s. |

## Honesty notes shown on screen
- star motion sped up · spin sped up for the video · sizes and distances not to scale · galaxy is an illustration
- speed estimates vary (galaxy), one lap ≈ 210–250 million years
- counter uses Earth's mean orbital speed, 29.78 km/s
