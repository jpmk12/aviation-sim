/* ============================================================================
 * SPACE  —  Space School flight numbers (SPACE_SCHOOL.md §4)
 * ----------------------------------------------------------------------------
 * Framework-free so the game inlines it AND test/space-sim.js can require() it
 * to prove the three lessons hold with the real numbers:
 *   launch  — won't lift until thrust beats weight; booster sep surges
 *   space   — cut the engine and you keep coasting (no air)
 *   landing — retro-burn beats gravity, a soft touchdown is reachable
 * The one idea across all three: your engine is the only thing that changes
 * your motion.
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SPACE = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var C = {
    // --- LAUNCH (1D vertical) ---------------------------------------------
    G_HOME: 9.0,        // home-planet gravity (u/s^2)
    M_FULL: 3.0,        // rocket + boosters
    M_LIGHT: 1.35,      // after booster separation
    THRUST_LAUNCH: 70,  // force; a = throttle*THRUST/m - g. Lift-off needs
                        //   throttle*70 > M_FULL*G_HOME (27), i.e. ~39% throttle
                        //   — a timid push just rumbles on the pad, but shove it
                        //   up and full throttle is genuinely peppy (a≈14 u/s^2),
                        //   then booster sep surges it (a≈42). Threshold teaches
                        //   "push it up to beat gravity" without a sleepy crawl.
    ALT_SEP: 200,       // booster separation altitude (early, so the surge — the
                        //   best bit — arrives within a few seconds of liftoff)
    ALT_SPACE: 1150,    // hand off to the space stage

    // --- SPACE (3D, gentle arcade drift) ----------------------------------
    SPACE_ACCEL: 26,    // forward thrust while the button is held
    SPACE_VMAX: 150,    // speed cap
    SPACE_DAMP: 0.06,   // per-second velocity damping — TINY, so it coasts;
                        //   just enough that a drifting 5-year-old eventually
                        //   coasts to a stop instead of vanishing forever
    SPACE_ALIGN: 1.8,   // per-second easing of velocity toward the nose (gentle
                        //   curve — the "arcade" in arcade drift)
    TETHER_R: 6000,     // soft world radius; beyond it, nudged back (never lost)
    APPROACH_R: 520,    // within this of the destination planet -> land

    // --- LANDING (1D vertical + small lateral) ----------------------------
    THRUST_LAND: 22,    // retro force; hover throttle ~ m*g/THRUST
    ALT_LAND_START: 170, // a brisk ~8–12s descent, not a tedious crawl
    VY_LAND_START: -9,
    SOFT: 9,            // |touchdown vy| below this = feather-soft (confetti)
    MED: 20            // below this = fine; above = comedy bounce (still lands)
  };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  // vertical acceleration for launch / landing: throttle in [0,1]
  function vAccel(throttle, mass, g, thrust) { return throttle * thrust / mass - g; }

  function launchAccel(throttle, mass) { return vAccel(throttle, mass, C.G_HOME, C.THRUST_LAUNCH); }
  function landingAccel(throttle, mass, g) { return vAccel(throttle, mass, g, C.THRUST_LAND); }

  // touchdown softness -> tier label
  function landingTier(vyImpact) {
    var s = Math.abs(vyImpact);
    return s < C.SOFT ? 'soft' : s < C.MED ? 'ok' : 'bounce';
  }

  return {
    C: C, clamp: clamp,
    launchAccel: launchAccel, landingAccel: landingAccel, landingTier: landingTier
  };
}));
