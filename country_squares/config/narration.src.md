# Narration source: every country as a square (vertical Short)

> Edit this file, then `python build.py narration`. One line = one beat (a paragraph; 0.8 s after it).
> Sentences inside a beat get 0.4 s. `@pause N` adds silence after the previous beat. `@lead N` adds a picture-only
> moment before the next beat. Every number is a {{fact}} token, and no decimal is ever spoken.
> v1 (2026-11-07). Rules carried over from the earlier Shorts: the hook lands in the first sentence; every sentence
> after it opens with a link to the one before; no fragments, colon reveals or mic-drop kickers; one number per idea.
> Brief (user): the hook is how every country looks as a square, then the queue of countries, then some of the
> largest and a few of the smallest.
> Spine: the map turns into squares -> line them up, 4,100 km down to an eight-minute walk -> Russia 71% bigger than
> Canada -> Canada / US / China nearly equal -> first six hold 47% -> India 7th, Russia holds it 5 times -> the middle
> (Malawi, a twelfth as wide) -> the tiny ones (San Marino, Tuvalu, Nauru < 8 km; Monaco 1.5 km) -> Vatican City 663 m, 39 million in
> Russia -> where is yours? (loops back to the map)

## S00 · Every country as a square
@scene S00_Hook
@lead 0.4
If you squeezed every country into a perfect square with exactly the same area, the world would look like this.
@pause 0.6
And lined up from biggest to smallest, all {{n.countries}} of them run from a square about {{side.ru|round:-2}} kilometers wide to one you could walk across in about {{va.walk_min|round:0|word}} minutes.

## S01 · The giants
@scene S01_Giants
At the front, Russia's square is {{x.ru_ca|pct}} bigger than Canada's, even though Canada comes second.
Then Canada, the United States and China are almost triplets, because their areas are within about {{x.ca_cn|pct}} of each other.
And with Brazil and Australia, those six squares already hold {{x.top6|pct}} of the area of all {{n.countries}} countries.

## S02 · Down the queue
@scene S02_Middle
From there the squares shrink fast, so India, in {{rank.in|ord}} place, fits into Russia more than {{x.ru_in|floor:0|word}} times.
And halfway down, at number {{rank.mw}}, Malawi's square is only {{x.ru_mw_side|round:0|frac}} as wide as Russia's.

## S03 · The tiny ones
@scene S03_Tiny
But the real surprise is at the back, where San Marino, Tuvalu and Nauru all have squares less than {{side.sm|ceil:0|word}} kilometers wide.
Then Monaco's is only about {{side.mc|mixed}} kilometers across.
And last comes Vatican City, whose square is just {{side.va_m|round:0}} meters wide, so Russia could hold it about {{x.ru_va|sigwords:2}} times.

## S04 · Where is yours
@scene S04_Loop
And that's the whole queue, from Russia to Vatican City, so where does your country stand?
