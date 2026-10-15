# Research notes: "The flat Starlink antenna that steers without moving"

Checked 2026-10-15. The fetch tool in this cloud session cannot resolve arxiv.org or wikipedia.org, so the
sourced values below were confirmed through web-search results that quote the page, not by opening the page
itself. Physics numbers are computed in `config/facts.py` (run `python config/facts.py`).

| Claim in the Short | Value used | Source | Notes / caveats |
|---|---|---|---|
| A flat panel on a roof that "never turns to follow anything" | Flat Starlink Standard (Gen 3) has no motors, only a kickstand | [Powertec equipment page](https://portal.powertec.com.au/equipment/it-networking/network-devices/starlink-standard-flat-dish-gen-3-rev4) | The older *Standard Actuated* dish has motors that tilt the whole panel to face the sky. They orient it; they do not chase each satellite. Satellite tracking is electronic on all of them. |
| Starlink steers the signal, not the dish | Electronically steered Ku-band phased array | [SpaceX FCC application, as reported by Slashdot](https://tech.slashdot.org/story/20/03/23/2322201/spacex-gets-fcc-license-for-1-million-satellite-broadband-user-terminals); [Orbital Radar glossary](https://orbitalradar.com/glossary/user-terminal); [Hackaday on the Keiter teardown](https://hackaday.com/blog/page/2642) | FCC filing describes phased-array beamforming and digital processing forming steered beams that follow the satellites. |
| Satellite crosses the sky at 27,000 km/h | 7.59 km/s = **27,320 km/h** at 550 km | Computed from Earth's gravitational parameter; [APNIC / Geoff Huston slides](https://labs.apnic.net/presentations/store/2024-04-12-starlink.pdf) say about 27,000 km/h at 550 km | Most satellites fly 540–570 km after the 2025 FCC order. Orbit period 95.5 min matches "just over 95 minutes". |
| "In a few minutes it will be gone" | Overhead pass above 25° elevation = **4.5 min** computed; APNIC says a satellite crosses the visible aperture for at most about 3 min | [APNIC slides](https://labs.apnic.net/presentations/store/2024-04-12-starlink.pdf) | "A few minutes" covers both. The minimum elevation may now be lower than 25° after the FCC order. |
| Ripples: crest + crest rises, crest + trough cancels | Superposition of waves | Standard physics | Shown with a live simulation (`web/main.js`, sum of cosines from every source). |
| A row of sources adds up only straight ahead | In-phase sources reinforce broadside and cancel elsewhere | Standard array theory | The panel sits on a ground plane, so only the forward half-plane is drawn. Edge and side effects at the sides are real and visible. |
| Each stone a split second after its neighbor tilts the wave | Progressive delay `Δt = d·sin θ / c` | Standard array theory (the Orbital Radar glossary describes the same per-element phase idea) | Real hardware uses per-element phase shifters. For a narrowband signal a phase shift and a time delay are the same thing. |
| "Trillionths of a second" between neighbours | **7 ps at 10° up to 37 ps at 60°** (spacing λ/2, 11.7 GHz); 43 ps at 90° = half a wave period | Computed in `config/facts.py` | Spacing of λ/2 is the usual design rule, not a published Starlink spec. The video says "trillionths" and never gives a count. |
| Radio waves about 2.5 cm | λ = 25.6 mm at 11.7 GHz (downlink); 21.0 mm at 14.25 GHz (uplink) | Ku-band: receive in 10.7–12.7 GHz, transmit in 14.0–14.5 GHz ([Powertec spec listing](https://portal.powertec.com.au/equipment/it-networking/network-devices/starlink-standard-actuated-dish-gen-3-v2)) | Frequencies come from reseller spec pages, which repeat the FCC filings. Shown on screen only. |
| The beam follows the satellite, then the panel aims at the next one | Terminals are assigned to satellites in 15-second slots by a global scheduler | [Pan et al., "Making Sense of Constellations" (CoNEXT 2023)](https://arxiv.org/pdf/2307.00402); [APNIC slides](https://labs.apnic.net/presentations/store/2024-04-12-starlink.pdf) | The narration does not quote 15 s. Measurement papers disagree on whether reconfiguration and satellite handover are the same event, so the video stays general. |
| A satellite "that never slows down" | Circular orbit, constant speed | Orbital mechanics | Slight speed changes exist for non-circular orbits; Starlink shells are near circular. |

## Deliberately not claimed
- **Number of antenna elements.** No source I could open confirmed it. The drawn array (24 elements) is labelled on screen as a simplified drawing.
- **Exact steering range / field of view.** Reseller pages list 110° for the Standard dish and 140° for another model; neither is a SpaceX document, so it is not used.
- **Any beam width, gain or power.**

## Honesty notes shown on screen
- "time-lapse · satellite and panel not to scale" (sky scenes)
- "water ripples slowed down for the video" (pond) and "waves slowed down · simplified drawing: 24 antennas" (radio)
- The field is a 2-D top-down slice of what is really a 3-D beam, and the array tapers its edge elements the way real arrays do, so the beam is clean.
- Angles and delays on screen are computed live from the drawn geometry (`delay = sin(angle) / (2 × 11.7 GHz)`); the satellite path is a stylised arc, not a real ground track.
