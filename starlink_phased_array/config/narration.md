# The flat Starlink antenna that steers without moving
# One sentence per line. [display|spoken] swaps caption text for what the voice says,
# {{key}} pulls a number from config/facts.py SAY, {#name} marks a visual event at the next word,
# "@pause s" sets the gap after the previous sentence, "## name" starts a section (scene).

## hook
{#roof}A flat white panel sits bolted to a roof, and it never turns to follow anything.
@pause 0.8
{#sat}Yet the satellite it listens to crosses the sky at {#sat_num}{{sat_kmh}}, and in a few minutes {#gone}it will be gone.
@pause 0.9
{#how}So how does the panel keep up?

## steer
{#motor}A motor would always be a step behind, so Starlink {#steer}steers the signal itself, and {#pond}a pond shows how.

## ripples
{#stones}Throw two stones into the water, and {#cross}where their ripples cross, {#up}crest meets crest and the water jumps, while {#down}crest meets trough and it goes flat.
@pause 0.9
{#row}Then line up a whole row of stones and drop them together, and the ripples add up {#ahead}only straight ahead.

## delay
{#late}But let each stone land a split second after its neighbor, and {#slant}the whole wave leans to one side.
@pause 0.8
{#panel}The panel does that with radio waves, firing each tiny antenna {#ps}trillionths of a second after its neighbor, so the beam {#tilt}tilts toward the satellite.

## follow
{#follow}As the satellite crosses the sky, the delays shift a little at a time and the beam {#glide}glides along, until {#next}the next satellite rises and the panel aims there.

## payoff
{#payoff}So the only thing that moves is time.
@pause 1.1
{#end}And that is enough for a panel that never turns to keep up with a satellite that never slows down.
