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
    ALT_SEP: 350,       // booster separation altitude (the surge — the best bit)
    ALT_SPACE: 2600,    // hand off to the space stage — high enough that a full
                        //   climb is a ~18–20s journey (more flight time), not a
                        //   10s blip, thanks to the climb-speed cap below
    // Gentle atmospheric drag on the launch (a = thrust/m - g - K*vy*|vy|). This
    // lets the rocket punch off the pad but settle to a throttle-controlled
    // terminal climb speed (~160 u/s at full post-sep) instead of accelerating
    // without limit — so the ascent lasts, and easing the throttle visibly slows
    // the climb (and below hover it sinks back). Also gentles the fall-back.
    K_DRAG_LAUNCH: 0.0013,

    // --- SPACE (3D, RCS translation — the ship faces the goal, you slide it) --
    SPACE_ACCEL: 26,    // fore/aft thrust while a button is held
    RCS_ACCEL: 22,      // up/down/left/right translation thrust (the left pad)
    SPACE_VMAX: 150,    // speed cap
    SPACE_DAMP: 0.06,   // per-second velocity damping — TINY, so it coasts;
                        //   just enough that a drifting 5-year-old eventually
                        //   coasts to a stop instead of vanishing forever
    SPACE_ALIGN: 1.8,   // per-second easing of velocity toward the nose (gentle
                        //   curve — the "arcade" in arcade drift)
    TETHER_R: 6000,     // soft world radius; beyond it, nudged back (never lost)
    APPROACH_R: 520,    // within this of the destination planet -> land

    // --- DOCKING (the space stage's first goal) ----------------------------
    STATION_T: 0.38,    // station sits this fraction of the way to the planet
    DOCK_RADIUS: 46,    // within this of the dock ring = an arrival
    DOCK_SPEED: 26,     // arrive slower than this = dock; faster = boing bounce
                        //   (the lesson: docking means MATCHING speeds, gently)
    BRAKE_DAMP: 2.6,    // per-second velocity damping while the brake is held —
                        //   the retro thruster that lets you slow down to dock

    // --- LAUNCH ATTITUDE (keep the rocket climbing straight) ---------------
    // VERY gentle: the wind barely nudges the rocket, the tilt control is a slow
    // fine trim, and the rocket eases back toward vertical on its own — so it
    // only ever needs tiny corrections, never a fight. (Softened twice.)
    ATT_MAX: 0.16,      // rad — most the rocket can lean either way (~9°)
    ATT_RATE: 0.15,     // rad/s the tilt control trims it while held (slow, fine)
    ATT_DRIFT: 0.045,   // rad/s wind-gust wander (tiny, bounded, oscillatory)
    ATT_RETURN: 0.10,   // rad/s the rocket self-centres toward vertical when the
                        //   tilt control is released (forgiving — never lost)
    ATT_BAND: 0.085,    // rad — within this of vertical = full climb efficiency
    ATT_EFF_MIN: 0.65,  // climb efficiency when fully off attitude. NEVER 0: a
                        //   sloppy ascent is slower, not a failure (still climbs
                        //   at full throttle, since it clears the hover point)

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

  // launch adds quadratic drag opposing vertical motion, so thrust settles to a
  // throttle-controlled climb speed. vy defaults to 0 (drag-free) for callers
  // that just want the instantaneous thrust-vs-gravity accel (e.g. hover checks).
  function launchAccel(throttle, mass, vy) {
    vy = vy || 0;
    return vAccel(throttle, mass, C.G_HOME, C.THRUST_LAUNCH) - C.K_DRAG_LAUNCH * vy * Math.abs(vy);
  }
  function landingAccel(throttle, mass, g) { return vAccel(throttle, mass, g, C.THRUST_LAND); }

  // The landing throttle lever is HOVER-CENTRED for fine control: the middle of
  // the lever (0.5) holds altitude (thrust == weight), the top half is a gentle
  // climb, the bottom half a gentle descent. This spreads the useful thrust over
  // the whole lever, so a small nudge is a small change — instead of a twitchy
  // band just above zero where a tiny move rockets you up.
  function hoverThrottle(mass, g) { return clamp(mass * g / C.THRUST_LAND, 0.08, 0.92); }
  function leverToThrottle(lever, hover) {
    return lever <= 0.5 ? (lever / 0.5) * hover : hover + ((lever - 0.5) / 0.5) * (1 - hover);
  }

  // launch attitude -> climb efficiency (1 = dead-on vertical, ATT_EFF_MIN =
  // fully off). Multiplies effective throttle so a straight ascent reaches space
  // faster while a leaning one just dawdles — never sinks at full throttle.
  function launchClimbEff(att) {
    var off = Math.abs(att);
    if (off <= C.ATT_BAND) return 1;
    var t = clamp((off - C.ATT_BAND) / (C.ATT_MAX - C.ATT_BAND), 0, 1);
    return 1 - (1 - C.ATT_EFF_MIN) * t;
  }

  // touchdown softness -> tier label
  function landingTier(vyImpact) {
    var s = Math.abs(vyImpact);
    return s < C.SOFT ? 'soft' : s < C.MED ? 'ok' : 'bounce';
  }

  return {
    C: C, clamp: clamp,
    launchAccel: launchAccel, landingAccel: landingAccel, landingTier: landingTier,
    launchClimbEff: launchClimbEff, hoverThrottle: hoverThrottle, leverToThrottle: leverToThrottle
  };
}));
