# Research notes: why tattoos don't wash off

Checked 2026-11-21 in a cloud session. The network there blocks pmc.ncbi.nlm.nih.gov, eurekalert.org and npr.org, so
the paper itself could not be opened. The facts below come from the abstract wording and press coverage quoted
in web search results. **Re-read the paper's abstract on the laptop before STOP 3** (FLAG 5).

## Facts used in the script

| # | Claim in the script | Source | Notes |
|---|---|---|---|
| 1 | The outer layer (epidermis) renews "every few weeks" | Medical News Today 318388; Business Insider explainer | Sources give 2-4 weeks; it is slower in older skin. The script stays vague on purpose. |
| 2 | The needle puts the ink deeper, in the dermis | Medical News Today; PopSci "where does tattoo ink go"; Dermatology Times | Usually 1.5-2 mm (one source gives 1-4 mm). The number is **not spoken**; it only sets the scale of the cut-away. |
| 3 | Immune cells called macrophages swallow the ink but can't digest it, so they hold it | Baranska et al. 2018 (abstract: "pigment-capturing cells are exclusively made of dermal macrophages"); Wikipedia "Tattoo removal" ("macrophages collect ink pigments, but have difficulty breaking them down. Instead, they store the ink pigments") | |
| 4 | Scientists killed those cells in tattooed mice; the tattoos didn't fade; new cells swallowed the released ink in the same place | Baranska et al. 2018 (abstract: pigment "can undergo successive cycles of capture-release-recapture without any tattoo vanishing"; persistence "likely relies on macrophage renewal rather than on macrophage longevity"); Institut Curie publication page; Science News | Mouse model: CD64-based, with macrophages removed by diphtheria toxin. Press coverage says the new macrophages took the pigment up "over the following weeks", "before it can disperse". |
| 5 | Lasers need many sessions because they must shatter the ink small enough for the cells to carry away | Wikipedia "Tattoo removal"; PMC4411587 (review); Karger chapter | Usually 5-10 sessions for amateur tattoos and 15-20 for professional ones, spaced weeks apart while fragments clear through the lymph. Not spoken: "so many sessions". |

## Sources

1. Baranska A. et al., "Unveiling skin macrophage dynamics explains both tattoo persistence and strenuous removal",
   *Journal of Experimental Medicine* 215(4), 2018. doi:10.1084/jem.20171608.
   https://pmc.ncbi.nlm.nih.gov/articles/PMC5881476 ·
   https://institut-curie.org/publications/unveiling-skin-macrophage-dynamics-explains-both-tattoo-persistence-and-strenuous-removal
2. Collin M., companion Insight in the same issue (it suggests blocking macrophage recruitment to help laser removal).
   https://rupress.org/jem/article-pdf/215/4/1005/1170126/jem_20180311.pdf
3. Science News, "Inked mice hint at how tattoos persist in people".
   https://www.sciencenews.org/article/inked-mice-hint-how-tattoos-persist-people
4. NPR, "Tattoo you: immune system cells help keep ink in its place" (2018-03-08).
   https://www.npr.org/sections/health-shots/2018/03/08/591315450/tattoo-you-immune-system-cells-help-keep-ink-in-its-place
5. Wikipedia, "Tattoo removal". https://en.wikipedia.org/wiki/Tattoo_removal
6. Review on laser tattoo removal. https://pmc.ncbi.nlm.nih.gov/articles/PMC4411587
7. Medical News Today, tattoos and skin. https://www.medicalnewstoday.com/articles/318388
8. PopSci, "Where does tattoo ink go in your body". https://www.popsci.com/science/where-does-tattoo-ink-go-in-your-body
9. BBC Science Focus, "Why do tattoos fade?". https://www.sciencefocus.com/the-human-body/why-do-tattoos-fade/

## FLAGs

1. **The study used mice, not people.** Science News points out that human macrophages may live longer than mouse
   ones. The script says "in tattooed mice", so it never claims the experiment was done on people.
2. **Turnover time.** Sources give 2-4 weeks, and some give longer for older skin, so the script says "every few weeks".
3. **How lasers work.** A review notes some disagreement about exactly how laser treatment reduces pigment.
   "Shatter the ink small enough for those cells to carry away" is the standard explanation (Wikipedia, clinic and
   review sources).
4. **How much ink travels to lymph nodes.** Sources disagree widely (about 68% still in place after 42 days in one
   report, while another says 60-90% eventually leaves). This isn't used in the script.
5. **The paper wasn't read directly** (network block, see top). Wording comes from the abstract as quoted in search results.
6. **Already covered?** Kurzgesagt ("Your Tattoo is INSIDE Your Immune System. Literally") and SciShow have made
   long videos on this topic. A web search found **no Zack D. Films video** about tattoos, but that check isn't
   conclusive (vidIQ ran out of credits before the channel's full list could be pulled). Search the channel for
   "tattoo" on YouTube to be sure. Our angle is different anyway: a 30-40 s Short built around the mouse experiment,
   ending on why lasers need so many sessions.
7. **Where the mice were tattooed.** The S02 inset shows a lab mouse with a tattooed tail band, which is the usual
   way lab mice are tattooed. The search results didn't say which body part the 2018 study used, so check the
   paper's methods on the laptop. If it wasn't the tail, move the band in `makeMouse` (`scenes/3d/lib/cut.js`).
   The narration doesn't depend on it.
