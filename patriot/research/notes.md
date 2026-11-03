# Research notes: the Patriot rounding error (Dhahran, 25 February 1991)

**Central question:** a clock wrong by one part in a million shouldn't matter, so why did it matter?

## The popular version vs what the sources say

The popular telling ("0.1 can't be stored exactly, the error built up over 100 hours, the missile was missed") is
**incomplete and on its own doesn't explain the miss.** Skeel (SIAM News, 1992) points out that tracking uses the time
*between* radar pulses, so a uniform clock error should largely cancel. It stopped cancelling because a more accurate
time conversion had been added in some places in the code and not others. GAO gives the drift and the failure but not
this mechanism, so the "patch" step (S04) rests on Skeel alone.

Also often overstated: "a reboot would have saved them". GAO only says a reboot resets the clock. Whether the Patriot
would then have hit the Scud can't be known, and its record against Scuds was itself disputed (Skeel notes this). The
script says nobody can say.

## Sources

| Claim | Source |
|---|---|
| Battery ran about 100 hours; 0.3433 s and 687 m at 100 h; table of drift by hours; 28 American soldiers killed; 25 Feb engagement failure; software reached Dhahran 26 Feb; designed to be mobile and run a few hours at one location; Mach 5; radar "looks in the wrong place"; reboot takes 60-90 s and resets the clock; Israeli data received 11 Feb (20% shift after 8 h); 21 Feb Army message; six software changes | GAO IMTEC-92-26, 1992: [summary](https://www.gao.gov/products/imtec-92-26), [PDF](https://www.gao.gov/assets/imtec-92-26.pdf), [full text mirror](https://cs.nyu.edu/exact/resource/mirror/patriot.htm) |
| Tracking uses elapsed time between pulses so the error should cancel; truncated 0.1 = 0.1 x (1 - 2^-20); patch for fast ballistic missiles on roughly 20-year-old assembly code; accurate subroutine not inserted everywhere; one truncated and one accurate time subtracted; Scud travels more than half a km in 0.34 s; Patriot's Scud record also questioned | R. Skeel, "Roundoff Error and the Patriot Missile", SIAM News 25(4), 1992: [text](https://w3.ual.es/~plopez/docencia/itis/patriot.htm), [scan](https://www-users.cse.umn.edu/%7earnold/disasters/Patriot-dharan-skeel-siam.pdf) |
| 0.1 + 0.2 = 0.30000000000000004 in IEEE 754 doubles; 2^-20 error; drift 0.0275 s at 8 h, 0.0687 s at 20 h, 0.3433 s at 100 h, all matching GAO | Computed: `checks/compute1.py`, section PATRIOT (exact fractions) |

## Notes

- GAO's printed table has a typo at 8 hours (.0025 s where the time columns give .0275 s); the Short uses .0275.
- "Same family" is deliberate: Patriot used a 24-bit fixed-point register and Python uses 64-bit floats, but both fail
  because 1/10 doesn't terminate in binary.
- "Two weeks earlier" = 11 Feb against 25 Feb.
- The 687 m is GAO's range-gate shift at 100 h, used as published. A plain Mach 5 x 0.3433 s gives about 584 m
  (sea-level Mach), consistent with Skeel's "more than half a km"; the Short does not recompute GAO's figure.
- On screen, the 1/10 binary row is cut after bit 23 (23 bits after the binary point in a 24-bit register), and the
  stored value is shown as 0.0999999046 (= 209715 / 2097152), error 0.000000095 s per tick.
- The calendar's 21 Feb mark (Army warning message) is shown but not spoken.
