"""
config/cosmos.py -- how many atoms the observable universe holds, and how old it is, from the Planck 2018
parameters [PLANCK18] (flat Lambda-CDM), so "about 10^80 atoms" is computed, not quoted.

  age        t0 = integral of dz / ((1 + z) H(z)) from 0 to infinity
  horizon    comoving radius of the observable universe, D = c * integral of dz / H(z) from 0 to infinity
  baryons    n_b = Omega_b * rho_crit / m_p, times the volume of a sphere of radius D
  atoms      nuclei: hydrogen (mass fraction 1 - Y) plus helium (Y, four baryons each), Y from Big Bang
             nucleosynthesis [PDG-BBN]. Most of these are ionized gas between galaxies; "atoms" is the usual loose
             word (research/notes.md FLAG).
"""

from __future__ import annotations

import math

from scipy import constants as k
from scipy.integrate import quad

# Planck 2018 VI, abstract (base Lambda-CDM): H0 = 67.4 km/s/Mpc, Omega_m = 0.315, Omega_b h^2 = 0.0224
H0_KMS_MPC = 67.4
OMEGA_M = 0.315
OMEGA_B_H2 = 0.0224
T_CMB = 2.7255          # K [FIX09]
N_EFF = 3.046           # standard-model neutrino species (radiation density)
Y_HE = 0.245            # helium mass fraction [PDG-BBN]

MPC = 3.0856775814913673e22     # m
GYR = 1e9 * 365.25 * 86400      # s (Julian years)
LY = k.c * 365.25 * 86400       # m


def params() -> dict:
    h = H0_KMS_MPC / 100
    H0 = H0_KMS_MPC * 1e3 / MPC                                   # 1/s
    rho_crit = 3 * H0 ** 2 / (8 * math.pi * k.G)                  # kg/m^3
    # photons: u = a T^4 (radiation constant a = 4 sigma / c); neutrinos add 7/8 (4/11)^(4/3) per species
    a_rad = 4 * k.Stefan_Boltzmann / k.c
    rho_gamma = a_rad * T_CMB ** 4 / k.c ** 2
    omega_r = rho_gamma / rho_crit * (1 + N_EFF * 7 / 8 * (4 / 11) ** (4 / 3))
    omega_l = 1 - OMEGA_M - omega_r
    return {"h": h, "H0": H0, "rho_crit": rho_crit, "omega_r": omega_r, "omega_l": omega_l}


def _E(z: float, p: dict) -> float:
    return math.sqrt(p["omega_r"] * (1 + z) ** 4 + OMEGA_M * (1 + z) ** 3 + p["omega_l"])


def age_gyr() -> float:
    p = params()
    # in the scale factor a = 1 / (1 + z): t0 = integral_0^1 da / (a H) -- smooth, no infinite range
    val, _ = quad(lambda a: 1 / (a * _E(1 / a - 1, p)), 1e-12, 1, limit=500)
    return val / p["H0"] / GYR


def horizon_m() -> float:
    p = params()
    # D = c integral_0^1 da / (a^2 H)
    val, _ = quad(lambda a: 1 / (a * a * _E(1 / a - 1, p)), 1e-12, 1, limit=500)
    return k.c * val / p["H0"]


def baryons() -> float:
    p = params()
    rho_b = OMEGA_B_H2 / p["h"] ** 2 * p["rho_crit"]
    n_b = rho_b / k.m_p                                           # per m^3
    return n_b * 4 / 3 * math.pi * horizon_m() ** 3


def atoms() -> float:
    return baryons() * ((1 - Y_HE) + Y_HE / 4)


if __name__ == "__main__":
    print(f"age {age_gyr():.3f} Gyr, horizon {horizon_m() / LY / 1e9:.1f} billion light years, "
          f"baryons {baryons():.2e}, atoms {atoms():.2e}")
