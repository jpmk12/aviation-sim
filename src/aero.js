/* ============================================================================
 * AERO  —  Flight School flight model (spec §3)
 * ----------------------------------------------------------------------------
 * Single source of truth for the flight *numbers* and the one equation that
 * matters. Deliberately framework-free so it can be:
 *   - inlined into the game (browser) and driven with a THREE quaternion, and
 *   - required() by test/physics-sim.js in Node to PROVE that a sustained hard
 *     pull bleeds airspeed into a stall (spec §3.6, §12).
 *
 * The game does the geometry (quaternion integration, coordinated turn); this
 * module owns the scalars: thrust, drag, the g*sin(pitch) energy term, and the
 * airspeed-scaled control authority that *is* the stall, felt not modelled.
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AERO = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- §3.8 Starting constants (tune, don't trust) --------------------------
  var C = {
    V_STALL: 25,     // u/s  — below this the wing gives up
    V_CRUISE: 60,    // u/s  — autothrottle target
    V_MAX: 110,      // u/s
    // --- RETUNED from the spec's starting values (§3.8), which were flagged
    //     "tune, don't trust". Two changes, both forced by the §3.6 warning:
    //   THRUST_MAX 28 -> 5.0 : at 28 the autothrottle out-muscled gravity and
    //     a vertical climb still ACCELERATED — the plane could never stall and
    //     the whole energy lesson died. It must sit below m*G (=6.5 for the
    //     empty plane) so a sustained pull always bleeds to the stall.
    //   K_DRAG 0.006 -> 0.00065 : at 0.006 quadratic drag pinned terminal
    //     speed near ~33 u/s, so a dive could not build speed and cruise
    //     collapsed onto the stall. 0.00065 puts the terminal dive at
    //     sqrt(G/K_DRAG) ~= 100 u/s, just under V_MAX, and level cruise at ~58.
    // Verified by test/physics-sim.js. See spec §3.6.
    // THRUST_MAX 5.0 -> 3.5: at 5 the climb bled to the stall only marginally
    // (min ~26 u/s after a long hold). 3.5 keeps level cruise ~58 (drag-limited
    // there anyway) but starves the climb, so a held pull reaches the stall
    // decisively in ~8s. Still climbs out fine after recovery.
    THRUST_MAX: 3.5, // u/s^2 — MUST be < m*G so a sustained pull stalls
    K_AT: 1.2,       // autothrottle gain
    K_DRAG: 0.00065, // quadratic drag
    // G 6.5 -> 8.0: still floaty (82% of Earth, and the auto-leveling keeps the
    // feel gentle) but a held climb now costs speed fast enough to stall. The
    // game also clamps pitch attitude (no looping over the top / inverted), so a
    // sustained pull genuinely mushes into the stall rather than flying a loop.
    G: 8.0,          // gravity, scaled down for a floatier, forgiving feel
    PITCH_LIMIT: 74, // deg — max nose up/down; prevents loops & inverted flight
    BANK_LIMIT: 70,  // deg — max bank; a held roll settles into a tight turn,
    MAX_PITCH_RATE: 45, // deg/s at full authority
    MAX_ROLL_RATE: 90,  // deg/s at full authority
    M_PLANE: 1.0,
    STALL_RECOVER: 1.15, // recovered once v > V_STALL * this
    STALL_NOSE_DOWN: 30  // deg/s nose-down torque while stalled
  };

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  // 0 at stall speed, 1 at cruise+ — the normalised "how alive is the wing".
  function lift(v) {
    return clamp((v - C.V_STALL) / (C.V_CRUISE - C.V_STALL), 0, 1);
  }

  // §3.3 control authority scales with airspeed. Slow = mushy.
  function pitchRate(v) { return C.MAX_PITCH_RATE * clamp(lift(v), 0, 1); }
  function rollRate(v)  { return C.MAX_ROLL_RATE  * clamp(lift(v), 0.3, 1); }

  // §3.6 auto-throttle. Note the low ceiling — this is load-bearing.
  function thrust(v) { return clamp(C.K_AT * (C.V_CRUISE - v), 0, C.THRUST_MAX); }

  function drag(v) { return C.K_DRAG * v * v; }

  // §3.2 THE ONE EQUATION THAT MATTERS.
  //   dv/dt = (thrust - drag) / m  -  g * sin(pitch)
  // sinPitch is the vertical component of the (unit) forward vector: climbing
  // (>0) bleeds speed, diving (<0) builds it. The whole lesson lives here.
  function dvdt(v, sinPitch, m) {
    return (thrust(v) - drag(v)) / m - C.G * sinPitch;
  }

  return {
    C: C,
    clamp: clamp,
    lift: lift,
    pitchRate: pitchRate,
    rollRate: rollRate,
    thrust: thrust,
    drag: drag,
    dvdt: dvdt
  };
}));
