# How fast are you moving right now?
# One sentence per line. [display|spoken] swaps caption text for what the voice says,
# {{key}} pulls a number from config/facts.py SAY, {#name} marks a visual event at the next word,
# "@pause s" sets the gap after the previous sentence, "## name" starts a section (scene).

## hook
{#hook}Imagine you're sitting {#still_word}perfectly still.
@pause 1.3
But you're {#three}moving in at least three ways at once.

## spin
{#spin}First, Earth spins.
{#merry}Think of a merry-go-round. The {#edge}edge moves fastest.
@pause 1.0
{#equator}On Earth, that's the equator, at about {#spin_num}{{spin_kmh}} [km/h|kilometers an hour].
@pause 1.8
{#jet}Nearly twice as fast as a {#jet_word}passenger jet.
@pause 1.3
{#feel}So why don't we feel it?
@pause 0.9
{#flight}On a smooth flight, you can pour a drink {#pour}without spilling.
{#steady}Steady motion feels like standing still.

## orbit
{#orbit}Second, Earth circles the Sun.
{#marathon}Picture running a marathon.
@pause 0.9
{#marathon_earth}Earth covers that in about {#sec}a second and a half.
@pause 1.5
{#orbit_num}That's more than {{orbit_kmh}} [km/h|kilometers an hour].
@pause 1.7

## galaxy
{#galaxy}Third, the Sun carries us around the [centre|center] of the Milky Way, at about {#gal_num}{{gal_kmh}} [km/h|kilometers an hour].
@pause 1.8
{#lap}One lap takes around {#lap_num}{{gal_year}} years.
@pause 1.2
{#dinos}The last time we were here, the first {#dino_word}dinosaurs were just starting out.
@pause 1.9

## payoff
{#payoff}So while you watched this, you've [travelled|traveled] about {#payoff_num}{{payoff_km}} [km|kilometers] around the Sun.
@pause 1.5
{#end}Not bad for sitting still.
