# The rounding error that a fix made deadly (script v1, 469 words)
# One sentence per line. [display|spoken] swaps caption text for what the voice says,
# {#name} marks a visual event at the next word, "@pause s" sets the gap after the previous sentence,
# "## name" starts a section (scene). Voice: Kokoro af_heart, speed 0.95 (the Shorts voice).
# Every number is checked in checks/compute1.py; sources in research/notes.md.

## S00
{#type}If you type [0.1|zero point one] plus [0.2|zero point two] {#into}into most programming languages, the answer comes back as {#answer}[0.3|zero point three], then {#zeros}fifteen zeros, then a {#four}four, and in {#y1991}[1991|nineteen ninety-one] a flaw from the same family helped a missile get through an air [defence|defense] system and kill {#dead}28 American soldiers.
But the {#strange}strangest part is that the tiny error wasn't enough on its own, because it took an {#improve}attempt to improve the software to bring it to the surface.

## S01
{#third}And it starts with a simple problem, because just as one third never ends in decimal, where it's {#third_num}[0.333|zero point three three three] forever, {#tenth}one tenth never ends in binary, so a computer has to {#chop}chop it off somewhere.
{#slight}That means the [0.1|zero point one] inside a machine is very slightly wrong, which usually {#harmless}doesn't matter at all.

## S02
{#battery}So picture a Patriot missile battery in {#saudi}Saudi Arabia in {#feb}February [1991|nineteen ninety-one], whose {#clock}clock counted tenths of a second, and which {#multiply}multiplied that count by its own chopped-off [0.1|zero point one].
{#short}Because that stored value was short by about {#ppm}one part in a million, the clock {#behind}fell further behind the longer it stayed on, and although the system was {#design}designed to run for only a few hours at one site, this one had been running for {#h100}about [100|a hundred] hours.
{#third_s}By then the clock was behind by about {#third_sec}a third of a second.

## S03
{#puzzle}But here's the puzzle, because a slow clock shouldn't matter at all, since the radar finds a missile from the {#pulses}time between two pulses, and if {#both}both times are slow by the same amount, the {#cancel}error cancels.
{#watch}It's like a watch that's an hour wrong, which can still {#race}time a race perfectly, because you only care about the {#diff}difference.

## S04
{#did}And the error did cancel until the old code was {#patched}patched to handle fast ballistic missiles, when a {#accurate}more accurate way of converting the time was added, but it {#missed}wasn't added in every place that needed it.
{#subtract}So now the system was subtracting a sloppy time from an accurate one, which meant the {#pop}whole third of a second suddenly appeared in the answer.
{#mach}Since a Scud flies at about [Mach 5|Mach five], that was enough to {#shift}shift the radar's search window by [687 metres|six hundred and eighty-seven meters], so it {#wrong}looked in the wrong place, and on {#d25}[25 February|the twenty-fifth of February] the battery {#never}never engaged the missile that {#struck}struck an Army barracks.
@pause 1.8

## S05
{#close}And it came painfully close, because {#israel}Israeli data had flagged the drift two weeks earlier, and the {#fix}corrected software arrived on {#d26}[26 February|the twenty-sixth of February], one day too late.
{#reboot}Even a reboot, which took about {#reboot_t}a minute and a half at most, would have reset the clock, although {#nobody}nobody can say whether the Patriot would then have hit the Scud.
{#back}So that stray {#four2}four on your screen is almost always harmless, but it comes from the same kind of {#same}chopped-off fraction.
@pause 1.0
